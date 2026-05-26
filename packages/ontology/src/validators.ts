import type { OntologyModel, OwlClass } from './types.js';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  severity: 'error';
  message: string;
  element?: string; // IRI of the problematic element
}

export interface ValidationWarning {
  severity: 'warning';
  message: string;
  element?: string;
}

/** Basic OWL consistency checks (client-side, before sending to Python reasoner) */
export function validateOntology(model: OntologyModel): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check: all class superclasses exist
  const classIRIs = new Set(model.classes.map((c) => c.iri.full));
  for (const cls of model.classes) {
    for (const sup of cls.superClasses) {
      if (!classIRIs.has(sup.full) && !isBuiltInClass(sup.full)) {
        errors.push({
          severity: 'error',
          message: `Class "${cls.iri.local}" references non-existent superclass "${sup.local}"`,
          element: cls.iri.full,
        });
      }
    }
  }

  // Check: circular subclass chains
  const parentMap = new Map<string, string[]>();
  for (const cls of model.classes) {
    parentMap.set(cls.iri.full, cls.superClasses.map((s) => s.full));
  }
  for (const cls of model.classes) {
    if (hasCircularInheritance(cls.iri.full, parentMap, new Set())) {
      errors.push({
        severity: 'error',
        message: `Circular inheritance detected involving class "${cls.iri.local}"`,
        element: cls.iri.full,
      });
    }
  }

  // Check: classes without labels
  for (const cls of model.classes) {
    if (!cls.label || cls.label.trim() === '') {
      warnings.push({
        severity: 'warning',
        message: `Class "${cls.iri.local}" has no label`,
        element: cls.iri.full,
      });
    }
  }

  // Check: object properties with non-existent domain/range classes
  for (const prop of model.objectProperties) {
    for (const dom of prop.domain) {
      if (dom.kind === 'iri' && !classIRIs.has(dom.iri.full) && !isBuiltInClass(dom.iri.full)) {
        warnings.push({
          severity: 'warning',
          message: `Object property "${prop.iri.local}" domain references non-existent class "${dom.iri.local}"`,
          element: prop.iri.full,
        });
      }
    }
    for (const rng of prop.range) {
      if (rng.kind === 'iri' && !classIRIs.has(rng.iri.full) && !isBuiltInClass(rng.iri.full)) {
        warnings.push({
          severity: 'warning',
          message: `Object property "${prop.iri.local}" range references non-existent class "${rng.iri.local}"`,
          element: prop.iri.full,
        });
      }
    }
  }

  // Check: no classes defined
  if (model.classes.length === 0) {
    warnings.push({
      severity: 'warning',
      message: 'Ontology has no classes defined',
    });
  }

  // Check: duplicate IRIs
  const allIRIs = [
    ...model.classes.map((c) => c.iri.full),
    ...model.objectProperties.map((p) => p.iri.full),
    ...model.dataProperties.map((p) => p.iri.full),
    ...model.individuals.map((i) => i.iri.full),
  ];
  const seen = new Set<string>();
  for (const iri of allIRIs) {
    if (seen.has(iri)) {
      errors.push({
        severity: 'error',
        message: `Duplicate IRI: ${iri}`,
        element: iri,
      });
    }
    seen.add(iri);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function isBuiltInClass(iri: string): boolean {
  return iri === 'http://www.w3.org/2002/07/owl#Thing' || iri === 'owl:Thing'
    || iri === 'http://www.w3.org/2002/07/owl#Nothing' || iri === 'owl:Nothing';
}

function hasCircularInheritance(
  iri: string,
  parentMap: Map<string, string[]>,
  visited: Set<string>,
): boolean {
  if (visited.has(iri)) return true;
  visited.add(iri);
  const parents = parentMap.get(iri) ?? [];
  for (const parent of parents) {
    if (hasCircularInheritance(parent, parentMap, new Set(visited))) return true;
  }
  return false;
}
