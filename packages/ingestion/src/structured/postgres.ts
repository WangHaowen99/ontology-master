import pg from 'pg';
import type { IngestedSchema, TableSchema, ColumnSchema, ForeignKey } from '@om/ontology';
import type { DataSource, Ingester, ProgressCallback } from '../types.js';

const { Client } = pg;

export class PostgresIngester implements Ingester {
  readonly supportedTypes = ['postgres'] as const;

  async ingest(source: DataSource, onProgress?: ProgressCallback): Promise<IngestedSchema> {
    onProgress?.('connecting', 10, `Connecting to PostgreSQL: ${source.name}`);

    const client = new Client({ connectionString: source.url });
    await client.connect();

    try {
      const tablesResult = await client.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
      );

      const tableNames = tablesResult.rows.map((r: { table_name: string }) => r.table_name);
      onProgress?.('analyzing', 30, `Found ${tableNames.length} tables`);

      const tables: TableSchema[] = [];

      for (const tableName of tableNames) {
        const columnsResult = await client.query(
          `SELECT column_name, data_type, is_nullable, column_default
           FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1
           ORDER BY ordinal_position`,
          [tableName]
        );

        const pkResult = await client.query(
          `SELECT a.attname
           FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
           WHERE i.indrelid = $1::regclass AND i.indisprimary`,
          [`public.${tableName}`]
        );

        const fkResult = await client.query(
          `SELECT
             kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
           FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
           JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
           WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1`,
          [tableName]
        );

        const columns: ColumnSchema[] = columnsResult.rows.map((col: Record<string, string>) => ({
          name: col.column_name,
          dataType: col.data_type,
          nullable: col.is_nullable === 'YES',
          unique: false,
          sampleValues: [],
        }));

        const primaryKey = pkResult.rows.map((r: { attname: string }) => r.attname);

        const fkMap = new Map<string, ForeignKey>();
        for (const fk of fkResult.rows) {
          const key = fk.foreign_table;
          if (!fkMap.has(key)) {
            fkMap.set(key, { columns: [], referencedTable: fk.foreign_table, referencedColumns: [] });
          }
          fkMap.get(key)!.columns.push(fk.column_name);
          fkMap.get(key)!.referencedColumns.push(fk.foreign_column);
        }

        const countResult = await client.query(`SELECT COUNT(*) as cnt FROM "${tableName}"`);

        tables.push({
          name: tableName,
          columns,
          primaryKey: primaryKey.length > 0 ? primaryKey : undefined,
          foreignKeys: fkMap.size > 0 ? Array.from(fkMap.values()) : undefined,
          rowCount: parseInt(countResult.rows[0].cnt, 10),
        });
      }

      onProgress?.('done', 100, `Parsed ${tables.length} tables`);
      return { source: source.name, type: 'structured', tables };
    } finally {
      await client.end();
    }
  }
}
