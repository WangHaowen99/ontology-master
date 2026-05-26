import mysql from 'mysql2/promise';
import type { IngestedSchema, TableSchema, ColumnSchema, ForeignKey } from '@om/ontology';
import type { DataSource, Ingester, ProgressCallback } from '../types.js';

export class MysqlIngester implements Ingester {
  readonly supportedTypes = ['mysql'] as const;

  async ingest(source: DataSource, onProgress?: ProgressCallback): Promise<IngestedSchema> {
    onProgress?.('connecting', 10, `Connecting to MySQL: ${source.name}`);

    const conn = await mysql.createConnection(source.url!);

    try {
      const [tables] = await conn.query(
        `SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`
      ) as [Array<{ TABLE_NAME: string; TABLE_ROWS: number }>, unknown];

      onProgress?.('analyzing', 30, `Found ${tables.length} tables`);

      const result: TableSchema[] = [];

      for (const table of tables) {
        const [columns] = await conn.query(
          `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
           ORDER BY ORDINAL_POSITION`,
          [table.TABLE_NAME]
        ) as [Array<{ COLUMN_NAME: string; DATA_TYPE: string; IS_NULLABLE: string; COLUMN_KEY: string }>, unknown];

        const [fks] = await conn.query(
          `SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
           FROM information_schema.KEY_COLUMN_USAGE
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
          [table.TABLE_NAME]
        ) as [Array<{ COLUMN_NAME: string; REFERENCED_TABLE_NAME: string; REFERENCED_COLUMN_NAME: string }>, unknown];

        const colSchemas: ColumnSchema[] = columns.map((col) => ({
          name: col.COLUMN_NAME,
          dataType: col.DATA_TYPE,
          nullable: col.IS_NULLABLE === 'YES',
          unique: col.COLUMN_KEY === 'UNI' || col.COLUMN_KEY === 'PRI',
          sampleValues: [],
        }));

        const primaryKey = columns.filter((c) => c.COLUMN_KEY === 'PRI').map((c) => c.COLUMN_NAME);

        const fkMap = new Map<string, ForeignKey>();
        for (const fk of fks) {
          const key = fk.REFERENCED_TABLE_NAME;
          if (!fkMap.has(key)) {
            fkMap.set(key, { columns: [], referencedTable: fk.REFERENCED_TABLE_NAME, referencedColumns: [] });
          }
          fkMap.get(key)!.columns.push(fk.COLUMN_NAME);
          fkMap.get(key)!.referencedColumns.push(fk.REFERENCED_COLUMN_NAME);
        }

        result.push({
          name: table.TABLE_NAME,
          columns: colSchemas,
          primaryKey: primaryKey.length > 0 ? primaryKey : undefined,
          foreignKeys: fkMap.size > 0 ? Array.from(fkMap.values()) : undefined,
          rowCount: table.TABLE_ROWS,
        });
      }

      onProgress?.('done', 100, `Parsed ${result.length} tables`);
      return { source: source.name, type: 'structured', tables: result };
    } finally {
      await conn.end();
    }
  }
}
