# 本体建模大师 Desktop

AI 驱动的 OWL 本体建模桌面工具。基于 [pi-gui](https://github.com/minghinmatthewlam/pi-gui) 桌面框架，支持读取多源数据并通过 AI Agent 输出标准 OWL 格式本体模型。

## 特性

- **pi-gui 完整桌面 GUI** — 复用 pi-gui 的会话管理、模型切换、对话界面、终端集成、技能系统
- **多源数据摄入** — PostgreSQL、MySQL、SQLite、CSV、Excel、JSON、XML、YAML、PDF、DOCX、Markdown
- **AI 本体建模** — 基于 pi-agent 的 6 阶段建模流水线（预检 → 访谈 → 能力问题 → 抽取 → 审查 → 定稿）
- **多模型支持** — DeepSeek、Claude、OpenAI 等，通过 pi-gui Settings 切换
- **OWL 导出** — Turtle (.ttl)、RDF/XML、OWL/XML、JSON-LD（Python owlready2/rdflib 后端）
- **SHACL 验证** — 本体一致性和形状校验
- **CLI 工具** — 命令行批量处理

## 架构

```
ontology-master/
├── apps/
│   └── desktop/              pi-gui Electron 桌面应用（完整复用）
├── packages/
│   ├── session-driver/       pi-gui 会话驱动类型（复用）
│   ├── catalogs/             pi-gui 工作区目录状态（复用）
│   ├── pi-sdk-driver/        pi-gui → pi-coding-agent 桥接（复用）
│   ├── ontology/             @om/ontology — OWL 2 领域类型系统
│   ├── ingestion/            @om/ingestion — 多源数据摄入管道
│   ├── modeler/              @om/modeler — AI 本体建模流水线
│   └── store/                @om/store — SQLite 持久化
├── apps/cli/                 CLI 工具
├── python/
│   └── om_reasoner/          FastAPI + owlready2 + rdflib 推理服务
└── data/examples/            示例数据
```

## 快速开始

### 前置条件

- Node.js >= 20.0.0
- pnpm >= 10.0.0
- Python >= 3.11

### 安装

```bash
corepack enable
pnpm install

# Python 推理服务
cd python && pip install -r requirements.txt
```

### 开发

```bash
# 启动桌面应用
pnpm dev

# 启动 Python 推理服务（另一个终端）
pnpm dev:python
```

### CLI 使用

```bash
# 从 CSV 生成本体
pnpm om:import data/examples/sample.csv --export turtle

# 验证本体模型
pnpm om:validate model.json
```

### 构建打包

```bash
# 构建所有包
pnpm build

# 打包 Linux AppImage
pnpm package:linux
```

## 使用方式

1. 启动桌面应用 (`pnpm dev`)
2. 在 Settings > Providers 中配置 AI 模型（DeepSeek / Claude / OpenAI）
3. 打开一个工作区（包含你的数据文件的目录）
4. 创建新会话，输入类似 "分析这些 CSV 文件并生成 OWL 本体模型"
5. Agent 会自动读取数据、分析结构、生成本体
6. 使用 Python 推理服务导出 OWL 文件

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | pi-gui (Electron 34 + React 19 + Vite 6) |
| Agent 运行时 | @earendil-works/pi-coding-agent |
| 本体类型 | @om/ontology (OWL 2 全集) |
| 数据摄入 | csv-parse, xlsx, pdf-parse, mammoth, cheerio |
| 推理引擎 | owlready2 + rdflib (Python FastAPI) |
| 持久化 | better-sqlite3 (WAL) |

## 致谢

- [pi-gui](https://github.com/minghinmatthewlam/pi-gui) — Electron desktop shell
- [pi-mono](https://github.com/earendil-works/pi) — Agent runtime by earendil-works

## 许可证

MIT
