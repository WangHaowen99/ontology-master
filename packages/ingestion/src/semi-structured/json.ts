import { readFile } from 'node:fs/promises';
import type { IngestedSchema, ExtractedEntity } from '@om/ontology';
import type { DataSource, Ingester, ProgressCallback } from '../types.js';

export class JsonIngester implements Ingester {
  readonly supportedTypes = ['json'] as const;

  async ingest(source: DataSource, onProgress?: ProgressCallback): Promise<IngestedSchema> {
    onProgress?.('reading', 10, `Reading JSON: ${source.name}`);

    const content = await readFile(source.path!, 'utf-8');
    const data = JSON.parse(content);

    onProgress?.('analyzing', 50, 'Analyzing JSON structure');

    const entities: ExtractedEntity[] = [];

    if (Array.isArray(data)) {
      // Array of objects — extract as entity collection
      for (let i = 0; i < Math.min(data.length, 100); i++) {
        const item = data[i];
        if (typeof item === 'object' && item !== null) {
          entities.push({
            name: item.name || item.id || item.title || `item_${i}`,
            type: detectObjectType(item),
            properties: flattenProperties(item),
          });
        }
      }
    } else if (typeof data === 'object' && data !== null) {
      // Single object or nested structure
      extractNestedEntities(data, '', entities, 0);
    }

    onProgress?.('done', 100, `Extracted ${entities.length} entities`);
    return { source: source.name, type: 'semi-structured', entities };
  }
}

function detectObjectType(obj: Record<string, unknown>): string {
  if (obj.type && typeof obj.type === 'string') return obj.type;
  if (obj['@type'] && typeof obj['@type'] === 'string') return obj['@type'] as string;
  return 'Object';
}

function flattenProperties(obj: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = String(value);
    } else if (value === null) {
      result[key] = 'null';
    }
  }
  return result;
}

function extractNestedEntities(
  obj: Record<string, unknown>,
  prefix: string,
  entities: ExtractedEntity[],
  depth: number,
): void {
  if (depth > 5) return; // prevent infinite recursion

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          entities.push({
            name: item.name || item.id || key,
            type: key,
            properties: flattenProperties(item as Record<string, unknown>),
            context: prefix,
          });
          extractNestedEntities(item as Record<string, unknown>, `${prefix}.${key}`, entities, depth + 1);
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      entities.push({
        name: key,
        type: key,
        properties: flattenProperties(value as Record<string, unknown>),
        context: prefix,
      });
      extractNestedEntities(value as Record<string, unknown>, `${prefix}.${key}`, entities, depth + 1);
    }
  }
}
