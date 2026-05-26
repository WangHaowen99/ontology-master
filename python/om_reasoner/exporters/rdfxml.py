"""RDF/XML (.owl) 导出器"""

from rdflib import Graph


def export_rdfxml(graph: Graph) -> str:
    """将 rdflib Graph 导出为 RDF/XML 格式字符串"""
    return graph.serialize(format="xml")
