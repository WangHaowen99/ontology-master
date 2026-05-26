// ═══════════════════════════════════════════════════════
// OWL 2 本体领域类型系统
// ═══════════════════════════════════════════════════════

// ─── Base Types ───

export interface IRI {
  /** Full IRI, e.g. "http://example.org/ontology#Person" */
  full: string;
  /** Short name / local name, e.g. "Person" */
  local: string;
  /** Namespace, e.g. "http://example.org/ontology#" */
  namespace: string;
}

export interface Labelled {
  iri: IRI;
  label: string;
  description?: string;
  labels?: Record<string, string>; // language-tagged labels: { en: "Person", zh: "人" }
}

// ─── OWL Classes ───

export interface OwlClass extends Labelled {
  type: 'class';
  superClasses: IRI[];
  equivalentClasses: ClassExpression[];
  disjointWith: IRI[];
  restrictions: Restriction[];
}

export type ClassExpression =
  | { kind: 'iri'; iri: IRI }
  | { kind: 'intersection'; classes: ClassExpression[] }
  | { kind: 'union'; classes: ClassExpression[] }
  | { kind: 'complement'; classExpr: ClassExpression }
  | { kind: 'restriction'; restriction: Restriction }
  | { kind: 'oneOf'; individuals: IRI[] };

// ─── Properties ───

export interface OwlObjectProperty extends Labelled {
  type: 'object-property';
  domain: ClassExpression[];
  range: ClassExpression[];
  superProperties: IRI[];
  inverseOf?: IRI;
  characteristics: PropertyCharacteristic[];
}

export interface OwlDataProperty extends Labelled {
  type: 'data-property';
  domain: ClassExpression[];
  range: DataType[];
  superProperties: IRI[];
  characteristics: PropertyCharacteristic[];
  functional?: boolean;
}

export interface OwlAnnotationProperty extends Labelled {
  type: 'annotation-property';
  domain?: IRI[];
  range?: IRI[];
}

export type PropertyCharacteristic =
  | 'functional'
  | 'inverse-functional'
  | 'transitive'
  | 'symmetric'
  | 'asymmetric'
  | 'reflexive'
  | 'irreflexive';

export type OwlProperty = OwlObjectProperty | OwlDataProperty | OwlAnnotationProperty;

// ─── Data Types ───

export type DataType =
  | 'xsd:string'
  | 'xsd:boolean'
  | 'xsd:integer'
  | 'xsd:int'
  | 'xsd:long'
  | 'xsd:float'
  | 'xsd:double'
  | 'xsd:decimal'
  | 'xsd:date'
  | 'xsd:dateTime'
  | 'xsd:time'
  | 'xsd:anyURI'
  | 'rdfs:Literal';

// ─── Individuals ───

export interface Individual extends Labelled {
  type: 'individual';
  classIRIs: IRI[];
  propertyValues: PropertyValue[];
  sameAs?: IRI[];
  differentFrom?: IRI[];
}

export interface PropertyValue {
  propertyIRI: IRI;
  value: IRI | DataValue;
}

export interface DataValue {
  datatype: DataType;
  value: string;
  language?: string;
}

// ─── Restrictions ───

export type Restriction =
  | { kind: 'some'; property: IRI; filler: ClassExpression }
  | { kind: 'all'; property: IRI; filler: ClassExpression }
  | { kind: 'hasValue'; property: IRI; value: IRI | DataValue }
  | { kind: 'minCardinality'; property: IRI; cardinality: number; filler?: ClassExpression }
  | { kind: 'maxCardinality'; property: IRI; cardinality: number; filler?: ClassExpression }
  | { kind: 'exactCardinality'; property: IRI; cardinality: number; filler?: ClassExpression };

// ─── Axioms ───

export type Axiom =
  | { kind: 'subClassOf'; sub: IRI; sup: ClassExpression }
  | { kind: 'equivalentClasses'; classes: ClassExpression[] }
  | { kind: 'disjointClasses'; classes: IRI[] }
  | { kind: 'subPropertyOf'; sub: IRI; sup: IRI }
  | { kind: 'equivalentProperties'; properties: IRI[] }
  | { kind: 'classAssertion'; individual: IRI; classExpr: ClassExpression }
  | { kind: 'objectPropertyAssertion'; subject: IRI; property: IRI; object: IRI }
  | { kind: 'dataPropertyAssertion'; subject: IRI; property: IRI; value: DataValue };

// ─── SHACL Shapes ───

export interface ShaclShape {
  iri: IRI;
  targetClass: IRI;
  properties: ShaclPropertyConstraint[];
}

export interface ShaclPropertyConstraint {
  path: IRI;
  datatype?: DataType;
  class?: IRI;
  minCount?: number;
  maxCount?: number;
  pattern?: string;
  nodeKind?: 'IRI' | 'Literal' | 'BlankNode';
}

// ─── Evidence & Provenance ───

export interface Evidence {
  source: string;        // data source identifier
  excerpt: string;       // relevant text/data snippet
  confidence: number;    // 0-1
  method: string;        // extraction method
  timestamp: number;
}

export interface CandidateChange {
  id: string;
  action: 'add' | 'modify' | 'remove';
  target: IRI;
  description: string;
  proposedElement: OwlClass | OwlProperty | Individual | Axiom;
  evidence: Evidence[];
  status: 'pending' | 'accepted' | 'rejected';
}

// ─── Competency Questions ───

export interface CompetencyQuestion {
  id: string;
  question: string;
  expectedAnswerType: string;
  relevantClasses: IRI[];
  relevantProperties: IRI[];
  sparqlQuery?: string;
}

// ─── Full Ontology Model ───

export interface OntologyModel {
  iri: string;
  versionIRI?: string;
  prefix: string;
  imports: string[];

  classes: OwlClass[];
  objectProperties: OwlObjectProperty[];
  dataProperties: OwlDataProperty[];
  annotationProperties: OwlAnnotationProperty[];
  individuals: Individual[];
  axioms: Axiom[];
  shaclShapes: ShaclShape[];

  candidateChanges: CandidateChange[];
  competencyQuestions: CompetencyQuestion[];

  metadata: OntologyMetadata;
}

export interface OntologyMetadata {
  title: string;
  description?: string;
  creator?: string;
  created: string;       // ISO 8601
  modified: string;      // ISO 8601
  version?: string;
  language?: string;
}

// ─── Ingestion Result (intermediate representation) ───

export interface IngestedSchema {
  source: string;
  type: 'structured' | 'semi-structured' | 'unstructured';
  tables?: TableSchema[];
  entities?: ExtractedEntity[];
  relations?: ExtractedRelation[];
  textSegments?: TextSegment[];
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  primaryKey?: string[];
  foreignKeys?: ForeignKey[];
  rowCount?: number;
}

export interface ColumnSchema {
  name: string;
  dataType: string;
  nullable: boolean;
  unique: boolean;
  sampleValues?: string[];
}

export interface ForeignKey {
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
}

export interface ExtractedEntity {
  name: string;
  type?: string;
  properties?: Record<string, string>;
  context?: string;
}

export interface ExtractedRelation {
  source: string;
  relation: string;
  target: string;
  confidence?: number;
  context?: string;
}

export interface TextSegment {
  heading?: string;
  content: string;
  page?: number;
  source?: string;
}
