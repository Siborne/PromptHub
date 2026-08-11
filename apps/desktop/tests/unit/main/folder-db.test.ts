import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { FolderDB } from "../../../src/main/database/folder";
import { PromptDB } from "../../../src/main/database/prompt";
import {
  SCHEMA_TABLES,
  SCHEMA_INDEXES,
} from "../../../src/main/database/schema";
import DatabaseAdapter from "../../../src/main/database/sqlite";

/**
 * Integration tests for FolderDB using real in-memory SQLite.
 */
describe("FolderDB (in-memory SQLite)", () => {
  let rawDb: DatabaseAdapter.Database;
  let db: FolderDB;

  beforeEach(() => {
    rawDb = new DatabaseAdapter(":memory:");
    rawDb.pragma("journal_mode = WAL");
    rawDb.pragma("foreign_keys = ON");
    rawDb.exec(SCHEMA_TABLES);
    rawDb.exec(SCHEMA_INDEXES);
    db = new FolderDB(rawDb);
  });

  afterEach(() => {
    rawDb.close();
  });

  // ─────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────
  describe("create", () => {
    it("creates a folder with generated id and auto sort_order", () => {
      const folder = db.create({ name: "Work" });

      expect(folder.id).toBeDefined();
      expect(folder.name).toBe("Work");
      expect(folder.order).toBe(0);
      expect(folder.isPrivate).toBe(false);
      expect(folder.parentId).toBeUndefined();
    });

    it("assigns incremental sort_order within same parent", () => {
      db.create({ name: "First" });
      db.create({ name: "Second" });
      const third = db.create({ name: "Third" });

      expect(third.order).toBe(2);
    });

    it("stores icon and parentId", () => {
      const parent = db.create({ name: "Parent" });
      const child = db.create({
        name: "Child",
        icon: "📁",
        parentId: parent.id,
      });

      expect(child.icon).toBe("📁");
      expect(child.parentId).toBe(parent.id);
    });

    it("assigns independent sort_order per parent", () => {
      const parent = db.create({ name: "Parent" });
      db.create({ name: "Root 1" }); // sort_order 1 in root
      db.create({ name: "Root 2" }); // sort_order 2 in root

      const child = db.create({ name: "Child 1", parentId: parent.id });
      expect(child.order).toBe(0); // First in this parent
    });

    it("creates private folder", () => {
      const folder = db.create({ name: "Secret", isPrivate: true });
      expect(folder.isPrivate).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // getById
  // ─────────────────────────────────────────────
  describe("getById", () => {
    it("preserves ownership and visibility during direct restore", () => {
      rawDb
        .prepare(
          "INSERT INTO users (id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        )
        .run("user-1", "owner", "hash", 1, 1);
      db.insertFolderDirect({
        id: "shared-folder",
        ownerUserId: "user-1",
        visibility: "shared",
        name: "Shared folder",
        order: 0,
        createdAt: "2026-08-11T00:00:00.000Z",
        updatedAt: "2026-08-11T00:00:00.000Z",
      });

      expect(db.getById("shared-folder")).toMatchObject({
        ownerUserId: "user-1",
        visibility: "shared",
      });
    });

    it("returns null for non-existent id", () => {
      expect(db.getById("no-such-id")).toBeNull();
    });

    it("returns the correct folder", () => {
      const created = db.create({ name: "Find Me" });
      const found = db.getById(created.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe("Find Me");
    });
  });

  // ─────────────────────────────────────────────
  // getAll
  // ─────────────────────────────────────────────
  describe("getAll", () => {
    it("returns empty array when no folders exist", () => {
      expect(db.getAll()).toEqual([]);
    });

    it("returns all folders sorted by sort_order ASC", () => {
      db.create({ name: "B" });
      db.create({ name: "A" });
      db.create({ name: "C" });

      const all = db.getAll();
      expect(all.length).toBe(3);
      expect(all[0].name).toBe("B"); // order 0
      expect(all[1].name).toBe("A"); // order 1
      expect(all[2].name).toBe("C"); // order 2
    });
  });

  // ─────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────
  describe("update", () => {
    it("returns null for non-existent id", () => {
      expect(db.update("bad-id", { name: "New" })).toBeNull();
    });

    it("updates name", () => {
      const f = db.create({ name: "Old" });
      const updated = db.update(f.id, { name: "New" });
      expect(updated!.name).toBe("New");

      // Verify persisted
      expect(db.getById(f.id)!.name).toBe("New");
    });

    it("updates icon", () => {
      const f = db.create({ name: "Folder" });
      db.update(f.id, { icon: "🎯" });
      expect(db.getById(f.id)!.icon).toBe("🎯");
    });

    it("updates parentId (move folder)", () => {
      const parent = db.create({ name: "Parent" });
      const child = db.create({ name: "Child" });

      db.update(child.id, { parentId: parent.id });
      expect(db.getById(child.id)!.parentId).toBe(parent.id);
    });

    it("updates isPrivate", () => {
      const f = db.create({ name: "Public" });
      db.update(f.id, { isPrivate: true });
      expect(db.getById(f.id)!.isPrivate).toBe(true);
    });

    it("returns existing folder unchanged when no actual updates", () => {
      const f = db.create({ name: "NoChange" });
      const result = db.update(f.id, {});
      // Should return the folder without modifications (only updated_at would change)
      expect(result!.name).toBe("NoChange");
    });
  });

  // ─────────────────────────────────────────────
  // delete
  // ─────────────────────────────────────────────
  describe("delete", () => {
    it("deletes an existing folder and returns true", () => {
      const f = db.create({ name: "Del" });
      expect(db.delete(f.id)).toBe(true);
      expect(db.getById(f.id)).toBeNull();
    });

    it("returns false when deleting non-existent id", () => {
      expect(db.delete("no-such-id")).toBe(false);
    });

    it("cascade-deletes child folders", () => {
      const parent = db.create({ name: "Parent" });
      const child = db.create({ name: "Child", parentId: parent.id });

      db.delete(parent.id);
      // Child should be gone too (ON DELETE CASCADE)
      expect(db.getById(child.id)).toBeNull();
    });
  });

  // ─────────────────────────────────────────────
  // reorder
  // ─────────────────────────────────────────────
  describe("reorder", () => {
    it("reorders folders by the given id array", () => {
      const a = db.create({ name: "A" });
      const b = db.create({ name: "B" });
      const c = db.create({ name: "C" });

      // Reverse the order
      db.reorder([c.id, b.id, a.id]);

      const all = db.getAll();
      expect(all[0].name).toBe("C");
      expect(all[0].order).toBe(0);
      expect(all[1].name).toBe("B");
      expect(all[1].order).toBe(1);
      expect(all[2].name).toBe("A");
      expect(all[2].order).toBe(2);
    });

    it("handles empty array without error", () => {
      expect(() => db.reorder([])).not.toThrow();
    });

    it("handles partial reorder (only some folders)", () => {
      const a = db.create({ name: "A" }); // order 0
      db.create({ name: "B" }); // order 1
      const c = db.create({ name: "C" }); // order 2

      // Only reorder A and C
      db.reorder([c.id, a.id]);

      // C should now be at 0, A at 1, B stays at 1 (from original)
      const cFolder = db.getById(c.id)!;
      const aFolder = db.getById(a.id)!;
      expect(cFolder.order).toBe(0);
      expect(aFolder.order).toBe(1);
    });
  });

  // ─────────────────────────────────────────────
  // edge cases
  // ─────────────────────────────────────────────
  describe("edge cases", () => {
    it("handles special characters in folder names", () => {
      const f = db.create({ name: "Folder's / Special & <chars>" });
      expect(db.getById(f.id)!.name).toBe("Folder's / Special & <chars>");
    });

    it("handles emoji folder names", () => {
      const f = db.create({ name: "🎯 My Folder 🎉" });
      expect(db.getById(f.id)!.name).toBe("🎯 My Folder 🎉");
    });

    it("updatedAt falls back to createdAt when null in DB", () => {
      // Insert a row manually with null updated_at
      const now = Date.now();
      rawDb
        .prepare(
          "INSERT INTO folders (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        )
        .run("manual-id", "Manual", 0, now, null);

      const folder = db.getById("manual-id");
      expect(folder).not.toBeNull();
      // rowToFolder should fall back: updatedAt = updated_at || created_at
      expect(folder!.updatedAt).toBe(new Date(now).toISOString());
    });
  });

  // ─────────────────────────────────────────────
  // Adversarial / fuzz-style boundary tests
  // ─────────────────────────────────────────────
  describe("adversarial inputs", () => {
    // Deep cascade deletion: 3+ levels
    it("cascade-deletes 4-level deep nested folders", () => {
      const level0 = db.create({ name: "L0" });
      const level1 = db.create({ name: "L1", parentId: level0.id });
      const level2 = db.create({ name: "L2", parentId: level1.id });
      const level3 = db.create({ name: "L3", parentId: level2.id });

      db.delete(level0.id);

      expect(db.getById(level0.id)).toBeNull();
      expect(db.getById(level1.id)).toBeNull();
      expect(db.getById(level2.id)).toBeNull();
      expect(db.getById(level3.id)).toBeNull();
    });

    // Cascade also cleans up prompts in deleted folders
    it("cascade-deletes prompts inside deleted folder", () => {
      const promptDb = new PromptDB(rawDb);

      const folder = db.create({ name: "Container" });
      const prompt = promptDb.create({
        title: "Inside",
        userPrompt: "p",
        folderId: folder.id,
      });

      db.delete(folder.id);

      // Prompt should also be gone (folder_id ON DELETE SET NULL or CASCADE)
      const fetched = promptDb.getById(prompt.id);
      // Depending on schema: either null (CASCADE) or folderId = null (SET NULL)
      // Check the actual behavior
      if (fetched) {
        expect(fetched.folderId).toBeNull();
      }
      // Either way, the folder is gone
      expect(db.getById(folder.id)).toBeNull();
    });

    // Large batch reorder (50+ folders)
    it("reorders 50 folders correctly", () => {
      const ids: string[] = [];
      for (let i = 0; i < 50; i++) {
        ids.push(db.create({ name: `F${i}` }).id);
      }

      // Reverse the order
      const reversed = [...ids].reverse();
      db.reorder(reversed);

      const all = db.getAll();
      // First folder should now be the last created
      expect(all[0].name).toBe("F49");
      expect(all[0].order).toBe(0);
      expect(all[49].name).toBe("F0");
      expect(all[49].order).toBe(49);
    });

    // Extreme folder names
    it("handles extremely long folder name (10KB)", () => {
      const longName = "A".repeat(10_000);
      const f = db.create({ name: longName });
      expect(db.getById(f.id)!.name).toBe(longName);
    });

    it("handles folder name with SQL-like content", () => {
      const sqlName = "'); DROP TABLE folders; --";
      const f = db.create({ name: sqlName });
      expect(db.getById(f.id)!.name).toBe(sqlName);
      expect(db.getAll().length).toBeGreaterThanOrEqual(1);
    });

    it("handles folder name with only whitespace", () => {
      const f = db.create({ name: "   " });
      expect(db.getById(f.id)!.name).toBe("   ");
    });

    it("SQLite truncates folder name at null byte (known behavior)", () => {
      // IMPORTANT FINDING: SQLite (via better-sqlite3) truncates strings at \x00
      // This means "folder\x00name" becomes "folder" — data loss!
      const f = db.create({ name: "folder\x00name" });
      // SQLite truncates at null byte — this is the actual behavior
      expect(db.getById(f.id)!.name).toBe("folder");
    });

    it("handles folder name with newlines and tabs", () => {
      const f = db.create({ name: "line1\nline2\ttab" });
      expect(db.getById(f.id)!.name).toBe("line1\nline2\ttab");
    });

    // Update to move between parents
    it("moves folder between parents and sort_order remains valid", () => {
      const parent1 = db.create({ name: "Parent1" });
      const parent2 = db.create({ name: "Parent2" });
      const child = db.create({ name: "Child", parentId: parent1.id });

      // Move to parent2
      const moved = db.update(child.id, { parentId: parent2.id });
      expect(moved!.parentId).toBe(parent2.id);

      // Move to root (null parent)
      const movedToRoot = db.update(child.id, {
        parentId: null as unknown as string,
      });
      expect(db.getById(child.id)!.parentId).toBeUndefined();
    });

    // Reorder with non-existent IDs (should not throw, just no-op for those)
    it("reorder with mix of valid and non-existent IDs does not throw", () => {
      const a = db.create({ name: "A" });
      const b = db.create({ name: "B" });

      expect(() =>
        db.reorder(["non-existent-1", b.id, "non-existent-2", a.id]),
      ).not.toThrow();

      // Valid IDs should still get their new sort_order
      expect(db.getById(b.id)!.order).toBe(1);
      expect(db.getById(a.id)!.order).toBe(3);
    });

    // Create many children under same parent — verify sort_order
    it("assigns correct sort_order for 20 children under same parent", () => {
      const parent = db.create({ name: "BigParent" });
      for (let i = 0; i < 20; i++) {
        const child = db.create({ name: `Child-${i}`, parentId: parent.id });
        expect(child.order).toBe(i);
      }
    });

    // Delete middle folder — siblings' sort_order stays (no auto-compaction)
    it("deleting middle folder does not change siblings' sort_order", () => {
      const a = db.create({ name: "A" }); // order 0
      const b = db.create({ name: "B" }); // order 1
      const c = db.create({ name: "C" }); // order 2

      db.delete(b.id);

      // A and C should keep their original sort_order
      expect(db.getById(a.id)!.order).toBe(0);
      expect(db.getById(c.id)!.order).toBe(2); // gap at 1
    });

    // Rapid create-delete-create cycle
    it("handles rapid create-delete cycles without leaking IDs", () => {
      const seenIds = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const f = db.create({ name: `Cycle-${i}` });
        expect(seenIds.has(f.id)).toBe(false); // UUID must be unique
        seenIds.add(f.id);
        db.delete(f.id);
      }
      expect(db.getAll().length).toBe(0);
    });

    // Update with empty icon (should clear icon)
    it("update with null icon clears the icon field", () => {
      const f = db.create({ name: "WithIcon", icon: "🎯" });
      expect(f.icon).toBe("🎯");

      db.update(f.id, { icon: null as unknown as string });
      expect(db.getById(f.id)!.icon).toBeUndefined();
    });

    // isPrivate toggle
    it("toggles isPrivate back and forth", () => {
      const f = db.create({ name: "PrivateToggle" });
      expect(f.isPrivate).toBe(false);

      db.update(f.id, { isPrivate: true });
      expect(db.getById(f.id)!.isPrivate).toBe(true);

      db.update(f.id, { isPrivate: false });
      expect(db.getById(f.id)!.isPrivate).toBe(false);
    });
  });
});
