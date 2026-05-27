# 本体建模大师 Desktop — 开发指南

## 架构

本项目完全复用 pi-gui 的 Electron 桌面应用架构，在此基础上增加本体建模领域包。

- **apps/desktop** — 完全来自 pi-gui，不做修改
- **packages/session-driver, catalogs, pi-sdk-driver** — 完全来自 pi-gui
- **packages/ontology, ingestion, modeler, store** — 我们的本体建模领域包
- **python/om_reasoner** — Python 推理服务

## 包依赖关系

```
pi-gui 层（完全复用）：
  session-driver → catalogs → pi-sdk-driver → desktop

ontology 层（我们的包）：
  ontology → ingestion → modeler → store → cli
  python/om_reasoner（独立 FastAPI 服务）
```

## 开发命令

```bash
pnpm dev              # 启动 pi-gui 桌面应用
pnpm build            # 构建所有包
pnpm build:ontology   # 只构建 ontology 相关包
pnpm dev:python       # 启动 Python 推理服务
pnpm test             # 运行所有测试
pnpm test:python      # 运行 Python 测试
pnpm om:import        # CLI 导入数据
```

## 约定

- TypeScript strict mode
- Conventional Commits 提交规范
- Python 遵循 PEP 8
- pi-gui 代码不做修改，只做扩展
