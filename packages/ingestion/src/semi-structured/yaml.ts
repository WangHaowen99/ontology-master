import { readFile } from 'node:fs/promises';
import YAML from 'yaml';
import type { IngestedSchema, ExtractedEntity } from '@om/ontology';
import type { DataSource, Ingester, ProgressCallback } from '../types.js';

export class YamlIngester implements Ingester {
  readonly supportedTypes = ['yaml'] as const;

  async ingest(source: DataSource, onProgress?: ProgressCallback): Promise<IngestedSchema> {
    onProgress?.('reading', 10, `Reading YAML: ${source.name}`);

    const content = await readFile(source.path!, 'utf-8');
    const data = YAML.parse(content);

    onProgress?.('analyzing', 50, 'Analyzing YAML structure');

    const entities: ExtractedEntity[] = [];
    extractYamlEntities(data, '', entities, 0);

    onProgress?.('done', 100, `Extracted ${entities.length} entities from YAML`);
    return { source: source.name, type: 'semi-structured', entities };
  }
}

function extractYamlEntities(
  data: unknown,
  prefix: string,
  entities: ExtractedEntity[],
  depth: number,
): void {
  if (depth > 5 || !data || typeof data !== 'object') return;

  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (typeof item === 'object' && item !== null) {
        const props: Record<string, string> = {};
        for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            props[k] = String(v);
          }
        }
        entities.push({
          name: (item as Record<string, unknown>).name as string ?? `${prefix}[${i}]`,
          type: prefix || 'item',
          properties: props,
        });
      }
    }
  } else {
    const obj = data as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        entities.push({
          name: key,
          type: key,
          properties: {},
          context: prefix,
        });
        extractYamlEntities(value, `${prefix}.${key}`, entities, depth + 1);
      }
    }
  }
}
