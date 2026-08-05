/**
 * @file schedule.svelte.ts
 * 建議卡片排入的清理操作：每個標籤同時只會有一種排程
 */

import { getContext, setContext } from "svelte";
import { SvelteMap } from "svelte/reactivity";
import type { Tag } from "$lib/database";
import type { Suggestion } from "./page-data.svelte";

/** 排入的一筆清理操作 */
export type CleanupOperation =
  | { kind: "merge"; name: string; count: number; to: string; toCount: number; both: number }
  | { kind: "delete"; name: string; count: number }
  | { kind: "hidden"; name: string; count: number };

/**
 * 這則建議涉及的標籤名稱，用來判斷卡片上是否已有排入的操作。
 * 與 `samples` 的「有樣本圖可查的標籤」語意不同，兩者刻意不共用。
 */
function namesOf(s: Suggestion): string[] {
  return s.kind === "similar" || s.kind === "cooccur" ? [s.a.name, s.b.name] : [s.tag.name];
}

class ScheduleController {
  /** 標籤名 → 操作；Map 的插入順序即審查清單的順序 */
  private opMap = new SvelteMap<string, CleanupOperation>();

  /** 目前排程的所有操作 */
  operations: readonly CleanupOperation[] = $derived([...this.opMap.values()]);

  /** 指定標籤目前的操作，未排入為 `undefined` */
  operationOf = (name: string): CleanupOperation | undefined => this.opMap.get(name);

  /** 指定標籤目前排入的操作種類，未排入為 `null` */
  statusOf = (name: string): CleanupOperation["kind"] | null => this.opMap.get(name)?.kind ?? null;

  /** 這則建議涉及的標籤中已被排入操作的那一個，都沒有則為 `undefined` */
  scheduledNameOf = (s: Suggestion): string | undefined => namesOf(s).find((n) => this.opMap.has(n));

  /** 指定標籤的操作是否有問題，以及在有問題時的描述；沒有操作時恆為 `null` */
  problemOf(name: string): string | null {
    const op = this.opMap.get(name);
    if (op === undefined || op.kind !== "merge") return null;

    const target = this.opMap.get(op.to);
    if (target?.kind === "merge") return `目標「${op.to}」本身也被排入合併`;
    if (target?.kind === "delete") return `目標「${op.to}」已被排入刪除`;

    return null;
  }

  // ---

  /** 把 `from` 合併進 `to`；`both` 是兩者同時擁有的圖片張數，用來推算合併後總數 */
  handleScheduleMerge = (from: Tag, to: Tag, both: number) => {
    this.opMap.set(from.name, {
      kind: "merge",
      name: from.name,
      count: from.count,
      to: to.name,
      toCount: to.count,
      both,
    });
  };

  handleScheduleDelete = (tag: Tag) => {
    this.opMap.set(tag.name, { kind: "delete", name: tag.name, count: tag.count });
  };

  handleScheduleHide = (tag: Tag) => {
    this.opMap.set(tag.name, { kind: "hidden", name: tag.name, count: tag.count });
  };

  /** 復原指定標籤的排程 */
  handleUndo = (name: string) => {
    this.opMap.delete(name);
  };

  /** 清空整個排程（只在確認離頁後呼叫） */
  handleClearAll = () => {
    this.opMap.clear();
  };
}

const key = Symbol("schedule-controller");

export const createScheduleContext = () => {
  const controller = new ScheduleController();
  setContext(key, controller);
  return controller;
};

export const getScheduleContext = () => getContext<ScheduleController>(key);
