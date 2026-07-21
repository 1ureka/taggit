/**
 * @file schedule.svelte.ts
 * 建議卡片排入的清理操作：每個標籤同時只會有一種排程（合併／刪除／隱藏），
 * 直接以標籤名稱為鍵存放單一狀態物件，不另外維護一份可能失去同步的索引。
 * 合併目標一律是既有標籤（來自建議引擎），因此連帶的 fromCount/toCount/both 在排程當下就已知，
 * 審查清單不需要再回頭查詢任何標籤資料。
 */

import type { BeforeNavigate } from "@sveltejs/kit";
import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";
import { page } from "$app/state";

import { addToast } from "$lib/components/floating/toast-events";
import { requestConfirm } from "$lib/components/widgets/confirm-events";
import { getOperationsContext } from "./operations.svelte";

type MergeEntry = { to: string; fromCount: number; toCount: number; both: number };
type CountEntry = { count: number };

export type ScheduleState = {
  renames: Record<string, MergeEntry>;
  deletes: Record<string, CountEntry>;
  hidden: Record<string, CountEntry>;
};

export type CleanupOperationKind = "merge" | "delete" | "hidden";

/** 扁平化排程狀態後，每個標籤的操作項目 */
export type CleanupOperation =
  | { kind: "merge"; name: string; count: number; to: string; toCount: number; both: number }
  | { kind: "delete"; name: string; count: number }
  | { kind: "hidden"; name: string; count: number };

function operationsFromSchedule(state: ScheduleState): CleanupOperation[] {
  const ops: CleanupOperation[] = [];
  for (const [name, m] of Object.entries(state.renames)) {
    ops.push({ kind: "merge", name, count: m.fromCount, to: m.to, toCount: m.toCount, both: m.both });
  }
  for (const [name, d] of Object.entries(state.deletes)) ops.push({ kind: "delete", name, count: d.count });
  for (const [name, h] of Object.entries(state.hidden)) ops.push({ kind: "hidden", name, count: h.count });
  return ops;
}

class ScheduleController {
  private operationsCtx = getOperationsContext();

  private state = $state<ScheduleState>({ renames: {}, deletes: {}, hidden: {} });

  /** 目前排程的操作清單（供審查彈窗投影） */
  operations = $derived(operationsFromSchedule(this.state));
  /** 已排程的標籤數量 */
  touchedCount = $derived(
    Object.keys(this.state.renames).length + Object.keys(this.state.deletes).length + Object.keys(this.state.hidden).length,
  );

  /** 指定標籤目前排入的操作種類，未排入為 `null` */
  statusOf = (name: string): CleanupOperationKind | null => {
    if (name in this.state.renames) return "merge";
    if (name in this.state.deletes) return "delete";
    if (name in this.state.hidden) return "hidden";
    return null;
  };

  /** 同一標籤只能有一種排程：先清掉舊的，再寫入新的 */
  private clear(name: string) {
    delete this.state.renames[name];
    delete this.state.deletes[name];
    delete this.state.hidden[name];
  }

  handleScheduleMerge = (from: string, to: string, fromCount: number, toCount: number, both: number) => {
    this.clear(from);
    this.state.renames[from] = { to, fromCount, toCount, both };
  };

  handleScheduleDelete = (name: string, count: number) => {
    this.clear(name);
    this.state.deletes[name] = { count };
  };

  handleScheduleHide = (name: string, count: number) => {
    this.clear(name);
    this.state.hidden[name] = { count };
  };

  /** 復原指定標籤的排程 */
  handleUndo = (name: string) => {
    this.clear(name);
  };

  /** 唯讀存取目前排程狀態，僅供送出流程轉換 payload 使用 */
  snapshot = (): ScheduleState => this.state;

  /** 清空整個排程（只在確認離頁後呼叫） */
  private clearAll() {
    this.state = { renames: {}, deletes: {}, hidden: {} };
  }

  /** 客戶端導航離頁守衛 */
  handleBeforeNavigate = (nav: BeforeNavigate) => {
    if (nav.type === "leave") return;

    const to = nav.to;
    const leaving = to === null || to.url.pathname !== page.url.pathname;
    if (!leaving) return; // 同頁的換頁/篩選 goto 不攔

    if (this.operationsCtx.pending) {
      nav.cancel();
      addToast({ message: "操作進行中，請稍候", variant: "info" });
      return;
    }

    if (this.touchedCount === 0) return;

    nav.cancel();
    if (to === null) return;

    const msg = `還有 ${this.touchedCount} 筆標籤操作尚未送出，離開將會遺失這些排程。確定要離開？`;
    requestConfirm(msg, { title: "尚未送出的標籤操作", action: "離開" }).then((confirmed) => {
      if (!confirmed) return;
      this.clearAll();
      goto(to.url.href);
    });
  };

  /** 卸載／重新整理整頁前的守衛：有未送出的操作或操作進行中時提示 */
  handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (this.touchedCount > 0 || this.operationsCtx.pending) {
      e.preventDefault();
      e.returnValue = ""; // 部分瀏覽器需一併設定才會顯示離開確認
    }
  };
}

const key = Symbol("schedule-controller");

export const createScheduleContext = () => {
  const controller = new ScheduleController();
  setContext(key, controller);
  return controller;
};

export const getScheduleContext = () => getContext<ScheduleController>(key);
