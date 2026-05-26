# 本体建模大师 Desktop - 开发指南

## 架构

- **混合架构**：TypeScript 前端（Electron）+ Python 后端（FastAPI）
- **Monorepo**：pnpm workspace，10 个包
- **Agent 模式**：基于 pi-agent 的工具体系，AI 驱动 6 阶段本体建模

## 包依赖关系

```
pi-ai → pi-agent → modeler → desktop
ontology → modeler, store, ui, cli
ingestion → modeler, cli
store → desktop, cli
ui → desktop
```

## 开发命令

```bash
pnpm dev              # 启动 Electron 开发模式
pnpm build            # 构建所有包
pnpm test             # 运行所有测试
pnpm dev:python       # 启动 Python 推理服务
```

## 约定

- TypeScript strict mode, ESM 全程
- 文件名 kebab-case，类型名 PascalCase
- 单文件不超过 1000 行
- Conventional Commits 提交规范
- Python 遵循 PEP 8，使用 ruff 格式化
