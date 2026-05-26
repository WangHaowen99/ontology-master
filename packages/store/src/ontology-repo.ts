import type Database from 'better-sqlite3';

export interface DataSourceRecord {
  id: string;
  projectId: string;
  name: string;
  type: string;
  path?: string;
  url?: string;
  schemaJson?: string;
  createdAt: string;
}

export class DataSourceRepository {
  constructor(private db: Database.Database) {}

  create(projectId: string, data: { name: string; type: string; path?: string; url?: string; schemaJson?: string }): DataSourceRecord {
    const id = crypto.randomUUID();
    this.db.prepare(
      `INSERT INTO data_sources (id, project_id, name, type, path, url, schema_json) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, projectId, data.name, data.type, data.path ?? null, data.url ?? null, data.schemaJson ?? null);

    return { id, projectId, ...data, createdAt: new Date().toISOString() };
  }

  listByProject(projectId: string): DataSourceRecord[] {
    const rows = this.db.prepare(
      `SELECT * FROM data_sources WHERE project_id = ? ORDER BY created_at DESC`
    ).all(projectId) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      id: r.id as string,
      projectId: r.project_id as string,
      name: r.name as string,
      type: r.type as string,
      path: (r.path as string) || undefined,
      url: (r.url as string) || undefined,
      schemaJson: (r.schema_json as string) || undefined,
      createdAt: r.created_at as string,
    }));
  }

  delete(id: string): boolean {
    return this.db.prepare(`DELETE FROM data_sources WHERE id = ?`).run(id).changes > 0;
  }
}
