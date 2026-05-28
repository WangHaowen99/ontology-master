import { useCallback, useEffect, useMemo, useState } from "react";
import type { ValidationResult } from "@om/ontology";
import type { ImportedSource } from "../data-import-view";
import type { ModelerMessage, OntologyClassNode, OntologyProperty, OntologyStats } from "../ontology-modeler-view";
import type { OwlExportFormat } from "../owl-export-view";
import {
  createEmptyOntologyWorkbenchState,
  type OntologyDatabaseConnectionInput,
  type OntologyImportFileInput,
  type OntologyPhaseRun,
  type OntologyWorkbenchState,
} from "../ontology-workbench-state";

export interface OntologyUiState {
  readonly sources: readonly ImportedSource[];
  readonly selectedSourceIds: readonly string[];
  readonly classes: readonly OntologyClassNode[];
  readonly properties: readonly OntologyProperty[];
  readonly stats: OntologyStats;
  readonly messages: readonly ModelerMessage[];
  readonly phaseRuns: readonly OntologyPhaseRun[];
  readonly modelingStatus: OntologyWorkbenchState["modelingStatus"];
  readonly activePhase: OntologyWorkbenchState["activePhase"];
  readonly isAgentRunning: boolean;
  readonly exportSummary: OntologyWorkbenchState["exportSummary"];
  readonly validationResult: { ok: boolean; messages: readonly string[] } | null;
  readonly isExporting: boolean;
  readonly isValidating: boolean;
  readonly isReasoning: boolean;
  readonly exportPreview: string | null;
  readonly lastError: string | null;
}

const EMPTY_STATS: OntologyStats = {
  classCount: 0,
  objectPropertyCount: 0,
  dataPropertyCount: 0,
  individualCount: 0,
  axiomCount: 0,
  title: "未命名本体",
  iri: "http://example.org/ontology",
};

export function useOntologyState() {
  const [workbenchState, setWorkbenchState] = useState<OntologyWorkbenchState>(createEmptyOntologyWorkbenchState);

  useEffect(() => {
    const api = window.piApp;
    if (!api) {
      return;
    }
    let cancelled = false;
    void api.getOntologyState().then((nextState) => {
      if (!cancelled) {
        setWorkbenchState(nextState);
      }
    });
    const unsubscribe = api.onOntologyStateChanged((nextState) => {
      setWorkbenchState(nextState);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const state = useMemo<OntologyUiState>(() => {
    const model = workbenchState.ontologyModel;
    const classes = model ? toClassNodes(model) : [];
    const properties = model ? toProperties(model) : [];
    return {
      sources: workbenchState.sources,
      selectedSourceIds: workbenchState.selectedSourceIds,
      classes,
      properties,
      stats: model
        ? {
            classCount: model.classes.length,
            objectPropertyCount: model.objectProperties.length,
            dataPropertyCount: model.dataProperties.length,
            individualCount: model.individuals.length,
            axiomCount: model.axioms.length,
            title: model.metadata.title,
            iri: model.iri,
          }
        : EMPTY_STATS,
      messages: workbenchState.messages,
      phaseRuns: workbenchState.phaseRuns,
      modelingStatus: workbenchState.modelingStatus,
      activePhase: workbenchState.activePhase,
      isAgentRunning: workbenchState.modelingStatus === "running",
      exportSummary: workbenchState.exportSummary,
      validationResult: toUiValidationResult(workbenchState.validationResult),
      isExporting: workbenchState.isExporting,
      isValidating: workbenchState.isValidating,
      isReasoning: workbenchState.isReasoning,
      exportPreview: workbenchState.exportPreview,
      lastError: workbenchState.lastError,
    };
  }, [workbenchState]);

  const importFiles = useCallback((files: FileList) => {
    const api = window.piApp;
    if (!api) {
      return;
    }
    const inputs: OntologyImportFileInput[] = Array.from(files).map((file) => ({
      name: file.name,
      path: api.getPathForFile(file),
      sizeBytes: file.size,
    }));
    void api.ontologyImportFiles(inputs).then(setWorkbenchState);
  }, []);

  const connectDatabase = useCallback((form: OntologyDatabaseConnectionInput) => {
    void window.piApp?.ontologyConnectDatabase(form).then(setWorkbenchState);
  }, []);

  const removeSource = useCallback((id: string) => {
    void window.piApp?.ontologyRemoveSource(id).then(setWorkbenchState);
  }, []);

  const selectSources = useCallback((ids: readonly string[]) => {
    void window.piApp?.ontologySelectSources(ids).then(setWorkbenchState);
  }, []);

  const sendToModeler = useCallback((ids: readonly string[]) => {
    void window.piApp?.ontologySelectSources(ids).then(setWorkbenchState);
  }, []);

  const sendMessage = useCallback((text: string) => {
    void window.piApp?.ontologySendMessage(text).then(setWorkbenchState);
  }, []);

  const runPipeline = useCallback((requirement?: string) => {
    void window.piApp?.ontologyRunPipeline(requirement).then(setWorkbenchState);
  }, []);

  const createClass = useCallback((name: string, superClassName?: string) => {
    void window.piApp?.ontologyCreateClass(name, superClassName).then(setWorkbenchState);
  }, []);

  const deleteClass = useCallback((iri: string) => {
    void window.piApp?.ontologyDeleteClass(iri).then(setWorkbenchState);
  }, []);

  const selectClass = useCallback((_iri: string) => {
    // Selection remains local to the modeler view.
  }, []);

  const exportOntology = useCallback((format: OwlExportFormat) => {
    void window.piApp?.ontologyExport(format).then(setWorkbenchState);
  }, []);

  const validateOntology = useCallback(() => {
    void window.piApp?.ontologyValidate().then(setWorkbenchState);
  }, []);

  const runReasoner = useCallback(() => {
    void window.piApp?.ontologyRunReasoner().then(setWorkbenchState);
  }, []);

  return {
    state,
    importFiles,
    connectDatabase,
    removeSource,
    selectSources,
    sendToModeler,
    sendMessage,
    runPipeline,
    createClass,
    deleteClass,
    selectClass,
    exportOntology,
    validateOntology,
    runReasoner,
  };
}

function toClassNodes(model: NonNullable<OntologyWorkbenchState["ontologyModel"]>): OntologyClassNode[] {
  return model.classes.map((cls) => {
    const childIris = model.classes
      .filter((candidate) => candidate.superClasses.some((superClass) => superClass.full === cls.iri.full))
      .map((candidate) => candidate.iri.full);
    return {
      iri: cls.iri.full,
      name: cls.label || cls.iri.local,
      description: cls.description,
      superClassIris: cls.superClasses.map((superClass) => superClass.full),
      childIris,
      propertyCount: countPropertiesForClass(model, cls.iri.full),
      individualCount: model.individuals.filter((individual) =>
        individual.classIRIs.some((classIri) => classIri.full === cls.iri.full),
      ).length,
    };
  });
}

function toProperties(model: NonNullable<OntologyWorkbenchState["ontologyModel"]>): OntologyProperty[] {
  const objectProperties: OntologyProperty[] = model.objectProperties.map((property) => {
    const domain = property.domain.find((item) => item.kind === "iri");
    const range = property.range.find((item) => item.kind === "iri");
    return {
      iri: property.iri.full,
      name: property.label || property.iri.local,
      kind: "object",
      domainName: domain?.kind === "iri" ? labelForClass(model, domain.iri.full) : "Thing",
      rangeName: range?.kind === "iri" ? labelForClass(model, range.iri.full) : "Thing",
      description: property.description,
    };
  });
  const dataProperties: OntologyProperty[] = model.dataProperties.map((property) => {
    const domain = property.domain.find((item) => item.kind === "iri");
    return {
      iri: property.iri.full,
      name: property.label || property.iri.local,
      kind: "data",
      domainName: domain?.kind === "iri" ? labelForClass(model, domain.iri.full) : "Thing",
      rangeName: property.range[0] ?? "xsd:string",
      description: property.description,
    };
  });
  return [...objectProperties, ...dataProperties];
}

function countPropertiesForClass(model: NonNullable<OntologyWorkbenchState["ontologyModel"]>, classIri: string): number {
  const objectCount = model.objectProperties.filter((property) =>
    property.domain.some((domain) => domain.kind === "iri" && domain.iri.full === classIri),
  ).length;
  const dataCount = model.dataProperties.filter((property) =>
    property.domain.some((domain) => domain.kind === "iri" && domain.iri.full === classIri),
  ).length;
  return objectCount + dataCount;
}

function labelForClass(model: NonNullable<OntologyWorkbenchState["ontologyModel"]>, iri: string): string {
  const cls = model.classes.find((item) => item.iri.full === iri);
  return cls?.label || cls?.iri.local || iri.split("#").pop() || iri;
}

function toUiValidationResult(result: ValidationResult | null): { ok: boolean; messages: readonly string[] } | null {
  if (!result) {
    return null;
  }
  return {
    ok: result.valid,
    messages: [
      ...result.errors.map((error) => error.message),
      ...result.warnings.map((warning) => warning.message),
    ],
  };
}
