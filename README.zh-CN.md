# 本体建模大师 Desktop

AI 驱动的 OWL 本体建模桌面工具，完全复用 [pi-gui](https://github.com/minghinmatthewlam/pi-gui) 桌面框架。

## 功能概述

- **完整桌面 GUI** — 基于 pi-gui 的会话管理、模型切换、对话界面
- **多源数据摄入** — 数据库（PostgreSQL/MySQL/SQLite）、表格（CSV/Excel）、文档（PDF/DOCX/Markdown）、结构化数据（JSON/XML/YAML）
- **AI 本体建模** — 6 阶段建模流水线：预检 → 访谈 → 能力问题 → 抽取 → 审查 → 定稿
- **多模型切换** — 支持 DeepSeek、Claude、OpenAI
- **OWL 导出** — Turtle、RDF/XML、OWL/XML、JSON-LD
- **SHACL 验证** — 本体一致性和形状校验
- **命令行工具** — 批量处理、自动化流水线

## 快速开始

```bash
# 安装
corepack enable
pnpm install
cd python && pip install -r requirements.txt && cd ..

# 启动桌面
pnpm dev

# 启动 Python 推理服务
pnpm dev:python

# CLI 使用
pnpm om:import data/examples/sample.csv --export turtle
```

## 项目结构

| 目录 | 说明 |
|------|------|
| `apps/desktop/` | pi-gui Electron 桌面应用（完全复用） |
| `apps/cli/` | 命令行工具 |
| `packages/ontology/` | OWL 2 领域类型系统 |
| `packages/ingestion/` | 多源数据摄入管道 |
| `packages/modeler/` | AI 本体建模流水线 |
| `packages/store/` | SQLite 持久化 |
| `packages/session-driver/` | pi-gui 会话驱动类型（复用） |
| `packages/catalogs/` | pi-gui 目录状态（复用） |
| `packages/pi-sdk-driver/` | pi-gui Agent 桥接（复用） |
| `python/om_reasoner/` | Python 推理服务 |

## 许可证

MIT
