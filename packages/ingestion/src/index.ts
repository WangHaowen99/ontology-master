export type { DataSource, DataSourceType, Ingester, ProgressCallback } from './types.js';
export { detectSourceType } from './types.js';
export { IngestionPipeline, createPipeline } from './pipeline.js';

// Individual ingesters
export { CsvIngester } from './structured/csv.js';
export { ExcelIngester } from './structured/excel.js';
export { SqliteIngester } from './structured/sqlite.js';
export { PostgresIngester } from './structured/postgres.js';
export { MysqlIngester } from './structured/mysql.js';
export { JsonIngester } from './semi-structured/json.js';
export { XmlIngester } from './semi-structured/xml.js';
export { YamlIngester } from './semi-structured/yaml.js';
export { PdfIngester } from './unstructured/pdf.js';
export { DocxIngester } from './unstructured/docx.js';
export { MarkdownIngester } from './unstructured/markdown.js';
