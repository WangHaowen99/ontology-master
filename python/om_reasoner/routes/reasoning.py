"""本体推理 API 路由"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from om_reasoner.owl_engine import OwlEngine

router = APIRouter()
engine = OwlEngine()


class OntologyModelInput(BaseModel):
    """前端传入的 OntologyModel JSON"""
    model: dict


class InferRequest(BaseModel):
    model: dict | None = None
    ttl: str | None = None


class SparqlRequest(BaseModel):
    query: str
    ttl: str | None = None
    model: dict | None = None


@router.post("/infer")
async def run_inference(req: InferRequest):
    """运行本体推理，返回新推断的关系"""
    try:
        if req.ttl:
            engine.load_from_ttl(req.ttl)
            return {"message": "Turtle loaded. Use owlready2 model for full inference.", "triples": []}
        elif req.model:
            engine.load_from_json(req.model)
            inferred = engine.infer()
            return {"triples": inferred, "count": len(inferred)}
        else:
            raise HTTPException(400, "Provide either 'ttl' or 'model'")
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/sparql")
async def run_sparql(req: SparqlRequest):
    """执行 SPARQL 查询"""
    try:
        if req.ttl:
            engine.load_from_ttl(req.ttl)
        elif req.model:
            engine.load_from_json(req.model)

        results = engine.sparql_query(req.query)
        return {"results": results, "count": len(results)}
    except Exception as e:
        raise HTTPException(500, str(e))
