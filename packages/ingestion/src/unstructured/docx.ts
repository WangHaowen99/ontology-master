import { readFile } from 'node:fs/promises';
import mammoth from 'mammoth';
import type { IngestedSchema, TextSegment } from '@om/ontology';
import type { DataSource, Ingester, ProgressCallback } from '../types.js';

export class DocxIngester implements Ingester {
  readonly supportedTypes = ['docx'] as const;

  async ingest(source: DataSource, onProgress?: ProgressCallback): Promise<IngestedSchema> {
    onProgress?.('reading', 10, `Reading DOCX: ${source.name}`);

    const buffer = await readFile(source.path!);
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;

    onProgress?.('analyzing', 50, 'Segmenting document text');

    const segments: TextSegment[] = [];
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

    let currentHeading: string | undefined;

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();

      // Heuristic: short bold-like lines are headings
      if (trimmed.length < 100 && (trimmed === trimmed.toUpperCase() || /^[IVX\d]+[.)]\s/.test(trimmed))) {
        currentHeading = trimmed;
        continue;
      }

      segments.push({
        heading: currentHeading,
        content: trimmed,
        source: source.name,
      });
      currentHeading = undefined;
    }

    onProgress?.('done', 100, `Extracted ${segments.length} segments`);
    return { source: source.name, type: 'unstructured', textSegments: segments };
  }
}
