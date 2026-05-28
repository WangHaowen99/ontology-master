import { describe, expect, test } from "vitest";
import { getSendableSourceIds, type ImportedSource } from "../data-import-view";

describe("DataImportView source selection", () => {
  test("only sends selected ready sources to the modeler", () => {
    const sources: ImportedSource[] = [
      makeSource("ready-file", "ready"),
      makeSource("failed-file", "failed"),
      makeSource("processing-file", "processing"),
    ];

    expect(getSendableSourceIds(sources, ["ready-file", "failed-file", "missing-id"])).toEqual(["ready-file"]);
  });
});

function makeSource(id: string, status: ImportedSource["status"]): ImportedSource {
  return {
    id,
    name: `${id}.csv`,
    kind: "csv",
    sizeBytes: 100,
    importedAt: "2026-05-28T00:00:00.000Z",
    tableCount: 1,
    entityCount: 0,
    textSegmentCount: 0,
    status,
  };
}
