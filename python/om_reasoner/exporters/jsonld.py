"""JSON-LD (.jsonld) 导出器"""

import json
from rdflib import Graph


def export_jsonld(graph: Graph, context: dict | None = None) -> str:
    """将 rdflib Graph 导出为 JSON-LD 格式字符串"""
    if context:
        return graph.serialize(format="json-ld", context=context)
    return graph.serialize(format="json-ld")
