/**
 * @file drafts.svelte.ts
 * 管理暫存圖片的本地編輯草稿
 */

import { getContext, setContext } from "svelte";
import { getPageDataContext } from "./page-data.svelte";

/** 一張暫存圖片的本地編輯草稿 */
export type Draft = { name: string; rating: number; tags: string[] };

/** 所有檔案共用的編輯基準，暫存圖片還沒有任何紀錄，基準恆為空白，因此是純值而非快照 */
const baseline = (): Draft => ({ name: "", rating: 0, tags: [] });

/** 去掉副檔名的檔名，也就是名稱留空時的生效名稱 */
export const stripExt = (filename: string): string => filename.replace(/\.[^.]+$/, "");

class DraftsController {
  private pageData = getPageDataContext();

  private drafts = $state<Record<string, Draft>>({});

  /** 被編輯過的圖片檔名；以目前暫存清單為準過濾，避免匯入後殘留已離開暫存區的幽靈草稿 */
  touchedFiles = $derived(this.pageData.value.stagedFiles.filter((f) => f in this.drafts));

  /** 被編輯過且目前可提交的張數 */
  readyCount = $derived(this.touchedFiles.filter((f) => this.problemOf(f) === null).length);

  /** 草稿是否偏離基準值；基準的標籤恆為空，所以不需要比對標籤集合 */
  private isTouched(d: Draft): boolean {
    return d.name.trim() !== "" || d.rating !== 0 || d.tags.length > 0;
  }

  /** 對指定檔名套用一次欄位變更。沒有草稿時先建立一份，寫入後若結果回到基準值，則捨棄草稿 */
  private mutate(filename: string, patch: (d: Draft) => Draft) {
    const next = patch(this.drafts[filename] ?? baseline());
    if (!this.isTouched(next)) {
      this.discard(filename);
      return;
    }
    this.drafts[filename] = next;
  }

  /** 對指定檔名捨棄草稿，應作為唯一的清除入口 */
  private discard(filename: string) {
    if (!(filename in this.drafts)) return;
    delete this.drafts[filename];
  }

  // ---

  /** 指定檔名的實際草稿，若未有草稿則為 `undefined` */
  draftOf(filename: string): Draft | undefined {
    return this.drafts[filename];
  }

  /** 指定檔名的唯讀欄位內容。有草稿時為草稿內容，沒有時則是基準值 */
  viewOf(filename: string): Readonly<Draft> {
    return this.drafts[filename] ?? baseline();
  }

  /** 指定檔名實際生效的名稱：草稿留空時沿用去副檔名的檔名 */
  nameOf(filename: string): string {
    return this.viewOf(filename).name.trim() || stripExt(filename);
  }

  /** 指定檔名的欄位內容是否有問題，以及在有問題時的描述 */
  problemOf(filename: string): string | null {
    const d = this.viewOf(filename);
    // 與 committed 不同，名稱可留空，留空時由後端沿用去副檔名的檔名
    if (d.name.length > 200) return "名稱不可超過 200 字元";
    if (d.tags.length === 0) return "至少需要一個標籤";
    for (const t of d.tags) {
      if (t.trim().length === 0) return "標籤不可為空";
      if (t.trim().length > 50) return `標籤「${t}」不可超過 50 字元`;
      if (t.includes(",")) return `標籤「${t}」不可包含逗號`;
    }
    return null;
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

  /** 捨棄全部草稿 */
  handleDiscardAll = () => {
    for (const f of Object.keys(this.drafts)) this.discard(f);
  };
}

const key = Symbol("drafts-controller");

export const createDraftsContext = () => {
  const controller = new DraftsController();
  setContext(key, controller);
  return controller;
};

export const getDraftsContext = () => getContext<DraftsController>(key);
