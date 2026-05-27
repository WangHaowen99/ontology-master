import type { OntologyModel, IngestedSchema } from '@om/ontology';
import { makeIRI, OntologyOperations } from '@om/ontology';
import type { AgentTool } from '../types.js';

/**
 * Create ontology modeling tools for the AI agent.
 */
export function createModelingTools(model: OntologyModel, schemas: IngestedSchema[]): AgentTool[] {
  const ops = new OntologyOperations(model);
  const namespace = model.iri + '#';

  return [
    {
      name: 'create_class',
      description: 'Create a new OWL class in the ontology. Use PascalCase for class names.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Class name in PascalCase (e.g., "Person", "Book")' },
          description: { type: 'string', description: 'Human-readable description' },
          superClassName: { type: 'string', description: 'Optional superclass name' },
        },
        required: ['name'],
      },
      async execute(args: Record<string, unknown>): Promise<string> {
        const name = args.name as string;
        const iri = makeIRI(namespace, name);
        ops.addClass({
          type: 'class', iri, label: name,
          description: args.description as string | undefined,
          superClasses: args.superClassName ? [makeIRI(namespace, args.superClassName as string)] : [],
          equivalentClasses: [], disjointWith: [], restrictions: [],
        });
        return `Created class "${name}". Total classes: ${ops.stats().classes}`;
      },
    },
    {
      name: 'create_object_property',
      description: 'Create a new OWL object property (relationship between classes).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Property name in camelCase' },
          description: { type: 'string' },
          domainClassName: { type: 'string' },
          rangeClassName: { type: 'string' },
        },
        required: ['name', 'domainClassName', 'rangeClassName'],
      },
      async execute(args: Record<string, unknown>): Promise<string> {
        const name = args.name as string;
        ops.addObjectProperty({
          type: 'object-property', iri: makeIRI(namespace, name), label: name,
          description: args.description as string | undefined,
          domain: [{ kind: 'iri', iri: makeIRI(namespace, args.domainClassName as string) }],
          range: [{ kind: 'iri', iri: makeIRI(namespace, args.rangeClassName as string) }],
          superProperties: [], characteristics: [],
        });
        return `Created object property "${name}". Total: ${ops.stats().objectProperties}`;
      },
    },
    {
      name: 'create_data_property',
      description: 'Create a new OWL data property (attribute of a class).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          domainClassName: { type: 'string' },
          dataType: { type: 'string', description: 'XSD type (xsd:string, xsd:integer, xsd:date)' },
        },
        required: ['name', 'domainClassName'],
      },
      async execute(args: Record<string, unknown>): Promise<string> {
        const name = args.name as string;
        ops.addDataProperty({
          type: 'data-property', iri: makeIRI(namespace, name), label: name,
          description: args.description as string | undefined,
          domain: [{ kind: 'iri', iri: makeIRI(namespace, args.domainClassName as string) }],
          range: [(args.dataType as string || 'xsd:string') as import('@om/ontology').DataType],
          superProperties: [], characteristics: [],
        });
        return `Created data property "${name}". Total: ${ops.stats().dataProperties}`;
      },
    },
    {
      name: 'get_data_schema',
      description: 'Get ingested data schema summary to inform ontology design.',
      parameters: { type: 'object', properties: {} },
      async execute(): Promise<string> {
        return JSON.stringify(schemas.map((s) => ({
          source: s.source, type: s.type,
          tables: s.tables?.map((t) => ({ name: t.name, columns: t.columns.map((c) => ({ name: c.name, type: c.dataType })), rowCount: t.rowCount, foreignKeys: t.foreignKeys })),
          entities: s.entities?.length ?? 0, textSegments: s.textSegments?.length ?? 0,
        })), null, 2);
      },
    },
    {
      name: 'list_classes',
      description: 'List all classes in the ontology.',
      parameters: { type: 'object', properties: {} },
      async execute(): Promise<string> {
        return JSON.stringify(model.classes.map((c) => ({ name: c.iri.local, description: c.description, superClasses: c.superClasses.map((s) => s.local) })));
      },
    },
    {
      name: 'get_ontology_stats',
      description: 'Get ontology statistics.',
      parameters: { type: 'object', properties: {} },
      async execute(): Promise<string> {
        return JSON.stringify({ title: model.metadata.title, ...ops.stats() });
      },
    },
  ];
}
