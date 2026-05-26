import { readFile } from 'node:fs/promises';
import type { IngestedSchema, TextSegment, ExtractedEntity } from '@om/ontology';
import type { DataSource, Ingester, ProgressCallback } from '../types.js';

export class MarkdownIngester implements Ingester {
  readonly supportedTypes = ['markdown'] as const;

  async ingest(source: DataSource, onProgress?: ProgressCallback): Promise<IngestedSchema> {
    onProgress?.('reading', 10, `Reading Markdown: ${source.name}`);

    const content = await readFile(source.path!, 'utf-8');

    onProgress?.('analyzing', 50, 'Parsing markdown structure');

    const segments: TextSegment[] = [];
    const entities: ExtractedEntity[] = [];

    let currentHeading: string | undefined;
    let currentContent: string[] = [];

    const lines = content.split('\n');

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        // Flush previous content
        if (currentContent.length > 0) {
          segments.push({
            heading: currentHeading,
            content: currentContent.join(' ').trim(),
            source: source.name,
          });
        }
        currentHeading = headingMatch[2].trim();
        currentContent = [];

        // Track headings as entities
        entities.push({
          name: currentHeading,
          type: `h${headingMatch[1].length}`,
          properties: { level: headingMatch[1].length.toString() },
        });
      } else if (line.trim()) {
        currentContent.push(line.trim());
      }
    }

    // Flush last segment
    if (currentContent.length > 0) {
      segments.push({
        heading: currentHeading,
        content: currentContent.join(' ').trim(),
        source: source.name,
      });
    }

    onProgress?.('done', 100, `Extracted ${segments.length} segments, ${entities.length} headings`);
    return { source: source.name, type: 'unstructured', textSegments: segments, entities };
  }
}
