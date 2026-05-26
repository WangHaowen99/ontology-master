import type Database from 'better-sqlite3';
import type { OntologyModel } from '@om/ontology';
import { createOntology } from '@om/ontology';

export interface Project {
  id: string;
  name: string;
  description?: string;
  ontologyIRI?: string;
  prefix: string;
  model: OntologyModel;
  createdAt: string;
  updatedAt: string;
}

export class ProjectRepository {
  constructor(private db: Database.Database) {}

  /** Create a new project */
  create(name: string, options?: { description?: string; iri?: string; prefix?: string }): Project {
    const id = crypto.randomUUID();
    const prefix = options?.prefix ?? 'om';
    const iri = options?.iri ?? `http://example.org/${prefix}`;
    const model = createOntology(iri, prefix, { title: name, description: options?.description });

    this.db.prepare(
      `INSERT INTO projects (id, name, description, ontology_iri, prefix, model_json) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, name, options?.description ?? '', iri, prefix, JSON.stringify(model));

    return {
      id,
      name,
      description: options?.description,
      ontologyIRI: iri,
      prefix,
      model,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /** List all projects */
  list(): Project[] {
    const rows = this.db.prepare(`SELECT * FROM projects ORDER BY updated_at DESC`).all() as Array<Record<string, unknown>>;
    return rows.map(this.rowToProject);
  }

  /** Get a project by ID */
  get(id: string): Project | undefined {
    const row = this.db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToProject(row) : undefined;
  }

  /** Update the ontology model JSON */
  updateModel(id: string, model: OntologyModel): void {
    this.db.prepare(
      `UPDATE projects SET model_json = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(JSON.stringify(model), id);
  }

  /** Delete a project */
  delete(id: string): boolean {
    const result = this.db.prepare(`DELETE FROM projects WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  private rowToProject(row: Record<string, unknown>): Project {
    return {
      id: row.id as string,
      name: row.name as string,
      description: (row.description as string) || undefined,
      ontologyIRI: (row.ontology_iri as string) || undefined,
      prefix: (row.prefix as string) ?? 'om',
      model: JSON.parse(row.model_json as string) as OntologyModel,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
