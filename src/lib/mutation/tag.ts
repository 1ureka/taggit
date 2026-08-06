/**
 * @file tag.ts
 * 標籤操作 rename / delete / setMeta，以及以標籤名為鍵的批次 applyChanges
 */

import { isRecord, sortCollator } from "$lib/utils/shared";
import type { Database } from "$lib/database";

import type { LastTag, MutationError, NotFound, Result, Validation } from "./result";
import { Validator } from "./validator";
import { ok, invalid, lastTag, notFound } from "./result";

/** 標籤正規化：修剪 + 自然排序 */
function normalizeTags(tags: string[]): string[] {
  return tags.map((t) => t.trim()).toSorted(sortCollator.compare);
}

/** 批次異動中單筆的結果資料；`affected` 為受影響的圖片數，純顯隱異動恆為 0 */
export type TagChangeResult = { affected: number };

/** 單筆異動經驗證後的執行計畫 */
type Plan =
  | { kind: "delete" }
  | { kind: "rename"; to: string; hidden?: boolean }
  | { kind: "hidden"; hidden: boolean }
  | { kind: "invalid"; error: Validation };

/** 把一筆未經驗證的異動值收斂成執行計畫 */
function planOf(value: unknown): Plan {
  if (value === null) return { kind: "delete" };

  if (!isRecord(value)) {
    return { kind: "invalid", error: { kind: "validation", fields: ["change"], message: "異動格式無效" } };
  }

  const hasName = value.name !== undefined;
  const hasHidden = value.hidden !== undefined;

  if (!hasName && !hasHidden) {
    return { kind: "invalid", error: { kind: "validation", fields: ["change"], message: "未指定任何異動" } };
  }

  if (hasHidden && typeof value.hidden !== "boolean") {
    return { kind: "invalid", error: { kind: "validation", fields: ["hidden"], message: "顯隱設定不合法" } };
  }
  const hidden = hasHidden ? (value.hidden as boolean) : undefined;

  if (!hasName) return { kind: "hidden", hidden: hidden! };

  if (!Validator.tagName(value.name)) {
    return { kind: "invalid", error: { kind: "validation", fields: ["name"], message: "標籤名不合法" } };
  }

  return { kind: "rename", to: value.name.trim(), hidden };
}

export class TagCommands {
  constructor(private db: Database) {}

  /**
   * 在所有使用該標籤的圖片中重新命名標籤（含元資料搬移）。
   * 若某筆同時擁有 oldName 與 newName，重複項移除；newName 已有元資料時遵從對方設定。
   */
  rename(oldName: unknown, newName: unknown): Result<{ affected: number }, NotFound | Validation> {
    if (!Validator.tagName(oldName)) return invalid(["oldName"], "標籤名不合法");
    if (!Validator.tagName(newName)) return invalid(["newName"], "標籤名不合法");

    const from = oldName.trim();
    const to = newName.trim();

    const db = this.db;
    const bits = db.tagBits(from);
    const metaNames = db.tagMetaEntries().map(([name]) => name);
    if (!bits && !metaNames.includes(from)) return notFound();

    if (from === to) return ok({ affected: 0 });

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
  delete(name: unknown): Result<{ affected: number }, LastTag | NotFound | Validation> {
    if (!Validator.tagName(name)) return invalid(["name"], "標籤名不合法");
    const target = name.trim();

    const db = this.db;
    const bits = db.tagBits(target);
    const hadMeta = db.tagMetaEntries().some(([n]) => n === target);
    if (!bits && !hadMeta) return notFound();

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

  /**
   * 套用一組以標籤名為鍵的異動。鍵天生唯一，因此「同一標籤同時只能有一種操作」由結構保證，
   * 呼叫端不需要、也無法送出互相矛盾的兩筆。
   *
   * 值的語意：
   * - `null`：刪除該標籤
   * - `{ name }`：改名（合併也是改名，指向既有標籤即為合併）
   * - `{ hidden }`：覆寫顯隱
   * - `{ name, hidden }`：先改名，再對**改名後**的名稱設定顯隱
   *
   * 執行順序固定為 刪除 → 改名 → 顯隱：刪除以原名為準，之後才套用改名，與畫面上的預覽語意一致。
   *
   * 集合層規則：改名目標若同時是本組的另一個鍵，且該鍵將被刪除或本身也要改名，則這筆改名
   * 的最終意圖無法判定，單獨以驗證失敗回報，其餘各筆照常執行（保留部分成功語意）。
   */
  applyChanges(changes: Record<string, unknown>): Record<string, Result<TagChangeResult, MutationError>> {
    const plans = new Map<string, Plan>();
    for (const [name, value] of Object.entries(changes)) plans.set(name, planOf(value));

    // 集合層規則：改名目標與本組其他鍵的衝突
    for (const [name, plan] of plans) {
      if (plan.kind !== "rename" || plan.to === name) continue;

      const target = plans.get(plan.to);
      if (target?.kind === "delete") {
        const message = `目標「${plan.to}」在本組異動中也被刪除`;
        plans.set(name, { kind: "invalid", error: { kind: "validation", fields: ["name"], message } });
      } else if (target?.kind === "rename") {
        const message = `目標「${plan.to}」在本組異動中本身也被改名`;
        plans.set(name, { kind: "invalid", error: { kind: "validation", fields: ["name"], message } });
      }
    }

    const results: Record<string, Result<TagChangeResult, MutationError>> = {};

    for (const [name, plan] of plans) {
      if (plan.kind === "invalid") results[name] = { ok: false, error: plan.error };
      if (plan.kind === "delete") results[name] = this.delete(name);
    }

    for (const [name, plan] of plans) {
      if (plan.kind !== "rename") continue;
      results[name] = this.rename(name, plan.to);
    }

    for (const [name, plan] of plans) {
      if (plan.kind === "hidden") {
        const r = this.setMeta(name, { hidden: plan.hidden });
        results[name] = r.ok ? ok({ affected: 0 }) : r;
        continue;
      }

      // 改名同時帶顯隱：套用在改名後的名稱上；改名本身失敗就不再往下做
      if (plan.kind !== "rename" || plan.hidden === undefined) continue;
      const renamed = results[name];
      if (!renamed.ok) continue;

      const r = this.setMeta(plan.to, { hidden: plan.hidden });
      if (!r.ok) results[name] = r;
    }

    return results;
  }
}
