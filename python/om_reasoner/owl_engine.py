"""owlready2 本体引擎封装"""

from __future__ import annotations
from typing import Any

import owlready2
from rdflib import Graph, Namespace, URIRef, Literal, RDF, RDFS, OWL


class OwlEngine:
    """封装 owlready2 + rdflib 的本体操作引擎"""

    def __init__(self):
        self.onto: owlready2.Ontology | None = None
        self.graph: Graph = Graph()

    def load_from_json(self, model: dict[str, Any]) -> owlready2.Ontology:
        """从前端 OntologyModel JSON 加载为 owlready2 Ontology"""
        iri = model.get("iri", "http://example.org/ontology")
        self.onto = owlready2.get_ontology(iri)

        with self.onto:
            # Create classes
            for cls_data in model.get("classes", []):
                cls_name = cls_data["iri"]["local"]
                cls = types.new_class(cls_name, (owlready2.Thing,))
                if cls_data.get("description"):
                    cls.comment = [cls_data["description"]]
                if cls_data.get("label"):
                    cls.label = [cls_data["label"]]

                # Superclasses
                for sup in cls_data.get("superClasses", []):
                    sup_name = sup.get("local", "")
                    if hasattr(self.onto, sup_name):
                        cls.is_a.append(getattr(self.onto, sup_name))

            # Create object properties
            for prop_data in model.get("objectProperties", []):
                prop_name = prop_data["iri"]["local"]
                prop = types.new_class(prop_name, (owlready2.ObjectProperty,))

            # Create data properties
            for prop_data in model.get("dataProperties", []):
                prop_name = prop_data["iri"]["local"]
                prop = types.new_class(prop_name, (owlready2.DataProperty,))

            # Create individuals
            for ind_data in model.get("individuals", []):
                ind_name = ind_data["iri"]["local"]
                cls_names = [c["local"] for c in ind_data.get("classIRIs", [])]
                parents = tuple(getattr(self.onto, cn, owlready2.Thing) for cn in cls_names)
                ind = types.new_class(ind_name, parents)()

        return self.onto

    def load_from_ttl(self, ttl_content: str) -> Graph:
        """从 Turtle 字符串加载为 rdflib Graph"""
        self.graph = Graph()
        self.graph.parse(data=ttl_content, format="turtle")
        return self.graph

    def infer(self) -> list[dict[str, str]]:
        """运行 HermiT 推理器，返回新推断的三元组"""
        if self.onto is None:
            return []

        owlready2.sync_reasoner_hermit()

        inferred = []
        for cls in self.onto.classes():
            for sup in cls.INDIRECT_is_a:
                if hasattr(sup, "name") and sup != cls:
                    inferred.append({
                        "type": "subClassOf",
                        "subject": cls.name,
                        "object": sup.name,
                    })
        return inferred

    def to_graph(self) -> Graph:
        """将 owlready2 ontology 转为 rdflib Graph"""
        if self.onto is None:
            return self.graph

        self.graph = Graph()
        # Serialize owlready2 to turtle, then parse with rdflib
        ttl = self.onto.serialize(format="turtle")
        self.graph.parse(data=ttl, format="turtle")
        return self.graph

    def sparql_query(self, query: str) -> list[dict[str, str]]:
        """执行 SPARQL 查询"""
        graph = self.to_graph() if self.onto else self.graph
        results = graph.query(query)
        return [
            {str(var): str(val) for var, val in zip(results.vars, row)}
            for row in results
        ]


import types as _types
import types  # noqa: F811 — needed for dynamic class creation
