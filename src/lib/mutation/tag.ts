/**
 * @file tag.ts
 * 標籤操作 rename / delete / setMeta
 */

import { sortCollator } from "$lib/utils/shared";
import type { Database } from "$lib/database";

import type { LastTag, Result, Validation } from "./result";
import { Validator } from "./validator";
import { ok, invalid, lastTag } from "./result";

/** 標籤正規化：修剪 + 自然排序 */
function normalizeTags(tags: string[]): string[] {
  return tags.map((t) => t.trim()).toSorted(sortCollator.compare);
}

export class TagCommands {
  constructor(private db: Database) {}

  /**
   * 在所有使用該標籤的圖片中重新命名標籤（含元資料搬移）。
   * 若某筆同時擁有 oldName 與 newName，重複項移除；newName 已有元資料時遵從對方設定。
   */
  rename(oldName: unknown, newName: unknown): Result<{ affected: number }, Validation> {
    if (!Validator.tagName(oldName)) return invalid(["oldName"], "標籤名不合法");
    if (!Validator.tagName(newName)) return invalid(["newName"], "標籤名不合法");

    const from = oldName.trim();
    const to = newName.trim();
    if (from === to) return ok({ affected: 0 });

    const db = this.db;
    const bits = db.tagBits(from);
    let affected = 0;

    if (bits) {
      for (const ordinal of [...bits.values()]) {
        const id = db.idOf(ordinal);
        if (id === null) continue;

        const record = db.getImage(id);
        if (!record) continue;

        const nextTags = record.tags.includes(to)
          ? record.tags.filter((t) => t !== from)
          : normalizeTags(record.tags.map((t) => (t === from ? to : t)));

        db.setImage(id, { ...record, tags: nextTags });
        affected++;
      }
    }

    // 元資料搬移：newName 已有設定時遵從對方
    const metaNames = db.tagMetaEntries().map(([name]) => name);
    if (metaNames.includes(from)) {
      if (!metaNames.includes(to)) db.setTagMeta(to, db.getTagMeta(from));
      db.deleteTagMeta(from);
    }

    db.rebuild();
    db.markDirty();

    return ok({ affected });
  }

  /**
   * 從所有使用該標籤的圖片中移除指定標籤，並刪除其元資料。
   * 任何圖片都不得因此失去最後一個標籤（否則回 LastTag，帶受影響的 id）。
   */
  delete(name: unknown): Result<{ affected: number }, LastTag | Validation> {
    if (!Validator.tagName(name)) return invalid(["name"], "標籤名不合法");
    const target = name.trim();

    const db = this.db;
    const bits = db.tagBits(target);

    if (bits) {
      const wouldEmpty: string[] = [];

      for (const ordinal of bits.values()) {
        const id = db.idOf(ordinal);
        if (id === null) continue;

        const record = db.getImage(id);
        if (record && record.tags.length === 1) wouldEmpty.push(id);
      }

      if (wouldEmpty.length > 0) return lastTag(wouldEmpty);
    }

    let affected = 0;

    if (bits) {
      for (const ordinal of [...bits.values()]) {
        const id = db.idOf(ordinal);
        if (id === null) continue;

        const record = db.getImage(id);
        if (!record) continue;

        db.setImage(id, { ...record, tags: record.tags.filter((t) => t !== target) });
        affected++;
      }
    }

    const hadMeta = db.tagMetaEntries().some(([n]) => n === target);
    db.deleteTagMeta(target);

    if (affected > 0 || hadMeta) {
      db.rebuild();
      db.markDirty();
    }

    return ok({ affected });
  }

  /**
   * 覆寫標籤元資料
   */
  setMeta(name: unknown, meta: unknown): Result<void, Validation> {
    if (!Validator.tagName(name)) return invalid(["name"], "標籤名不合法");
    if (!Validator.tagMeta(meta)) return invalid(["meta"], "標籤元資料不合法");

    this.db.setTagMeta(name.trim(), meta);
    this.db.markDirty();

    return ok(undefined);
  }
}
