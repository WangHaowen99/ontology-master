"""OWL 导出 API 路由"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from om_reasoner.owl_engine import OwlEngine
from om_reasoner.exporters.turtle import export_turtle
from om_reasoner.exporters.rdfxml import export_rdfxml
from om_reasoner.exporters.owlxml import export_owlxml
from om_reasoner.exporters.jsonld import export_jsonld

router = APIRouter()
engine = OwlEngine()


class ExportRequest(BaseModel):
    model: dict
    format: str = "turtle"  # turtle | rdfxml | owlxml | jsonld
    prefixes: dict[str, str] | None = None
    context: dict | None = None


@router.post("/ontology")
async def export_ontology(req: ExportRequest):
    """将本体模型导出为指定格式"""
    try:
        engine.load_from_json(req.model)
        graph = engine.to_graph()

        exporters = {
            "turtle": lambda: export_turtle(graph, req.prefixes),
            "rdfxml": lambda: export_rdfxml(graph),
            "owlxml": lambda: export_owlxml(graph),
            "jsonld": lambda: export_jsonld(graph, req.context),
        }

        exporter = exporters.get(req.format)
        if not exporter:
            raise HTTPException(400, f"Unsupported format: {req.format}. Use: {list(exporters.keys())}")

        content = exporter()

        media_types = {
            "turtle": "text/turtle",
            "rdfxml": "application/rdf+xml",
            "owlxml": "application/owl+xml",
            "jsonld": "application/ld+json",
        }

        return PlainTextResponse(
            content=content,
            media_type=media_types.get(req.format, "text/plain"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Export failed: {str(e)}")


@router.post("/ontology/file")
async def export_ontology_to_file(req: ExportRequest):
    """导出本体并返回可下载的文件"""
    try:
        engine.load_from_json(req.model)
        graph = engine.to_graph()

        exporters = {
            "turtle": lambda: export_turtle(graph, req.prefixes),
            "rdfxml": lambda: export_rdfxml(graph),
            "owlxml": lambda: export_owlxml(graph),
            "jsonld": lambda: export_jsonld(graph, req.context),
        }

        exporter = exporters.get(req.format)
        if not exporter:
            raise HTTPException(400, f"Unsupported format: {req.format}")

        content = exporter()
        extensions = {"turtle": ".ttl", "rdfxml": ".owl", "owlxml": ".owl", "jsonld": ".jsonld"}
        ext = extensions.get(req.format, ".txt")

        from fastapi.responses import Response
        return Response(
            content=content,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename=ontology{ext}"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Export failed: {str(e)}")
