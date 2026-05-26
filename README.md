# 本体建模大师 Desktop

AI 驱动的 OWL 本体建模桌面工具，支持读取多源数据并输出标准 OWL 格式本体模型。

## 开发

```bash
# 安装依赖
pnpm install

# 启动 Python 推理服务
cd python && pip install -r requirements.txt
uvicorn om_reasoner.app:app --reload --port 8765

# 启动 Electron 开发
pnpm dev

# 构建
pnpm build
```

## CLI 使用

```bash
# 从 CSV 生成本体
om import data.csv --export owl

# 从数据库生成本体
om import postgres://localhost/mydb --export ttl
```
