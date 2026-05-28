import { describe, expect, test } from "vitest";
import {
  buildPiAgentModelingPrompt,
  convertProtocolResultToOntology,
  extractOntologyJsonBlock,
  parseOntologyJsonBlock,
} from "../pi-agent-protocol.js";

describe("pi agent ontology protocol", () => {
  test("builds a Chinese prompt that requires pi agent ontology-json output", () => {
    const prompt = buildPiAgentModelingPrompt({
      phase: "extract",
      sources: [
        {
          id: "src-1",
          name: "客户.csv",
          kind: "csv",
          summary: "1 个表，字段：客户ID、客户名称",
        },
      ],
      userRequirement: "重点建模客户和订单关系",
    });

    expect(prompt).toContain("你正在通过 pi agent 执行本体建模");
    expect(prompt).toContain("客户.csv");
    expect(prompt).toContain("重点建模客户和订单关系");
    expect(prompt).toContain("```ontology-json");
    expect(prompt).toContain("中文 label");
  });

  test("extracts the last ontology-json fenced block", () => {
    const text = [
      "说明文字",
      "```ontology-json",
      '{"title":"旧结果"}',
      "```",
      "更多说明",
      "```ontology-json",
      '{"title":"客户本体","iri":"http://example.org/customer","classes":[]}',
      "```",
    ].join("\n");

    expect(extractOntologyJsonBlock(text)).toBe(
      '{"title":"客户本体","iri":"http://example.org/customer","classes":[]}',
    );
  });

  test("parses ontology-json and converts it to an ontology model", () => {
    const parsed = parseOntologyJsonBlock(`{
      "title": "客户订单本体",
      "iri": "http://example.org/customer-order",
      "classes": [
        { "name": "Customer", "label": "客户", "description": "购买商品或服务的主体" },
        { "name": "Order", "label": "订单", "description": "客户发起的交易记录" }
      ],
      "objectProperties": [
        {
          "name": "placesOrder",
          "label": "下单",
          "description": "客户创建订单",
          "domain": "Customer",
          "range": "Order"
        }
      ],
      "dataProperties": [
        {
          "name": "hasName",
          "label": "名称",
          "description": "客户名称",
          "domain": "Customer",
          "range": "xsd:string"
        }
      ],
      "competencyQuestions": [
        { "question": "某个客户有哪些订单？", "expectedAnswerType": "Order" }
      ]
    }`);

    const model = convertProtocolResultToOntology(parsed);

    expect(model.metadata.title).toBe("客户订单本体");
    expect(model.metadata.language).toBe("zh");
    expect(model.classes.map((item) => item.iri.local)).toEqual(["Customer", "Order"]);
    expect(model.classes[0]?.labels?.zh).toBe("客户");
    expect(model.objectProperties[0]?.domain[0]).toMatchObject({ kind: "iri", iri: { local: "Customer" } });
    expect(model.dataProperties[0]?.range).toEqual(["xsd:string"]);
    expect(model.competencyQuestions[0]?.question).toBe("某个客户有哪些订单？");
  });

  test("throws a useful error when ontology-json is missing required fields", () => {
    expect(() => parseOntologyJsonBlock('{"classes":[]}')).toThrow("ontology-json 缺少 title");
  });
});
