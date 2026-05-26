import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import type { IngestedSchema, TableSchema, ColumnSchema } from '@om/ontology';
import type { DataSource, Ingester, ProgressCallback } from '../types.js';

export class ExcelIngester implements Ingester {
  readonly supportedTypes = ['excel'] as const;

  async ingest(source: DataSource, onProgress?: ProgressCallback): Promise<IngestedSchema> {
    onProgress?.('reading', 10, `Reading Excel: ${source.name}`);

    const buffer = await readFile(source.path!);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    onProgress?.('analyzing', 30, `Found ${workbook.SheetNames.length} sheets`);

    const tables: TableSchema[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      if (records.length === 0) continue;

      const columns = Object.keys(records[0]);
      const columnSchemas: ColumnSchema[] = columns.map((col) => {
        const values = records.map((r) => String(r[col] ?? '')).filter((v) => v !== '');
        return {
          name: col,
          dataType: inferExcelType(values),
          nullable: values.length < records.length,
          unique: new Set(values).size === values.length,
          sampleValues: values.slice(0, 5),
        };
      });

      tables.push({
        name: sheetName,
        columns: columnSchemas,
        rowCount: records.length,
      });
    }

    onProgress?.('done', 100, `Parsed ${tables.length} sheets`);
    return { source: source.name, type: 'structured', tables };
  }
}

function inferExcelType(values: string[]): string {
  if (values.length === 0) return 'string';
  const sample = values.slice(0, 100);
  if (sample.every((v) => /^-?\d+$/.test(v))) return 'integer';
  if (sample.every((v) => /^-?\d+\.?\d*$/.test(v))) return 'float';
  if (sample.every((v) => /^(true|false)$/i.test(v))) return 'boolean';
  return 'string';
}
