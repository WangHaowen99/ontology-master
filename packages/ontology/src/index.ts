export type {
  IRI, Labelled, OwlClass, ClassExpression, OwlObjectProperty, OwlDataProperty,
  OwlAnnotationProperty, OwlProperty, PropertyCharacteristic, DataType, Individual,
  PropertyValue, DataValue, Restriction, Axiom, ShaclShape, ShaclPropertyConstraint,
  Evidence, CandidateChange, CompetencyQuestion, OntologyModel, OntologyMetadata,
  IngestedSchema, TableSchema, ColumnSchema, ForeignKey, ExtractedEntity,
  ExtractedRelation, TextSegment,
} from './types.js';
export { makeIRI, createOntology, OntologyOperations } from './model.js';
export { validateOntology } from './validators.js';
export type { ValidationResult, ValidationError, ValidationWarning } from './validators.js';
