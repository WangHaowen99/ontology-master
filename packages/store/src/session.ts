import type Database from 'better-sqlite3';

/** Simplified message format — no pi-agent dependency */
export interface StoredMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
}

export interface AgentSession {
  id: string;
  projectId: string;
  messages: StoredMessage[];
  createdAt: string;
  updatedAt: string;
}

export class SessionRepository {
  constructor(private db: Database.Database) {}

  create(projectId: string): AgentSession {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO agent_sessions (id, project_id, messages_json, created_at, updated_at) VALUES (?, ?, '[]', ?, ?)`
    ).run(id, projectId, now, now);
    return { id, projectId, messages: [], createdAt: now, updatedAt: now };
  }

  getLatest(projectId: string): AgentSession | undefined {
    const row = this.db.prepare(
      `SELECT * FROM agent_sessions WHERE project_id = ? ORDER BY updated_at DESC LIMIT 1`
    ).get(projectId) as Record<string, unknown> | undefined;

    if (!row) return undefined;
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      messages: JSON.parse(row.messages_json as string) as StoredMessage[],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  updateMessages(id: string, messages: StoredMessage[]): void {
    this.db.prepare(
      `UPDATE agent_sessions SET messages_json = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(JSON.stringify(messages), id);
  }
}
