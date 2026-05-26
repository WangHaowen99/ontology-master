"""本体建模大师 Python 推理服务 — FastAPI 入口"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from om_reasoner.routes import reasoning, export, validation

app = FastAPI(
    title="om-reasoner",
    description="本体建模大师 — OWL 推理、导出、验证服务",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reasoning.router, prefix="/api/reasoning", tags=["reasoning"])
app.include_router(export.router, prefix="/api/export", tags=["export"])
app.include_router(validation.router, prefix="/api/validation", tags=["validation"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "om-reasoner"}
