import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import type { IngestedSchema, TableSchema, ColumnSchema } from '@om/ontology';
import type { DataSource, Ingester, ProgressCallback } from '../types.js';

export class CsvIngester implements Ingester {
  readonly supportedTypes = ['csv'] as const;

  async ingest(source: DataSource, onProgress?: ProgressCallback): Promise<IngestedSchema> {
    onProgress?.('reading', 10, `Reading CSV: ${source.name}`);

    const content = await readFile(source.path!, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      ...(source.options as Record<string, unknown>),
    }) as Record<string, string>[];

    onProgress?.('analyzing', 50, `Analyzing ${records.length} rows`);

    if (records.length === 0) {
      return { source: source.name, type: 'structured', tables: [] };
    }

    const columns = Object.keys(records[0]);
    const columnSchemas: ColumnSchema[] = columns.map((col) => {
      const values = records.map((r) => r[col]).filter((v) => v !== '' && v != null);
      return {
        name: col,
        dataType: inferType(values),
        nullable: values.length < records.length,
        unique: new Set(values).size === values.length,
        sampleValues: values.slice(0, 5),
      };
    });

    const table: TableSchema = {
      name: source.name.replace(/\.\w+$/, ''),
      columns: columnSchemas,
      primaryKey: columnSchemas.find((c) => c.unique && !c.nullable && c.name.toLowerCase().includes('id'))
        ? [columnSchemas.find((c) => c.unique && !c.nullable && c.name.toLowerCase().includes('id'))!.name]
        : undefined,
      rowCount: records.length,
    };

    onProgress?.('done', 100, `Parsed ${records.length} rows, ${columns.length} columns`);

    return { source: source.name, type: 'structured', tables: [table] };
  }
}

function inferType(values: string[]): string {
  if (values.length === 0) return 'string';
  const sample = values.slice(0, 100);
  if (sample.every((v) => /^-?\d+$/.test(v))) return 'integer';
  if (sample.every((v) => /^-?\d+\.\d+$/.test(v))) return 'float';
  if (sample.every((v) => /^(true|false)$/i.test(v))) return 'boolean';
  if (sample.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v))) return 'date';
  return 'string';
}
