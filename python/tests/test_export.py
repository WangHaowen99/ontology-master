"""测试导出功能"""

import pytest
from rdflib import Graph, Namespace, URIRef, Literal, RDF, RDFS, OWL

from om_reasoner.exporters.turtle import export_turtle
from om_reasoner.exporters.rdfxml import export_rdfxml
from om_reasoner.exporters.jsonld import export_jsonld


def create_test_graph() -> Graph:
    g = Graph()
    EX = Namespace("http://example.org/test#")
    g.bind("ex", EX)
    g.bind("owl", OWL)
    g.bind("rdfs", RDFS)

    # Create a simple ontology
    g.add((EX.Person, RDF.type, OWL.Class))
    g.add((EX.Person, RDFS.label, Literal("Person")))
    g.add((EX.Person, RDFS.comment, Literal("A human being")))

    g.add((EX.Organization, RDF.type, OWL.Class))
    g.add((EX.Organization, RDFS.label, Literal("Organization")))

    g.add((EX.hasName, RDF.type, OWL.DatatypeProperty))
    g.add((EX.hasName, RDFS.domain, EX.Person))

    g.add((EX.worksFor, RDF.type, OWL.ObjectProperty))
    g.add((EX.worksFor, RDFS.domain, EX.Person))
    g.add((EX.worksFor, RDFS.range, EX.Organization))

    return g


def test_export_turtle():
    g = create_test_graph()
    ttl = export_turtle(g)
    assert "Person" in ttl
    assert "Organization" in ttl
    assert "owl:Class" in ttl


def test_export_rdfxml():
    g = create_test_graph()
    xml = export_rdfxml(g)
    assert "Person" in xml
    assert "rdf:Description" in xml


def test_export_jsonld():
    g = create_test_graph()
    jsonld = export_jsonld(g)
    assert "Person" in jsonld
