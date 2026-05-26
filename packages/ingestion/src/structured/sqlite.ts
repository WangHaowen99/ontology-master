import Database from 'better-sqlite3';
import type { IngestedSchema, TableSchema, ColumnSchema, ForeignKey } from '@om/ontology';
import type { DataSource, Ingester, ProgressCallback } from '../types.js';

export class SqliteIngester implements Ingester {
  readonly supportedTypes = ['sqlite'] as const;

  async ingest(source: DataSource, onProgress?: ProgressCallback): Promise<IngestedSchema> {
    onProgress?.('connecting', 10, `Opening SQLite: ${source.name}`);

    const db = new Database(source.path!, { readonly: true });

    try {
      const tableNames = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[])
        .map((r) => r.name);

      onProgress?.('analyzing', 30, `Found ${tableNames.length} tables`);

      const tables: TableSchema[] = tableNames.map((tableName) => {
        const columnInfo = db.prepare(`PRAGMA table_info("${tableName}")`).all() as Array<{
          name: string; type: string; notnull: number; pk: number;
        }>;
        const fkInfo = db.prepare(`PRAGMA foreign_key_list("${tableName}")`).all() as Array<{
          id: number; table: string; from: string; to: string;
        }>;

        const columns: ColumnSchema[] = columnInfo.map((col) => ({
          name: col.name,
          dataType: col.type || 'TEXT',
          nullable: col.notnull === 0,
          unique: false, // SQLite PRAGMA doesn't directly expose uniqueness per column
          sampleValues: (db.prepare(`SELECT "${col.name}" FROM "${tableName}" WHERE "${col.name}" IS NOT NULL LIMIT 5`).all() as Record<string, unknown>[])
            .map((r) => String(r[col.name])),
        }));

        const primaryKey = columnInfo.filter((c) => c.pk > 0).map((c) => c.name);

        const foreignKeys: ForeignKey[] = [];
        const fkGroups = new Map<number, typeof fkInfo>();
        for (const fk of fkInfo) {
          if (!fkGroups.has(fk.id)) fkGroups.set(fk.id, []);
          fkGroups.get(fk.id)!.push(fk);
        }
        for (const [, group] of fkGroups) {
          foreignKeys.push({
            columns: group.map((f) => f.from),
            referencedTable: group[0].table,
            referencedColumns: group.map((f) => f.to),
          });
        }

        const rowCount = (db.prepare(`SELECT COUNT(*) as cnt FROM "${tableName}"`).get() as { cnt: number }).cnt;

        return {
          name: tableName,
          columns,
          primaryKey: primaryKey.length > 0 ? primaryKey : undefined,
          foreignKeys: foreignKeys.length > 0 ? foreignKeys : undefined,
          rowCount,
        };
      });

      onProgress?.('done', 100, `Parsed ${tables.length} tables`);
      return { source: source.name, type: 'structured', tables };
    } finally {
      db.close();
    }
  }
}
