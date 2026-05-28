# 本体工作台 pi agent 接入设计

## 背景

本项目已经有 `DataImportView`、`OntologyModelerView`、`OwlExportView` 三个桌面端本体工作台页面，也有 `@om/ontology`、`@om/ingestion`、`@om/modeler` 和 Python reasoner 等领域包。当前桌面端本体页面主要依赖前端内存模拟，`@om/modeler` 直接调用 OpenAI-compatible API，没有通过 pi agent。

本轮功能完善的核心要求是：

- 本体建模必须通过 pi agent 执行。
- 页面交互逻辑要连贯，导入、建模、验证、导出要形成清晰闭环。
- 本体工作台相关页面文字全部使用中文。
- 样式保持当前 pi-gui 风格，并尽量向 macOS 桌面应用靠拢。
- 本轮优先完成中文交互闭环和 pi agent 建模接入，真实导入、验证、导出能力可以通过清晰接口逐步替换增强。

## 目标

1. 保留当前三个本体入口，但把它们组织成连续工作流：数据导入、pi agent 本体建模、验证与导出。
2. 用 pi agent 会话承载本体建模请求，禁止建模核心逻辑绕过 pi agent 直接请求模型。
3. 将 `@om/modeler` 从“直接模型调用层”调整为“建模提示词、输出协议、结果解析、模型转换”的领域层。
4. 建立可替换的桌面 IPC 边界，让后续真实数据摄入、agent custom tools、Python reasoner 导出都能接入。
5. 将本体工作台 UI 文案中文化，并完善空态、运行态、失败态、完成态。
6. 在视觉上延续当前浅色、紧凑、分栏、细边框的桌面风格，避免营销化或大卡片化页面。

## 非目标

- 本轮不要求完成 pi agent custom tools 深度接入。
- 本轮不要求所有导入格式都真实解析并持久化。
- 本轮不要求通过 Electron save dialog 真正落盘导出。
- 本轮不全量翻译 pi-gui 原有通用会话、设置、技能、扩展页面。
- 本轮不重做整体信息架构或品牌视觉。

## 用户工作流

### 数据导入

用户进入“数据导入”页面后，可以拖入文件、浏览选择文件或填写数据库连接。页面展示数据源列表，每个数据源有中文状态：

- 已就绪
- 处理中
- 失败

未导入数据时显示空态：“拖入文件或连接数据库，开始构建本体”。用户至少选择一个已就绪数据源后，主按钮显示“发送到建模（N）”。点击后记录 `selectedSourceIds`，跳转到“本体建模”页面。

### 本体建模

建模页根据状态显示不同内容：

- 没有已选数据源：提示“请先导入数据”，提供“去导入数据”按钮。
- 有数据源但未启动：显示数据源摘要和“开始建模”按钮。
- 运行中：顶部阶段条高亮当前阶段，主按钮显示“建模中…”，允许用户追加中文建模要求。
- 等待审查：展示 pi agent 生成的本体结构和说明，提示用户检查。
- 已完成：展示类、对象属性、数据属性、个体、能力问题等统计，并允许进入导出页。
- 失败：显示中文错误、可重试入口，并保留 pi agent 原始输出。

建模阶段为：

1. 数据预检
2. 建模访谈
3. 能力问题
4. 实体抽取
5. 专家审查
6. 本体定稿

### 验证与导出

导出页根据状态显示：

- 没有本体：显示“暂无可导出的本体”，提供“返回建模”入口。
- 有本体但未验证：提示“建议先运行验证”。
- 验证中：显示“验证中…”并禁用重复操作。
- 验证通过：允许预览和导出。
- 验证失败：禁用导出，显示问题清单。

本轮导出行为可以先生成前端预览；后续再通过 Electron main 接 Python reasoner 或保存文件对话框。

## 状态设计

新增或重构本体工作台状态为 `OntologyWorkbenchState`，建议包含：

```ts
export interface OntologyWorkbenchState {
  readonly sources: readonly ImportedSource[];
  readonly selectedSourceIds: readonly string[];
  readonly modelingSessionRef: { readonly workspaceId: string; readonly sessionId: string } | null;
  readonly modelingStatus: "idle" | "ready" | "running" | "waitingReview" | "completed" | "failed";
  readonly activePhase: OntologyPhaseId | null;
  readonly phaseRuns: readonly OntologyPhaseRun[];
  readonly agentMessages: readonly ModelerMessage[];
  readonly ontologyModel: OntologyModel | null;
  readonly validationResult: ValidationResult | null;
  readonly exportPreview: string | null;
  readonly lastError: string | null;
}
```

`OntologyPhaseRun` 记录阶段 id、中文名称、状态、开始时间、结束时间、摘要和错误。React 组件只读取状态并触发动作，不直接调用模型 API。

## 组件设计

### DataImportView

职责：

- 展示文件导入和数据库连接入口。
- 展示数据源列表和中文状态。
- 管理选择参与建模的数据源。
- 禁止发送处理中或失败的数据源。
- 调用 `onSendToModeler(ids)` 后跳转到建模页。

需要中文化的内容包括标题、说明、tab、按钮、空态、状态、表单字段、错误提示。

### OntologyModelerView

职责：

- 展示建模阶段条、数据源摘要、pi agent 消息流、本体结构树、详情面板。
- 触发 `onStartModeling()`，由 Electron main 创建或复用 pi agent 会话。
- 触发 `onSendModelingMessage(text)`，向同一个 pi agent 会话追加要求。
- 展示 pi agent 运行态、失败态、可解析本体结果和未解析原始输出。

页面结构保留三栏：

- 左侧：类、属性、个体列表。
- 中央：阶段进度和 pi agent 对话。
- 右侧：选中类或属性详情。

### OwlExportView

职责：

- 展示当前本体摘要。
- 触发验证、推理、预览、导出。
- 根据验证状态控制导出按钮。
- 使用中文格式说明和状态反馈。

### useOntologyState

职责从“模拟状态生成器”改为“前端工作流编排层”：

- 调用窄 IPC 获取和订阅本体工作台状态。
- 调用窄 IPC 导入数据、发送到建模、启动 pi agent 建模、追加建模消息、验证和导出。
- 保持 React 页面和 Electron main 的边界清晰。

## pi agent 接入设计

建模必须通过已有 `PiSdkDriver` / `SessionDriver`：

1. Electron main 检查当前 workspace。
2. 若没有本体建模会话，通过 `store.driver.createSession(...)` 创建标题为“本体建模”的 pi agent 会话。
3. 组装中文建模任务提示，包含数据源摘要、阶段目标、命名规范、输出协议。
4. 通过 `store.driver.sendUserMessage(sessionRef, { text })` 发送给 pi agent。
5. 订阅会话事件，将 pi agent 输出映射为 `agentMessages`、`phaseRuns` 和 `modelingStatus`。
6. 从 pi agent 输出解析结构化本体结果，转换成 `@om/ontology` 的 `OntologyModel`。

`@om/modeler` 不再负责直接请求模型。它应提供：

- 中文建模任务提示构建。
- 阶段提示构建。
- `ontology-json` 输出协议定义。
- `ontology-json` 解析。
- 解析结果到 `OntologyModel` 的转换。

## 输出协议

本轮使用可解析 JSON 块作为 pi agent 输出协议。建模任务提示要求 pi agent 在回答末尾输出：

````text
```ontology-json
{
  "title": "中文本体名称",
  "iri": "http://example.org/ontology",
  "classes": [],
  "objectProperties": [],
  "dataProperties": [],
  "individuals": [],
  "competencyQuestions": [],
  "notes": []
}
```
````

如果解析成功，页面更新本体树、属性列表、统计和导出摘要。如果解析失败，保留原始 pi agent 输出，并显示“未检测到可解析本体结果”。

后续增强可将协议升级为 pi agent custom tools：

- `create_class`
- `create_object_property`
- `create_data_property`
- `create_individual`
- `add_competency_question`
- `get_ingested_schema`
- `validate_current_ontology`

## 中文文案原则

- 本体工作台相关 UI 全部中文。
- 按钮短句优先，例如“开始建模”“发送到建模”“运行验证”“预览 Turtle”。
- 状态文案要可执行，例如“请选择参与建模的数据源”，而不是泛泛描述。
- Agent 提示词使用中文，要求生成中文 label 和 description。
- 侧边栏三个本体入口改为“数据导入”“本体建模”“OWL 导出”。

## 视觉规则

- 保留当前 pi-gui 的浅色窗口、白色面板、细边框、轻阴影。
- 保持 conversation-first，不把建模页做成泛 dashboard。
- 分栏紧凑，树节点、消息、详情面板都要便于扫描。
- 圆角控制在当前 8-10px 附近。
- 阶段条采用轻量 stepper 或 segmented 风格。
- 避免大面积渐变、装饰图形、营销式 hero。
- 中文按钮和标签不得溢出，必要时缩短文案。

## 验证计划

1. 运行 TypeScript 构建或 typecheck。
2. 能跑的包级测试应继续通过。
3. 启动 Electron 开发界面验证本体三页。
4. 用 Playwright 或截图检查：
   - 数据导入、建模、导出页面无文本重叠。
   - 本体工作台文案为中文。
   - 建模动作通过 pi agent 会话触发。
   - 无数据、运行中、失败、完成状态显示合理。

## 风险与缓解

- pi agent 输出不稳定：使用明确 `ontology-json` 块，并在解析失败时保留原文和错误状态。
- 会话事件和本体状态不同步：Electron main 维护单一 `OntologyWorkbenchState`，前端只订阅状态。
- 后续 custom tools 范围过大：本轮先通过 pi agent 消息协议跑通，下一阶段再做工具级写入。
- 当前 `@om/modeler` 直接请求模型：本轮实现时需要调整为领域协议层，避免继续绕过 pi agent。
