"""Turtle (.ttl) 导出器"""

from rdflib import Graph


def export_turtle(graph: Graph, prefixes: dict[str, str] | None = None) -> str:
    """将 rdflib Graph 导出为 Turtle 格式字符串"""
    if prefixes:
        for prefix, uri in prefixes.items():
            graph.bind(prefix, uri)
    return graph.serialize(format="turtle")
