import type { IngestedSchema } from '@om/ontology';

// ─── Data Source Types ───

export type DataSourceType =
  | 'csv' | 'excel' | 'sqlite' | 'postgres' | 'mysql'
  | 'json' | 'xml' | 'yaml'
  | 'pdf' | 'docx' | 'markdown' | 'text' | 'url';

export interface DataSource {
  type: DataSourceType;
  path?: string;           // file path
  url?: string;            // URL or connection string
  name: string;            // display name
  options?: Record<string, unknown>;
}

export type ProgressCallback = (phase: string, percent: number, message: string) => void;

// ─── Ingester Interface ───

export interface Ingester {
  readonly supportedTypes: DataSourceType[];
  ingest(source: DataSource, onProgress?: ProgressCallback): Promise<IngestedSchema>;
}

// ─── Auto-detect source type from file extension ───

export function detectSourceType(path: string): DataSourceType {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, DataSourceType> = {
    csv: 'csv', tsv: 'csv',
    xlsx: 'excel', xls: 'excel',
    sqlite: 'sqlite', db: 'sqlite', sqlite3: 'sqlite',
    json: 'json', geojson: 'json',
    xml: 'xml', xsl: 'xml',
    yaml: 'yaml', yml: 'yaml',
    pdf: 'pdf',
    docx: 'docx', doc: 'docx',
    md: 'markdown', markdown: 'markdown',
    txt: 'text',
  };
  return map[ext] ?? 'text';
}
