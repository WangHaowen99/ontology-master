import { readFile } from 'node:fs/promises';
import type { IngestedSchema, TextSegment } from '@om/ontology';
import type { DataSource, Ingester, ProgressCallback } from '../types.js';

export class PdfIngester implements Ingester {
  readonly supportedTypes = ['pdf'] as const;

  async ingest(source: DataSource, onProgress?: ProgressCallback): Promise<IngestedSchema> {
    onProgress?.('reading', 10, `Reading PDF: ${source.name}`);

    const pdfParse = (await import('pdf-parse')).default;
    const buffer = await readFile(source.path!);
    const data = await pdfParse(buffer);

    onProgress?.('analyzing', 50, `Extracted ${data.numpages} pages of text`);

    const segments: TextSegment[] = [];
    const pages = data.text.split('\f'); // page break character

    for (let i = 0; i < pages.length; i++) {
      const pageText = pages[i].trim();
      if (!pageText) continue;

      // Split into logical segments by double newlines
      const paragraphs = pageText.split(/\n\s*\n/).filter((p) => p.trim().length > 20);
      for (const paragraph of paragraphs) {
        const lines = paragraph.split('\n').map((l) => l.trim()).filter(Boolean);
        // First short line might be a heading
        const heading = lines[0] && lines[0].length < 80 && lines.length > 1 ? lines[0] : undefined;
        const content = heading ? lines.slice(1).join(' ') : lines.join(' ');

        segments.push({
          heading,
          content,
          page: i + 1,
          source: source.name,
        });
      }
    }

    onProgress?.('done', 100, `Extracted ${segments.length} text segments from ${data.numpages} pages`);
    return { source: source.name, type: 'unstructured', textSegments: segments };
  }
}
