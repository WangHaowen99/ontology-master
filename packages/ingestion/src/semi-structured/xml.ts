import { readFile } from 'node:fs/promises';
import * as cheerio from 'cheerio';
import type { IngestedSchema, ExtractedEntity } from '@om/ontology';
import type { DataSource, Ingester, ProgressCallback } from '../types.js';

export class XmlIngester implements Ingester {
  readonly supportedTypes = ['xml'] as const;

  async ingest(source: DataSource, onProgress?: ProgressCallback): Promise<IngestedSchema> {
    onProgress?.('reading', 10, `Reading XML: ${source.name}`);

    const content = await readFile(source.path!, 'utf-8');
    const $ = cheerio.load(content, { xmlMode: true });

    onProgress?.('analyzing', 50, 'Analyzing XML structure');

    const entities: ExtractedEntity[] = [];

    // Walk all elements and extract entity-like nodes
    $('*').each(function () {
      const el = $(this);
      const tagName = (this as { tagName?: string }).tagName?.toLowerCase() ?? '';
      if (!tagName) return;

      const properties: Record<string, string> = {};
      const attrs = (this as { attribs?: Record<string, string> }).attribs ?? {};
      for (const [key, value] of Object.entries(attrs)) {
        properties[`@${key}`] = value;
      }

      // Get direct text content (not from children)
      const directText = el.contents().filter(function () {
        return (this as { type?: string }).type === 'text';
      }).text().trim();
      if (directText) {
        properties['#text'] = directText;
      }

      if (Object.keys(properties).length > 0) {
        entities.push({
          name: attrs.name || attrs.id || tagName,
          type: tagName,
          properties,
        });
      }
    });

    onProgress?.('done', 100, `Extracted ${entities.length} entities from XML`);
    return { source: source.name, type: 'semi-structured', entities };
  }
}
