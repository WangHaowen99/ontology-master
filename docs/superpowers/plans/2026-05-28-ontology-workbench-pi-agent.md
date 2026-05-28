# Ontology Workbench Pi Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chinese ontology workbench flow where modeling requests are executed through pi agent sessions and parsed into the desktop ontology UI.

**Architecture:** Move ontology modeling orchestration behind a narrow Electron IPC boundary. `@om/modeler` provides pi-agent prompt and `ontology-json` parsing utilities; Electron main owns pi agent session creation and state updates; React renders Chinese import, modeling, and export states.

**Tech Stack:** TypeScript, React 19, Electron IPC, `@pi-gui/pi-sdk-driver`, `@om/ontology`, Vitest, Playwright.

---

## File Structure

- Create `packages/modeler/src/pi-agent-protocol.ts`: prompt builder, `ontology-json` extractor, parser, and `OntologyModel` converter.
- Create `packages/modeler/src/__tests__/pi-agent-protocol.test.ts`: TDD coverage for prompt text, JSON extraction, parsing, and conversion.
- Modify `packages/modeler/src/index.ts`: export protocol helpers.
- Create `apps/desktop/src/ontology-workbench-state.ts`: shared renderer/main types for sources, phases, messages, and workbench state.
- Create `apps/desktop/electron/ontology-workbench-store.ts`: Electron-side state machine, source registration, pi agent session creation, message sending, transcript parsing, validation, preview.
- Modify `apps/desktop/electron/app-store.ts`: instantiate and expose ontology store, forward session events.
- Modify `apps/desktop/electron/main.ts`: register ontology IPC handlers and publish ontology state changes.
- Modify `apps/desktop/src/ipc.ts`: type and expose ontology APIs.
- Modify `apps/desktop/electron/preload.ts`: bridge ontology APIs to renderer.
- Modify `apps/desktop/src/global.d.ts`: include ontology APIs through `PiDesktopApi`.
- Modify `apps/desktop/src/hooks/use-ontology-state.ts`: consume IPC state instead of local mock pipeline.
- Modify `apps/desktop/src/data-import-view.tsx`: Chinese copy, file path extraction, ready/processing/failed selection logic.
- Modify `apps/desktop/src/ontology-modeler-view.tsx`: Chinese copy, phase stepper, source-gated start, pi agent status, parsed result display.
- Modify `apps/desktop/src/owl-export-view.tsx`: Chinese copy and validation/export gating.
- Modify `apps/desktop/src/sidebar.tsx`: Chinese ontology nav labels.
- Modify `apps/desktop/src/styles/ontology.css`: compact mac-style phase and state styles.
- Create or modify focused desktop tests if practical after implementation; otherwise use typecheck and targeted package tests as minimum verification.

## Task 1: Modeler Pi Agent Protocol

**Files:**
- Create: `packages/modeler/src/pi-agent-protocol.ts`
- Create: `packages/modeler/src/__tests__/pi-agent-protocol.test.ts`
- Modify: `packages/modeler/src/index.ts`

- [ ] **Step 1: Write failing tests**

Add `packages/modeler/src/__tests__/pi-agent-protocol.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  buildPiAgentModelingPrompt,
  convertProtocolResultToOntology,
  extractOntologyJsonBlock,
  parseOntologyJsonBlock,
} from "../pi-agent-protocol.js";

describe("pi agent ontology protocol", () => {
  test("builds a Chinese prompt that requires pi agent ontology-json output", () => {
    const prompt = buildPiAgentModelingPrompt({
      phase: "extract",
      sources: [
        {
          id: "src-1",
          name: "客户.csv",
          kind: "csv",
          summary: "1 个表，字段：客户ID、客户名称",
        },
      ],
      userRequirement: "重点建模客户和订单关系",
    });

    expect(prompt).toContain("你正在通过 pi agent 执行本体建模");
    expect(prompt).toContain("客户.csv");
    expect(prompt).toContain("重点建模客户和订单关系");
    expect(prompt).toContain("```ontology-json");
    expect(prompt).toContain("中文 label");
  });

  test("extracts the last ontology-json fenced block", () => {
    const text = [
      "说明文字",
      "```ontology-json",
      "{\"title\":\"旧结果\"}",
      "```",
      "更多说明",
      "```ontology-json",
      "{\"title\":\"客户本体\",\"iri\":\"http://example.org/customer\",\"classes\":[]}",
      "```",
    ].join("\n");

    expect(extractOntologyJsonBlock(text)).toBe(
      "{\"title\":\"客户本体\",\"iri\":\"http://example.org/customer\",\"classes\":[]}",
    );
  });

  test("parses ontology-json and converts it to an ontology model", () => {
    const parsed = parseOntologyJsonBlock(`{
      "title": "客户订单本体",
      "iri": "http://example.org/customer-order",
      "classes": [
        { "name": "Customer", "label": "客户", "description": "购买商品或服务的主体" },
        { "name": "Order", "label": "订单", "description": "客户发起的交易记录" }
      ],
      "objectProperties": [
        {
          "name": "placesOrder",
          "label": "下单",
          "description": "客户创建订单",
          "domain": "Customer",
          "range": "Order"
        }
      ],
      "dataProperties": [
        {
          "name": "hasName",
          "label": "名称",
          "description": "客户名称",
          "domain": "Customer",
          "range": "xsd:string"
        }
      ],
      "competencyQuestions": [
        { "question": "某个客户有哪些订单？", "expectedAnswerType": "Order" }
      ]
    }`);

    const model = convertProtocolResultToOntology(parsed);

    expect(model.metadata.title).toBe("客户订单本体");
    expect(model.metadata.language).toBe("zh");
    expect(model.classes.map((item) => item.iri.local)).toEqual(["Customer", "Order"]);
    expect(model.classes[0]?.labels?.zh).toBe("客户");
    expect(model.objectProperties[0]?.domain[0]).toMatchObject({ kind: "iri", iri: { local: "Customer" } });
    expect(model.dataProperties[0]?.range).toEqual(["xsd:string"]);
    expect(model.competencyQuestions[0]?.question).toBe("某个客户有哪些订单？");
  });

  test("throws a useful error when ontology-json is missing required fields", () => {
    expect(() => parseOntologyJsonBlock("{\"classes\":[]}")).toThrow("ontology-json 缺少 title");
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @om/modeler test -- --run packages/modeler/src/__tests__/pi-agent-protocol.test.ts`

Expected: FAIL because the new protocol module is missing.

- [ ] **Step 3: Implement protocol helpers**

Add `packages/modeler/src/pi-agent-protocol.ts` with exported helpers used by the test. The implementation should validate required fields, normalize optional arrays, create IRIs with `createOntology` and `makeIRI`, and use zh labels.

- [ ] **Step 4: Export helpers**

Modify `packages/modeler/src/index.ts`:

```ts
export {
  buildPiAgentModelingPrompt,
  convertProtocolResultToOntology,
  extractOntologyJsonBlock,
  parseOntologyJsonBlock,
} from "./pi-agent-protocol.js";
export type {
  PiAgentModelingPhase,
  PiAgentModelingPromptSource,
  PiAgentOntologyJson,
} from "./pi-agent-protocol.js";
```

- [ ] **Step 5: Run tests and verify GREEN**

Run: `pnpm --filter @om/modeler test -- --run packages/modeler/src/__tests__/pi-agent-protocol.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/modeler/src/pi-agent-protocol.ts packages/modeler/src/__tests__/pi-agent-protocol.test.ts packages/modeler/src/index.ts
git commit -m "feat(modeler): add pi agent ontology protocol"
```

## Task 2: Desktop Ontology Workbench State and IPC

**Files:**
- Create: `apps/desktop/src/ontology-workbench-state.ts`
- Create: `apps/desktop/electron/ontology-workbench-store.ts`
- Modify: `apps/desktop/electron/app-store.ts`
- Modify: `apps/desktop/electron/main.ts`
- Modify: `apps/desktop/src/ipc.ts`
- Modify: `apps/desktop/electron/preload.ts`

- [ ] **Step 1: Write failing type-level behavior by compiling after references**

Add the shared state and use it in IPC signatures before implementing the store. Run typecheck to see missing methods.

- [ ] **Step 2: Create shared state types**

Add `apps/desktop/src/ontology-workbench-state.ts` with source, phase, message, validation, export, and `OntologyWorkbenchState` interfaces. Include `createEmptyOntologyWorkbenchState()`, phase ids, Chinese phase labels, and helper `getReadySelectedSourceIds(state)`.

- [ ] **Step 3: Implement Electron ontology store**

Create `apps/desktop/electron/ontology-workbench-store.ts`. It should:

- Hold `OntologyWorkbenchState`.
- Register file sources from `{ name, path, sizeBytes }`.
- Track selected source ids.
- Create or reuse a pi agent session titled “本体建模”.
- Build prompt via `buildPiAgentModelingPrompt`.
- Send prompt through `appStore.driver.sendUserMessage(sessionRef, { text })`.
- Listen to forwarded `SessionDriverEvent` and update running/completed/failed state.
- Parse the selected session transcript with `extractOntologyJsonBlock`, `parseOntologyJsonBlock`, and `convertProtocolResultToOntology`.
- Provide validation and Turtle preview fallback from the parsed model.

- [ ] **Step 4: Wire DesktopAppStore**

Modify `apps/desktop/electron/app-store.ts` to instantiate `OntologyWorkbenchStore`, expose `getOntologyWorkbench()`, and call `ontologyWorkbench.handleSessionEvent(event)` inside `handleSessionEvent`.

- [ ] **Step 5: Wire IPC channels**

Modify `apps/desktop/src/ipc.ts` to add typed APIs:

- `getOntologyState()`
- `onOntologyStateChanged(listener)`
- `ontologyImportFiles(files)`
- `ontologySelectSources(ids)`
- `ontologyStartModeling(requirement?)`
- `ontologySendModelingMessage(text)`
- `ontologyCreateClass(name, superClassName?)`
- `ontologyDeleteClass(iri)`
- `ontologyValidate()`
- `ontologyExport(format)`
- `ontologyRunReasoner()`

Modify `apps/desktop/electron/main.ts` to register handlers and publish `ontologyStateChanged`.

Modify `apps/desktop/electron/preload.ts` to expose those methods.

- [ ] **Step 6: Run typecheck**

Run: `pnpm --filter @pi-gui/desktop typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/ontology-workbench-state.ts apps/desktop/electron/ontology-workbench-store.ts apps/desktop/electron/app-store.ts apps/desktop/electron/main.ts apps/desktop/src/ipc.ts apps/desktop/electron/preload.ts
git commit -m "feat(desktop): add ontology workbench pi agent state"
```

## Task 3: Renderer Hook and Chinese Workflow UI

**Files:**
- Modify: `apps/desktop/src/hooks/use-ontology-state.ts`
- Modify: `apps/desktop/src/data-import-view.tsx`
- Modify: `apps/desktop/src/ontology-modeler-view.tsx`
- Modify: `apps/desktop/src/owl-export-view.tsx`
- Modify: `apps/desktop/src/sidebar.tsx`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/styles/ontology.css`

- [ ] **Step 1: Replace mock hook with IPC hook**

Modify `useOntologyState` to load `window.piApp.getOntologyState()`, subscribe with `onOntologyStateChanged`, and delegate actions to ontology IPC methods. Keep no local mock pipeline.

- [ ] **Step 2: Chinese data import page**

Translate all visible strings in `DataImportView`, use `window.piApp.getPathForFile(file)` via the hook path conversion, disable “发送到建模” unless ready sources are selected, and show Chinese status labels.

- [ ] **Step 3: Chinese pi agent modeler page**

Translate all visible strings in `OntologyModelerView`. Add phase stepper, selected source summary, “开始建模”, “补充要求”, “去导入数据”, “进入导出” actions, and explicit parsed/failed/no-result states.

- [ ] **Step 4: Chinese export page**

Translate all visible strings in `OwlExportView`, use validation/export state from IPC, and gate export by validation errors.

- [ ] **Step 5: Sidebar labels and App wiring**

Change ontology nav labels to “数据导入”“本体建模”“OWL 导出”. Pass navigation callbacks from `App.tsx` into ontology pages where needed.

- [ ] **Step 6: Style mac-like workflow states**

Update `ontology.css` for phase stepper, source summary, compact status badges, and responsive Chinese text.

- [ ] **Step 7: Run typecheck**

Run: `pnpm --filter @pi-gui/desktop typecheck`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/hooks/use-ontology-state.ts apps/desktop/src/data-import-view.tsx apps/desktop/src/ontology-modeler-view.tsx apps/desktop/src/owl-export-view.tsx apps/desktop/src/sidebar.tsx apps/desktop/src/App.tsx apps/desktop/src/styles/ontology.css
git commit -m "feat(desktop): localize ontology workbench flow"
```

## Task 4: Verification and Documentation

**Files:**
- Modify: `README.zh-CN.md` if command behavior changes need documenting.

- [ ] **Step 1: Run modeler tests**

Run: `pnpm --filter @om/modeler test -- --run packages/modeler/src/__tests__/pi-agent-protocol.test.ts`

Expected: PASS.

- [ ] **Step 2: Run desktop typecheck**

Run: `pnpm --filter @pi-gui/desktop typecheck`

Expected: PASS.

- [ ] **Step 3: Run focused build if typecheck passes**

Run: `pnpm --filter @pi-gui/desktop build`

Expected: PASS, unless environment lacks native build dependencies. If it fails for environment reasons, record the exact failure.

- [ ] **Step 4: Start Electron dev server for manual verification**

Run: `pnpm dev`

Expected: Electron dev process starts. Verify the URL/process logs and stop the process before final response if not needed.

- [ ] **Step 5: Final status**

Summarize implemented files, commits, verification output, and any remaining limitations such as custom tools being deferred.
