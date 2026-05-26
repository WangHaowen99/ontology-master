"""SHACL 验证 API 路由"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from om_reasoner.validators.shacl import validate_shacl

router = APIRouter()


class ShaclValidationRequest(BaseModel):
    data_graph: str  # Turtle format
    shapes_graph: str | None = None  # Turtle format, optional


@router.post("/shacl")
async def validate_shacl_endpoint(req: ShaclValidationRequest):
    """对数据图执行 SHACL 验证"""
    try:
        result = validate_shacl(req.data_graph, req.shapes_graph)
        return result
    except Exception as e:
        raise HTTPException(500, f"SHACL validation failed: {str(e)}")
