"""SHACL 形状验证器"""

from rdflib import Graph
from pyshacl import validate


def validate_shacl(data_graph_str: str, shapes_graph_str: str | None = None) -> dict:
    """
    对数据图进行 SHACL 验证

    Returns:
        {
            "conforms": bool,
            "results": list of validation result dicts,
            "report": str
        }
    """
    data_graph = Graph()
    data_graph.parse(data=data_graph_str, format="turtle")

    shapes_graph = None
    if shapes_graph_str:
        shapes_graph = Graph()
        shapes_graph.parse(data=shapes_graph_str, format="turtle")

    conforms, results_graph, results_text = validate(
        data_graph,
        shacl_graph=shapes_graph,
        inference="rdfs",
        abort_on_first=False,
    )

    return {
        "conforms": conforms,
        "report": results_text,
    }
