/**
 * @file drafts.svelte.ts
 * 管理已提交圖片的本地編輯草稿
 */

import { getContext, setContext } from "svelte";
import { getSnapshotsContext } from "./snapshots.svelte";

/** 一張已提交圖片的本地編輯草稿 */
export type Draft = { name: string; rating: number; tags: string[] };

class DraftsController {
  private snapshots = getSnapshotsContext();

  private drafts = $state<Record<string, Draft>>({});

  /** 被編輯過的圖片檔名 */
  touchedFiles = $derived(Object.keys(this.drafts));

  /** 建立一份真的草稿，並回傳它 */
  private syntheticDraft(filename: string): Draft {
    const snapshot = this.snapshots.acquire(filename, "drafts");
    return { name: snapshot.name, rating: snapshot.rating, tags: [...snapshot.tags] };
  }

  /** 合成一份臨時的唯讀草稿，並回傳它 */
  private syntheticView(filename: string): Readonly<Draft> {
    const snapshot = this.snapshots.peek(filename);
    return { name: snapshot.name, rating: snapshot.rating, tags: [...snapshot.tags] };
  }

  private sameTagSet(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const set = new Set(a);
    return b.every((t) => set.has(t));
  }

  private isTouched(filename: string, d: Draft): boolean {
    const snapshot = this.snapshots.peek(filename);
    return (
      d.name.trim() !== snapshot.name.trim() || d.rating !== snapshot.rating || !this.sameTagSet(d.tags, snapshot.tags)
    );
  }

  /** 對指定檔名的套用一次欄位變更。沒有草稿時先建立一份，寫入後若結果跟與已知紀錄完全相同，則捨棄草稿 */
  private mutate(filename: string, patch: (d: Draft) => Draft) {
    const next = patch(this.drafts[filename] ?? this.syntheticDraft(filename));
    if (!this.isTouched(filename, next)) {
      this.discard(filename);
      return;
    }
    this.drafts[filename] = next;
  }

  /** 對指定檔名捨棄草稿，應作為唯一方法，確保清除本地狀態與釋放，兩件事永遠一起發生 */
  private discard(filename: string) {
    if (!(filename in this.drafts)) return;
    delete this.drafts[filename];
    this.snapshots.release(filename, "drafts");
  }

  // ---

  /** 指定檔名的實際草稿，若未有草稿則為 `undefined` */
  draftOf(filename: string): Draft | undefined {
    return this.drafts[filename];
  }

  /** 指定檔名的唯讀欄位內容。有草稿時為草稿內容，沒有時則是已知內容 */
  viewOf(filename: string): Readonly<Draft> {
    return this.drafts[filename] ?? this.syntheticView(filename);
  }

  /** 指定檔名的欄位內容是否有問題，以及在有問題時的描述 */
  problemOf(filename: string): string | null {
    const d = this.viewOf(filename);
    if (d.name.trim().length === 0) return "名稱不可為空";
    if (d.name.length > 200) return "名稱不可超過 200 字元";
    if (d.tags.length === 0) return "至少需要一個標籤";
    for (const t of d.tags) {
      if (t.trim().length === 0) return "標籤不可為空";
      if (t.trim().length > 50) return `標籤「${t}」不可超過 50 字元`;
      if (t.includes(",")) return `標籤「${t}」不可包含逗號`;
    }
    return null;
  }

  /** 指定檔名的標籤新增/移除差集 */
  tagDiffOf(filename: string): { added: string[]; removed: string[] } {
    const d = this.viewOf(filename);
    const snapshot = this.snapshots.peek(filename);
    const before = new Set(snapshot.tags);
    const after = new Set(d.tags);
    return { added: d.tags.filter((t) => !before.has(t)), removed: snapshot.tags.filter((t) => !after.has(t)) };
  }

  // ---

  handleSetName = (filenames: string[], name: string) => {
    for (const f of filenames) this.mutate(f, (d) => ({ ...d, name }));
  };

  handleSetRating = (filenames: string[], rating: number) => {
    for (const f of filenames) this.mutate(f, (d) => ({ ...d, rating }));
  };

  /** 注意 `tags` 是覆蓋，增量請使用 `handleAddTags` */
  handleSetTags = (filenames: string[], tags: string[]) => {
    for (const f of filenames) this.mutate(f, (d) => ({ ...d, tags }));
  };

  handleAddTags = (filenames: string[], tags: string[]) => {
    const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
    if (clean.length === 0) return;
    for (const f of filenames) this.mutate(f, (d) => ({ ...d, tags: [...new Set([...d.tags, ...clean])] }));
  };

  handleRemoveTags = (filenames: string[], tags: string[]) => {
    const set = new Set(tags.map((t) => t.trim()).filter(Boolean));
    if (set.size === 0) return;
    for (const f of filenames) this.mutate(f, (d) => ({ ...d, tags: d.tags.filter((t) => !set.has(t)) }));
  };

  /** 捨棄指定檔名目前的草稿 */
  handleDiscardDraft = (filenames: string[]) => {
    for (const f of filenames) this.discard(f);
  };

  /** 捨棄全部草稿（離頁確認後呼叫） */
  handleDiscardAll = () => {
    for (const f of this.touchedFiles) this.discard(f);
  };
}

const key = Symbol("drafts-controller");

export const createDraftsContext = () => {
  const controller = new DraftsController();
  setContext(key, controller);
  return controller;
};

export const getDraftsContext = () => getContext<DraftsController>(key);
