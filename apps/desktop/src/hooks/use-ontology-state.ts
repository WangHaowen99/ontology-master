import { useCallback, useState } from "react";
import type { ImportedSource, DataSourceKind } from "../data-import-view";
import type { ModelerMessage, OntologyClassNode, OntologyProperty, OntologyStats } from "../ontology-modeler-view";
import type { OntologyExportSummary, OwlExportFormat } from "../owl-export-view";

export interface OntologyUiState {
  readonly sources: readonly ImportedSource[];
  readonly classes: readonly OntologyClassNode[];
  readonly properties: readonly OntologyProperty[];
  readonly stats: OntologyStats;
  readonly messages: readonly ModelerMessage[];
  readonly isAgentRunning: boolean;
  readonly exportSummary: OntologyExportSummary | null;
  readonly validationResult: { ok: boolean; messages: readonly string[] } | null;
  readonly isExporting: boolean;
  readonly isValidating: boolean;
  readonly isReasoning: boolean;
  readonly exportPreview: string | null;
}

const EMPTY_STATS: OntologyStats = {
  classCount: 0,
  objectPropertyCount: 0,
  dataPropertyCount: 0,
  individualCount: 0,
  axiomCount: 0,
  title: "Untitled Ontology",
  iri: "http://example.org/ontology",
};

const INITIAL_STATE: OntologyUiState = {
  sources: [],
  classes: [],
  properties: [],
  stats: EMPTY_STATS,
  messages: [],
  isAgentRunning: false,
  exportSummary: null,
  validationResult: null,
  isExporting: false,
  isValidating: false,
  isReasoning: false,
  exportPreview: null,
};

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}-${Date.now().toString(36)}`;
}

/**
 * Local ontology state manager.
 *
 * In a fully wired build, each of these handlers would call through
 * `window.piApp` to the Electron main process, which would delegate
 * to `@om/ingestion`, `@om/ontology`, `@om/modeler`, and the Python
 * `om_reasoner` backend. For now, this hook manages in-memory state
 * so the UI can be exercised end-to-end.
 */
export function useOntologyState() {
  const [state, setState] = useState<OntologyUiState>(INITIAL_STATE);

  const importFiles = useCallback((files: FileList) => {
    const newSources: ImportedSource[] = Array.from(files).map((file): ImportedSource => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const kindMap: Record<string, DataSourceKind> = {
        csv: "csv", tsv: "csv",
        xlsx: "excel", xls: "excel",
        json: "json", xml: "xml", yaml: "yaml", yml: "yaml",
        pdf: "pdf", docx: "docx",
        md: "markdown", markdown: "markdown",
        sqlite: "sqlite", db: "sqlite",
      };
      return {
        id: nextId("src"),
        name: file.name,
        kind: kindMap[ext] ?? "csv",
        sizeBytes: file.size,
        importedAt: new Date().toISOString(),
        tableCount: kindMap[ext] === "csv" || kindMap[ext] === "excel" ? 1 : 0,
        entityCount: 0,
        textSegmentCount: kindMap[ext] === "pdf" || kindMap[ext] === "docx" || kindMap[ext] === "markdown" ? 1 : 0,
        status: "ready",
      };
    });

    setState((prev) => ({ ...prev, sources: [...prev.sources, ...newSources] }));
  }, []);

  const connectDatabase = useCallback((form: { kind: string; host: string; port: string; database: string; filePath: string }) => {
    const source: ImportedSource = {
      id: nextId("db"),
      name: form.kind === "sqlite" ? form.filePath : `${form.host}:${form.port}/${form.database}`,
      kind: form.kind as DataSourceKind,
      sizeBytes: 0,
      importedAt: new Date().toISOString(),
      tableCount: 0,
      entityCount: 0,
      textSegmentCount: 0,
      status: "processing",
    };
    setState((prev) => ({ ...prev, sources: [...prev.sources, source] }));

    // Simulate schema discovery completion
    setTimeout(() => {
      setState((prev) => ({
        ...prev,
        sources: prev.sources.map((s) =>
          s.id === source.id ? { ...s, status: "ready" as const, tableCount: 3 } : s,
        ),
      }));
    }, 1500);
  }, []);

  const removeSource = useCallback((id: string) => {
    setState((prev) => ({ ...prev, sources: prev.sources.filter((s) => s.id !== id) }));
  }, []);

  const sendMessage = useCallback((text: string) => {
    const userMsg: ModelerMessage = {
      id: nextId("msg"),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString(),
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMsg],
      isAgentRunning: true,
    }));

    // Simulate agent response
    setTimeout(() => {
      const agentMsg: ModelerMessage = {
        id: nextId("msg"),
        role: "assistant",
        content: generateMockResponse(text),
        timestamp: new Date().toLocaleTimeString(),
        toolCalls: text.toLowerCase().includes("class")
          ? [{ name: "create_class", args: '{"name": "Person"}', result: "Created class \"Person\". Total classes: 1" }]
          : undefined,
      };

      setState((prev) => {
        const newClasses = text.toLowerCase().includes("class")
          ? [
              ...prev.classes,
              {
                iri: `http://example.org/ontology#Person${prev.classes.length}`,
                name: `Class${prev.classes.length + 1}`,
                description: "Auto-generated class",
                superClassIris: [],
                childIris: [],
                propertyCount: 0,
                individualCount: 0,
              },
            ]
          : prev.classes;

        return {
          ...prev,
          messages: [...prev.messages, agentMsg],
          isAgentRunning: false,
          classes: newClasses,
          stats: {
            ...prev.stats,
            classCount: newClasses.length,
          },
          exportSummary: newClasses.length > 0
            ? {
                title: prev.stats.title,
                iri: prev.stats.iri,
                classCount: newClasses.length,
                objectPropertyCount: prev.stats.objectPropertyCount,
                dataPropertyCount: prev.stats.dataPropertyCount,
                individualCount: prev.stats.individualCount,
                axiomCount: prev.stats.axiomCount,
                validationErrors: [],
                lastModified: new Date().toISOString(),
              }
            : null,
        };
      });
    }, 1200);
  }, []);

  const runPipeline = useCallback(() => {
    setState((prev) => ({ ...prev, isAgentRunning: true }));

    const pipelineSteps = [
      "Phase 1/6: Data quality pre-check...",
      "Phase 2/6: Domain interview...",
      "Phase 3/6: Generating competency questions...",
      "Phase 4/6: Extracting entities and relationships...",
      "Phase 5/6: Reviewing suggestions...",
      "Phase 6/6: Finalizing ontology...",
    ];

    let step = 0;
    const interval = setInterval(() => {
      if (step < pipelineSteps.length) {
        setState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: nextId("msg"),
              role: "system",
              content: pipelineSteps[step] ?? "",
              timestamp: new Date().toLocaleTimeString(),
            },
          ],
        }));
        step++;
      } else {
        clearInterval(interval);
        const demoClasses: OntologyClassNode[] = [
          { iri: "http://example.org/ontology#Thing", name: "Thing", description: "Root class", superClassIris: [], childIris: ["http://example.org/ontology#Person", "http://example.org/ontology#Organization"], propertyCount: 0, individualCount: 0 },
          { iri: "http://example.org/ontology#Person", name: "Person", description: "A human being", superClassIris: ["http://example.org/ontology#Thing"], childIris: [], propertyCount: 3, individualCount: 5 },
          { iri: "http://example.org/ontology#Organization", name: "Organization", description: "A group of people with a common purpose", superClassIris: ["http://example.org/ontology#Thing"], childIris: ["http://example.org/ontology#Company"], propertyCount: 2, individualCount: 3 },
          { iri: "http://example.org/ontology#Company", name: "Company", description: "A commercial organization", superClassIris: ["http://example.org/ontology#Organization"], childIris: [], propertyCount: 1, individualCount: 2 },
        ];
        const demoProperties: OntologyProperty[] = [
          { iri: "http://example.org/ontology#hasName", name: "hasName", kind: "data", domainName: "Person", rangeName: "xsd:string", description: "Full name of a person" },
          { iri: "http://example.org/ontology#hasAge", name: "hasAge", kind: "data", domainName: "Person", rangeName: "xsd:integer", description: "Age in years" },
          { iri: "http://example.org/ontology#worksFor", name: "worksFor", kind: "object", domainName: "Person", rangeName: "Organization", description: "Employment relationship" },
          { iri: "http://example.org/ontology#hasEmployee", name: "hasEmployee", kind: "object", domainName: "Organization", rangeName: "Person", description: "Inverse of worksFor" },
          { iri: "http://example.org/ontology#foundedIn", name: "foundedIn", kind: "data", domainName: "Company", rangeName: "xsd:date", description: "Date of founding" },
        ];

        setState((prev) => ({
          ...prev,
          classes: demoClasses,
          properties: demoProperties,
          stats: {
            title: "Generated Ontology",
            iri: "http://example.org/ontology",
            classCount: 4,
            objectPropertyCount: 2,
            dataPropertyCount: 3,
            individualCount: 10,
            axiomCount: 15,
          },
          isAgentRunning: false,
          messages: [
            ...prev.messages,
            {
              id: nextId("msg"),
              role: "assistant",
              content: "Ontology modeling pipeline complete. Generated 4 classes, 2 object properties, and 3 data properties. You can review the structure in the tree panel and export it as OWL.",
              timestamp: new Date().toLocaleTimeString(),
            },
          ],
          exportSummary: {
            title: "Generated Ontology",
            iri: "http://example.org/ontology",
            classCount: 4,
            objectPropertyCount: 2,
            dataPropertyCount: 3,
            individualCount: 10,
            axiomCount: 15,
            validationErrors: [],
            lastModified: new Date().toISOString(),
          },
        }));
      }
    }, 800);
  }, []);

  const createClass = useCallback((name: string, superClassName?: string) => {
    const iri = `http://example.org/ontology#${name}`;
    const superIri = superClassName ? `http://example.org/ontology#${superClassName}` : undefined;

    setState((prev) => {
      const newClass: OntologyClassNode = {
        iri,
        name,
        description: "",
        superClassIris: superIri ? [superIri] : [],
        childIris: [],
        propertyCount: 0,
        individualCount: 0,
      };
      const updatedClasses = prev.classes.map((c) =>
        c.iri === superIri ? { ...c, childIris: [...c.childIris, iri] } : c,
      );
      return {
        ...prev,
        classes: [...updatedClasses, newClass],
        stats: { ...prev.stats, classCount: prev.stats.classCount + 1 },
      };
    });
  }, []);

  const deleteClass = useCallback((iri: string) => {
    setState((prev) => ({
      ...prev,
      classes: prev.classes
        .filter((c) => c.iri !== iri)
        .map((c) => ({
          ...c,
          childIris: c.childIris.filter((x: string) => x !== iri),
          superClassIris: c.superClassIris.filter((x: string) => x !== iri),
        })),
      properties: prev.properties.filter((p) => {
        const cls = prev.classes.find((c) => c.iri === iri);
        return cls ? p.domainName !== cls.name : true;
      }),
      stats: { ...prev.stats, classCount: Math.max(0, prev.stats.classCount - 1) },
    }));
  }, []);

  const selectClass = useCallback((_iri: string) => {
    // Tracked by local state in the view
  }, []);

  const exportOntology = useCallback((_format: OwlExportFormat) => {
    setState((prev) => ({ ...prev, isExporting: true }));
    setTimeout(() => {
      setState((prev) => ({
        ...prev,
        isExporting: false,
        exportPreview: generateTurtlePreview(prev.classes, prev.properties),
      }));
    }, 1000);
  }, []);

  const validateOntology = useCallback(() => {
    setState((prev) => ({ ...prev, isValidating: true }));
    setTimeout(() => {
      setState((prev) => ({
        ...prev,
        isValidating: false,
        validationResult: { ok: true, messages: ["No SHACL violations detected.", "All class hierarchies are acyclic.", "All property domains and ranges reference existing classes."] },
      }));
    }, 1200);
  }, []);

  const runReasoner = useCallback(() => {
    setState((prev) => ({ ...prev, isReasoning: true }));
    setTimeout(() => {
      setState((prev) => ({
        ...prev,
        isReasoning: false,
        validationResult: { ok: true, messages: ["Reasoning complete. Ontology is consistent.", "No unsatisfiable classes found."] },
      }));
    }, 1500);
  }, []);

  return {
    state,
    importFiles,
    connectDatabase,
    removeSource,
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

function generateMockResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("class") || lower.includes("suggest")) {
    return "Based on your data sources, I suggest starting with these core classes: Person, Organization, and Event. Would you like me to create them and define their properties?";
  }
  if (lower.includes("competency") || lower.includes("question")) {
    return "Here are some competency questions for this domain:\n1. Who works for which organization?\n2. What events occurred in a given time period?\n3. Which people are associated with a specific project?";
  }
  if (lower.includes("pipeline") || lower.includes("run")) {
    return "Starting the full ontology modeling pipeline. This will run through 6 phases: pre-check, interview, competency questions, extraction, review, and finalization.";
  }
  return "I understand. Let me analyze the available data and help you build the ontology. What specific aspects of the domain would you like to focus on?";
}

function generateTurtlePreview(classes: readonly OntologyClassNode[], properties: readonly OntologyProperty[]): string {
  const lines = [
    "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
    "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
    "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
    "@prefix : <http://example.org/ontology#> .",
    "",
    "<http://example.org/ontology> a owl:Ontology ;",
    '    rdfs:label "Generated Ontology" .',
    "",
  ];

  for (const cls of classes) {
    lines.push(`:${cls.name} a owl:Class ;`);
    if (cls.superClassIris.length > 0) {
      const superNames = cls.superClassIris.map((iri: string) => `:${iri.split("#").pop()}`);
      lines.push(`    rdfs:subClassOf ${superNames.join(", ")} ;`);
    }
    lines.push(`    rdfs:label "${cls.name}" .`);
    lines.push("");
  }

  for (const prop of properties) {
    if (prop.kind === "object") {
      lines.push(`:${prop.name} a owl:ObjectProperty ;`);
    } else {
      lines.push(`:${prop.name} a owl:DatatypeProperty ;`);
    }
    lines.push(`    rdfs:domain :${prop.domainName} ;`);
    lines.push(`    rdfs:range ${prop.kind === "data" && prop.rangeName.startsWith("xsd:") ? prop.rangeName : `:${prop.rangeName}`} ;`);
    lines.push(`    rdfs:label "${prop.name}" .`);
    lines.push("");
  }

  return lines.join("\n");
}
