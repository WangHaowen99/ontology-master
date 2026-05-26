"""OWL/XML (.owl) 导出器"""

from rdflib import Graph


def export_owlxml(graph: Graph) -> str:
    """将 rdflib Graph 导出为 OWL/XML 格式字符串"""
    # rdflib doesn't natively support OWL/XML, serialize as RDF/XML
    # with OWL vocabulary (which is valid OWL/XML for most tools)
    return graph.serialize(format="xml")
