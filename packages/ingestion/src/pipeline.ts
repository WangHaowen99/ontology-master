import type { IngestedSchema } from '@om/ontology';
import type { DataSource, DataSourceType, Ingester, ProgressCallback } from './types.js';
import { detectSourceType } from './types.js';

import { CsvIngester } from './structured/csv.js';
import { ExcelIngester } from './structured/excel.js';
import { SqliteIngester } from './structured/sqlite.js';
import { PostgresIngester } from './structured/postgres.js';
import { MysqlIngester } from './structured/mysql.js';
import { JsonIngester } from './semi-structured/json.js';
import { XmlIngester } from './semi-structured/xml.js';
import { YamlIngester } from './semi-structured/yaml.js';
import { PdfIngester } from './unstructured/pdf.js';
import { DocxIngester } from './unstructured/docx.js';
import { MarkdownIngester } from './unstructured/markdown.js';

/**
 * Unified ingestion pipeline — auto-detects data source type and dispatches to the appropriate ingester.
 */
export class IngestionPipeline {
  private ingesters = new Map<DataSourceType, Ingester>();

  constructor() {
    // Register all built-in ingesters
    this.register(new CsvIngester());
    this.register(new ExcelIngester());
    this.register(new SqliteIngester());
    this.register(new PostgresIngester());
    this.register(new MysqlIngester());
    this.register(new JsonIngester());
    this.register(new XmlIngester());
    this.register(new YamlIngester());
    this.register(new PdfIngester());
    this.register(new DocxIngester());
    this.register(new MarkdownIngester());
  }

  /** Register a custom ingester */
  register(ingester: Ingester): void {
    for (const type of ingester.supportedTypes) {
      this.ingesters.set(type, ingester);
    }
  }

  /** Ingest a single data source */
  async ingest(source: DataSource, onProgress?: ProgressCallback): Promise<IngestedSchema> {
    const type = source.type || detectSourceType(source.path ?? source.url ?? source.name);
    const ingester = this.ingesters.get(type);
    if (!ingester) {
      throw new Error(`No ingester registered for source type: ${type}`);
    }
    return ingester.ingest({ ...source, type }, onProgress);
  }

  /** Ingest multiple data sources and merge results */
  async ingestAll(
    sources: DataSource[],
    onProgress?: (sourceName: string, phase: string, percent: number, message: string) => void,
  ): Promise<IngestedSchema[]> {
    const results: IngestedSchema[] = [];

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const wrappedProgress: ProgressCallback = (phase, percent, message) => {
        onProgress?.(source.name, phase, percent, message);
      };
      const result = await this.ingest(source, wrappedProgress);
      results.push(result);
    }

    return results;
  }

  /** List all registered source types */
  get supportedTypes(): DataSourceType[] {
    return Array.from(this.ingesters.keys());
  }
}

/** Create a default pipeline instance */
export function createPipeline(): IngestionPipeline {
  return new IngestionPipeline();
}
