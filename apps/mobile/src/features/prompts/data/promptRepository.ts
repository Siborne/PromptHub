import type { Prompt } from '@prompthub/shared/types';
import { getDatabase } from '@/storage/database';

export type MobilePromptSummary = Pick<
  Prompt,
  'id' | 'title' | 'description' | 'tags' | 'isFavorite' | 'updatedAt' | 'userPrompt' | 'systemPrompt'
>;

class SQLLitePromptRepository {
  async list(): Promise<MobilePromptSummary[]> {
    const db = getDatabase();
    // Expo SQLite openDatabaseSync allows running sync queries with getAllSync
    const rows = db.getAllSync('SELECT * FROM prompts ORDER BY updated_at DESC') as any[];
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      tags: row.tags ? JSON.parse(row.tags) : [],
      isFavorite: Boolean(row.is_favorite),
      updatedAt: new Date(row.updated_at).toISOString(),
      userPrompt: row.user_prompt,
      systemPrompt: row.system_prompt,
    }));
  }

  async getById(id: string): Promise<MobilePromptSummary | null> {
    const db = getDatabase();
    const row = db.getFirstSync('SELECT * FROM prompts WHERE id = ?', [id]) as any;
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      tags: row.tags ? JSON.parse(row.tags) : [],
      isFavorite: Boolean(row.is_favorite),
      updatedAt: new Date(row.updated_at).toISOString(),
      userPrompt: row.user_prompt,
      systemPrompt: row.system_prompt,
    };
  }

  async create(prompt: Omit<MobilePromptSummary, 'updatedAt'>): Promise<void> {
    const db = getDatabase();
    const now = Date.now();
    db.runSync(
      `INSERT INTO prompts (
        id, title, description, system_prompt, user_prompt, tags, is_favorite, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        prompt.id,
        prompt.title,
        prompt.description ?? null,
        prompt.systemPrompt ?? null,
        prompt.userPrompt,
        JSON.stringify(prompt.tags),
        prompt.isFavorite ? 1 : 0,
        now,
        now,
      ]
    );
  }

  async update(id: string, updates: Partial<MobilePromptSummary>): Promise<void> {
    const db = getDatabase();
    const now = Date.now();

    // Fetch existing
    const existing = await this.getById(id);
    if (!existing) throw new Error('Prompt not found');

    const updated = { ...existing, ...updates };

    db.runSync(
      `UPDATE prompts SET
        title = ?,
        description = ?,
        system_prompt = ?,
        user_prompt = ?,
        tags = ?,
        is_favorite = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        updated.title,
        updated.description ?? null,
        updated.systemPrompt ?? null,
        updated.userPrompt,
        JSON.stringify(updated.tags),
        updated.isFavorite ? 1 : 0,
        now,
        id,
      ]
    );
  }

  async delete(id: string): Promise<void> {
    const db = getDatabase();
    db.runSync('DELETE FROM prompts WHERE id = ?', [id]);
  }
}

export const promptRepository = new SQLLitePromptRepository();
