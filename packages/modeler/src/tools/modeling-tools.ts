import type { AgentTool, AgentContext } from '@om/pi-agent';
import type { OntologyModel, IngestedSchema } from '@om/ontology';
import { makeIRI, OntologyOperations } from '@om/ontology';

/**
 * Create ontology modeling tools for the AI agent.
 * Each tool modifies the OntologyModel and returns a confirmation string.
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
          type: 'class',
          iri,
          label: name,
          description: args.description as string | undefined,
          superClasses: args.superClassName
            ? [makeIRI(namespace, args.superClassName as string)]
            : [],
          equivalentClasses: [],
          disjointWith: [],
          restrictions: [],
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
          name: { type: 'string', description: 'Property name in camelCase (e.g., "hasAuthor", "borrows")' },
          description: { type: 'string', description: 'Human-readable description' },
          domainClassName: { type: 'string', description: 'Domain class name' },
          rangeClassName: { type: 'string', description: 'Range class name' },
        },
        required: ['name', 'domainClassName', 'rangeClassName'],
      },
      async execute(args: Record<string, unknown>): Promise<string> {
        const name = args.name as string;
        const iri = makeIRI(namespace, name);
        ops.addObjectProperty({
          type: 'object-property',
          iri,
          label: name,
          description: args.description as string | undefined,
          domain: [{ kind: 'iri', iri: makeIRI(namespace, args.domainClassName as string) }],
          range: [{ kind: 'iri', iri: makeIRI(namespace, args.rangeClassName as string) }],
          superProperties: [],
          characteristics: [],
        });
        return `Created object property "${name}". Total: ${ops.stats().objectProperties}`;
      },
    },

    {
      name: 'create_data_property',
      description: 'Create a new OWL data property (attribute of a class with a data value).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Property name in camelCase (e.g., "hasName", "hasAge")' },
          description: { type: 'string', description: 'Human-readable description' },
          domainClassName: { type: 'string', description: 'Domain class name' },
          dataType: { type: 'string', description: 'XSD data type (e.g., "xsd:string", "xsd:integer", "xsd:date")' },
        },
        required: ['name', 'domainClassName'],
      },
      async execute(args: Record<string, unknown>): Promise<string> {
        const name = args.name as string;
        const iri = makeIRI(namespace, name);
        ops.addDataProperty({
          type: 'data-property',
          iri,
          label: name,
          description: args.description as string | undefined,
          domain: [{ kind: 'iri', iri: makeIRI(namespace, args.domainClassName as string) }],
          range: [(args.dataType as string || 'xsd:string') as import('@om/ontology').DataType],
          superProperties: [],
          characteristics: [],
        });
        return `Created data property "${name}". Total: ${ops.stats().dataProperties}`;
      },
    },

    {
      name: 'create_individual',
      description: 'Create a named individual (instance) of a class.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Individual name (e.g., "john_doe", "book_001")' },
          className: { type: 'string', description: 'Class this individual belongs to' },
        },
        required: ['name', 'className'],
      },
      async execute(args: Record<string, unknown>): Promise<string> {
        const name = args.name as string;
        const iri = makeIRI(namespace, name);
        ops.addIndividual({
          type: 'individual',
          iri,
          label: name,
          classIRIs: [makeIRI(namespace, args.className as string)],
          propertyValues: [],
        });
        return `Created individual "${name}". Total: ${ops.stats().individuals}`;
      },
    },

    {
      name: 'get_ontology_stats',
      description: 'Get current ontology statistics (number of classes, properties, individuals).',
      parameters: { type: 'object', properties: {} },
      async execute(): Promise<string> {
        const stats = ops.stats();
        return JSON.stringify({
          title: model.metadata.title,
          classes: stats.classes,
          objectProperties: stats.objectProperties,
          dataProperties: stats.dataProperties,
          individuals: stats.individuals,
          axioms: stats.axioms,
        });
      },
    },

    {
      name: 'get_data_schema',
      description: 'Get the ingested data schema summary (tables, columns, types) to inform ontology design.',
      parameters: { type: 'object', properties: {} },
      async execute(): Promise<string> {
        const summary = schemas.map((s) => ({
          source: s.source,
          type: s.type,
          tables: s.tables?.map((t) => ({
            name: t.name,
            columns: t.columns.map((c) => ({ name: c.name, type: c.dataType })),
            rowCount: t.rowCount,
            foreignKeys: t.foreignKeys,
          })),
          entities: s.entities?.length ?? 0,
          textSegments: s.textSegments?.length ?? 0,
        }));
        return JSON.stringify(summary, null, 2);
      },
    },

    {
      name: 'list_classes',
      description: 'List all classes currently defined in the ontology.',
      parameters: { type: 'object', properties: {} },
      async execute(): Promise<string> {
        return JSON.stringify(model.classes.map((c) => ({
          name: c.iri.local,
          description: c.description,
          superClasses: c.superClasses.map((s) => s.local),
        })));
      },
    },
  ];
}
