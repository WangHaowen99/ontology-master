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
    const root = $.root().children().first();

    extractXmlEntities($, root, entities, 0);

    onProgress?.('done', 100, `Extracted ${entities.length} entities from XML`);
    return { source: source.name, type: 'semi-structured', entities };
  }
}

function extractXmlEntities(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<cheerio.Element>,
  entities: ExtractedEntity[],
  depth: number,
): void {
  if (depth > 5) return;

  const tagName = el.prop('tagName') as string;
  if (!tagName) return;

  const properties: Record<string, string> = {};
  for (const [key, value] of Object.entries(el.attr() ?? {})) {
    properties[`@${key}`] = value;
  }

  const textContent = el.children().not('*').text().trim();
  if (textContent) {
    properties['#text'] = textContent;
  }

  if (Object.keys(properties).length > 0 || el.children('*').length > 0) {
    entities.push({
      name: el.attr('name') || el.attr('id') || tagName,
      type: tagName,
      properties,
    });
  }

  el.children('*').each(function () {
    extractXmlEntities($, $(this), entities, depth + 1);
  });
}
