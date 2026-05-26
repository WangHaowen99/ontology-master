# 本体建模大师 Desktop

AI 驱动的 OWL 本体建模桌面工具，支持读取结构化、半结构化、非结构化数据，通过 AI Agent 自动完成本体建模流水线，输出标准 OWL 格式本体模型。

## 特性

- **多源数据摄入**：支持 PostgreSQL、MySQL、SQLite、CSV、Excel（结构化）、JSON、XML、YAML（半结构化）、PDF、DOCX、Markdown（非结构化）
- **AI 驱动建模**：基于 pi-agent 框架的 6 阶段本体建模流水线（预检 → 访谈 → 能力问题 → 抽取 → 审查 → 定稿）
- **多模型支持**：DeepSeek、Claude (Anthropic)、OpenAI 等多 LLM 可切换
- **OWL 导出**：Turtle (.ttl)、RDF/XML (.owl)、OWL/XML (.owl)、JSON-LD (.jsonld)
- **混合架构**：TypeScript 前端 + Python (owlready2/rdflib) 推理后端
- **可视化工作台**：本体图谱可视化、交互式编辑、Agent 对话面板
- **CLI 工具**：命令行批量处理、自动化流水线

## 快速开始

### 前置条件

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Python >= 3.11

### 安装

```bash
# 安装前端依赖
pnpm install

# 安装 Python 依赖
cd python && pip install -r requirements.txt
```

### 开发模式

```bash
# 启动 Python 推理服务（端口 8765）
cd python && uvicorn om_reasoner.app:app --reload --port 8765

# 启动 Electron 开发模式
pnpm dev
```

### 构建打包

```bash
pnpm build
cd apps/desktop && pnpm dist
```

### CLI 使用

```bash
# 从 CSV 文件生成本体
om import data.csv --export owl

# 从 PostgreSQL 数据库生成本体
om import postgres://user:pass@localhost/mydb --export ttl

# 从 JSON 文件生成本体
om import data.json --export jsonld

# 批量处理
om import ./data-folder/ --export owl --output ./output/
```

## 项目结构

```
ontology_master3/
├── apps/
│   ├── desktop/          Electron 桌面应用
│   └── cli/              命令行工具
├── packages/
│   ├── pi-ai/            LLM 统一接口（多模型切换）
│   ├── pi-agent/         Agent 运行时（工具执行、事件流）
│   ├── ontology/         OWL 2 领域类型系统
│   ├── ingestion/        多源数据摄入管道
│   ├── modeler/          AI 本体建模流水线（6 阶段）
│   ├── store/            状态管理 + SQLite 持久化
│   └── ui/               React UI 组件库
├── python/
│   └── om_reasoner/      Python 推理服务（FastAPI + owlready2 + rdflib）
└── data/
    └── examples/         示例数据
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron + electron-vite |
| 前端 | React 18 + TypeScript (ESM) |
| Agent 运行时 | pi-agent（fork from pi-mono） |
| LLM 接口 | pi-ai（OpenAI / Anthropic / DeepSeek） |
| 本体引擎 | owlready2 + rdflib (Python) |
| 持久化 | better-sqlite3 (WAL) |
| 推理服务 | FastAPI |
| 数据摄入 | csv-parse, xlsx, pdf-parse, mammoth, cheerio |
| 构建工具 | pnpm workspace, Vite, TypeScript |

## 许可证

MIT
