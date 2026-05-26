import type {
  OntologyModel, OntologyMetadata, OwlClass, OwlObjectProperty, OwlDataProperty,
  Individual, IRI, Axiom, CandidateChange, CompetencyQuestion, ShaclShape,
  OwlAnnotationProperty,
} from './types.js';

/** Create an IRI from a namespace and local name */
export function makeIRI(namespace: string, local: string): IRI {
  return {
    full: namespace.endsWith('#') || namespace.endsWith('/') ? `${namespace}${local}` : `${namespace}#${local}`,
    local,
    namespace,
  };
}

/** Create an empty ontology model */
export function createOntology(iri: string, prefix: string, metadata: Partial<OntologyMetadata> = {}): OntologyModel {
  const now = new Date().toISOString();
  return {
    iri,
    prefix,
    imports: [],
    classes: [],
    objectProperties: [],
    dataProperties: [],
    annotationProperties: [],
    individuals: [],
    axioms: [],
    shaclShapes: [],
    candidateChanges: [],
    competencyQuestions: [],
    metadata: {
      title: metadata.title ?? prefix,
      description: metadata.description,
      creator: metadata.creator,
      created: metadata.created ?? now,
      modified: metadata.modified ?? now,
      version: metadata.version ?? '1.0.0',
      language: metadata.language ?? 'en',
    },
  };
}

/** Operations on an OntologyModel */
export class OntologyOperations {
  constructor(private model: OntologyModel) {}

  get raw(): OntologyModel { return this.model; }

  // ─── Class Operations ───

  addClass(cls: OwlClass): void {
    if (this.model.classes.some((c) => c.iri.full === cls.iri.full)) {
      throw new Error(`Class already exists: ${cls.iri.full}`);
    }
    this.model.classes.push(cls);
    this.touch();
  }

  findClass(localName: string): OwlClass | undefined {
    return this.model.classes.find((c) => c.iri.local === localName);
  }

  removeClass(iri: string): boolean {
    const idx = this.model.classes.findIndex((c) => c.iri.full === iri);
    if (idx === -1) return false;
    this.model.classes.splice(idx, 1);
    this.touch();
    return true;
  }

  // ─── Property Operations ───

  addObjectProperty(prop: OwlObjectProperty): void {
    if (this.model.objectProperties.some((p) => p.iri.full === prop.iri.full)) {
      throw new Error(`Object property already exists: ${prop.iri.full}`);
    }
    this.model.objectProperties.push(prop);
    this.touch();
  }

  addDataProperty(prop: OwlDataProperty): void {
    if (this.model.dataProperties.some((p) => p.iri.full === prop.iri.full)) {
      throw new Error(`Data property already exists: ${prop.iri.full}`);
    }
    this.model.dataProperties.push(prop);
    this.touch();
  }

  addAnnotationProperty(prop: OwlAnnotationProperty): void {
    this.model.annotationProperties.push(prop);
    this.touch();
  }

  // ─── Individual Operations ───

  addIndividual(ind: Individual): void {
    if (this.model.individuals.some((i) => i.iri.full === ind.iri.full)) {
      throw new Error(`Individual already exists: ${ind.iri.full}`);
    }
    this.model.individuals.push(ind);
    this.touch();
  }

  // ─── Axiom Operations ───

  addAxiom(axiom: Axiom): void {
    this.model.axioms.push(axiom);
    this.touch();
  }

  // ─── Candidate Changes ───

  addCandidateChange(change: CandidateChange): void {
    this.model.candidateChanges.push(change);
    this.touch();
  }

  acceptChange(id: string): boolean {
    const change = this.model.candidateChanges.find((c) => c.id === id);
    if (!change) return false;
    change.status = 'accepted';
    this.touch();
    return true;
  }

  rejectChange(id: string): boolean {
    const change = this.model.candidateChanges.find((c) => c.id === id);
    if (!change) return false;
    change.status = 'rejected';
    this.touch();
    return true;
  }

  // ─── SHACL ───

  addShaclShape(shape: ShaclShape): void {
    this.model.shaclShapes.push(shape);
    this.touch();
  }

  // ─── Competency Questions ───

  addCompetencyQuestion(cq: CompetencyQuestion): void {
    this.model.competencyQuestions.push(cq);
    this.touch();
  }

  // ─── Utilities ───

  /** Get all elements count */
  stats(): { classes: number; objectProperties: number; dataProperties: number; individuals: number; axioms: number } {
    return {
      classes: this.model.classes.length,
      objectProperties: this.model.objectProperties.length,
      dataProperties: this.model.dataProperties.length,
      individuals: this.model.individuals.length,
      axioms: this.model.axioms.length,
    };
  }

  private touch(): void {
    this.model.metadata.modified = new Date().toISOString();
  }
}
