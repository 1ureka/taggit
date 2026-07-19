/**
 * @file board.svelte.ts
 * 管理標籤異動區，包括合併或重命名區、刪除區、隱藏切換區
 */

import type { BeforeNavigate } from "@sveltejs/kit";
import { getContext, setContext } from "svelte";
import { SvelteMap } from "svelte/reactivity";
import { goto } from "$app/navigation";
import { page } from "$app/state";

import type { Tag } from "$lib/database";
import { api } from "$lib/utils/request";
import { addToast } from "$lib/components/floating/toast-events";
import { requestConfirm } from "$lib/widgets/confirm-events";
import { getOperationsContext } from "./operations.svelte";

/** 一個標籤異動區域，刪除與隱藏切換區是固定、永不刪除的單例，合併或重命名區則是動態新增/移除 */
export type Zone =
  | { kind: "delete"; tags: Tag[] }
  | { kind: "hidden"; tags: Tag[] }
  | { kind: "group"; id: string; canonical: string; tags: Tag[]; mergeCount: number | null };

type GroupZone = Extract<Zone, { kind: "group" }>;

export type GroupTarget = { kind: "delete" | "hidden" } | { kind: "group"; id: string };

// ---

/** 扁平化標籤異動區後，對每個標籤的各項操作項目 */
export type BoardOperation =
  | { kind: "rename" | "merge"; name: string; count: number; to: string; mergedCount: number | null }
  | { kind: "delete"; name: string; count: number }
  | { kind: "hidden" | "visible"; name: string; count: number };

/** 扁平化單個標籤異動區至每個標籤的操作項目陣列 */
function buildOperation(zone: Zone): BoardOperation[] {
  const ops: BoardOperation[] = [];
  const tags = zone.tags;

  if (zone.kind === "group") {
    const canonical = zone.canonical.trim();
    const kind = tags.length > 1 ? "merge" : "rename";

    for (const { name, count } of tags) {
      if (name === canonical) continue;
      ops.push({ kind, name, count, to: canonical, mergedCount: zone.mergeCount });
    }
  }

  if (zone.kind === "delete") {
    for (const { name, count } of tags) ops.push({ kind: "delete", name, count });
  }

  if (zone.kind === "hidden") {
    for (const { name, count, meta } of tags) ops.push({ kind: meta.hidden ? "visible" : "hidden", name, count });
  }

  return ops;
}

/** 扁平化多個標籤異動區至每個標籤的操作項目陣列 */
function buildOperations(zones: Zone[]): BoardOperation[] {
  return zones.flatMap(buildOperation);
}

// ---

const DELETE_KEY = "delete";
const HIDDEN_KEY = "hidden";

class BoardController {
  private operationsCtx = getOperationsContext();

  // 避免 https://svelte.dev/e/state_invalid_placement
  private deleteZoneState: Zone = $state({ kind: "delete", tags: [] });
  private hiddenZoneState: Zone = $state({ kind: "hidden", tags: [] });

  private zones = new SvelteMap<string, Zone>([
    [DELETE_KEY, this.deleteZoneState],
    [HIDDEN_KEY, this.hiddenZoneState],
  ]);

  /** 合併區張數查詢的 debounce/seq 表；移除合併區時務必同步清理（見 removeGroup） */
  private timers = new Map<string, { timer: ReturnType<typeof setTimeout>; seq: number }>();

  /** 目前所有的合併與重命名區 */
  groups = $derived([...this.zones.values()].filter((z): z is GroupZone => z.kind === "group"));
  /** 目前的刪除區 */
  deleteZone = $derived(this.zones.get(DELETE_KEY) as Extract<Zone, { kind: "delete" }>);
  /** 目前的隱藏切換區 */
  hiddenZone = $derived(this.zones.get(HIDDEN_KEY) as Extract<Zone, { kind: "hidden" }>);
  /** 目前面板上的標籤異動操作的清單項目型態 */
  operations = $derived(buildOperations([...this.zones.values()]));
  /** 標籤異動操作的清單項目數量 */
  touchedCount = $derived(this.operations.length);

  /** 每個標籤目前所在的區域種類查找表 */
  chipStatus = $derived.by(() => {
    const m = new Map<string, "group" | "delete" | "hidden">();
    for (const zone of this.zones.values()) for (const t of zone.tags) m.set(t.name, zone.kind);
    return m;
  });

  /** 移除一個合併區的唯一入口：清 timer 與移除資料在同一函式內原子發生 */
  private removeGroup(id: string) {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer.timer);
    this.timers.delete(id);
    this.zones.delete(id);
  }

  /** 把標籤自所有區域移除（同一標籤只可能落在一處） */
  detachTag = (name: string) => {
    for (const [key, zone] of this.zones) {
      const idx = zone.tags.findIndex((t) => t.name === name);
      if (idx < 0) continue;

      zone.tags = zone.tags.filter((t) => t.name !== name);
      if (zone.kind === "group") {
        if (zone.tags.length > 0) this.queryMergeCount(zone);
        else this.removeGroup(key);
      }
      return;
    }
  };

  /** 由選取的標籤建立一個新合併區 */
  createGroup = (tags: Tag[]) => {
    if (tags.length === 0) return;
    for (const t of tags) this.detachTag(t.name);

    const canonical = tags.toSorted((a, b) => b.count - a.count)[0].name;
    const id = crypto.randomUUID();
    const zone = $state<Zone>({ kind: "group", id, canonical, tags: [...tags], mergeCount: null });

    this.zones.set(id, zone);
    this.queryMergeCount(zone as GroupZone);
  };

  /** 把標籤加入既有合併區 */
  addToGroup = (groupId: string, tags: Tag[]) => {
    const zone = this.zones.get(groupId);
    if (zone?.kind !== "group") return;

    for (const t of tags) {
      if (zone.tags.some((m) => m.name === t.name)) continue;
      this.detachTag(t.name);
      zone.tags.push(t);
    }
    this.queryMergeCount(zone);
  };

  /** 把標籤加入刪除區或隱藏切換區 */
  addToZone = (kind: "delete" | "hidden", tags: Tag[]) => {
    const zone = this.zones.get(kind === "delete" ? DELETE_KEY : HIDDEN_KEY) as Extract<
      Zone,
      { kind: "delete" | "hidden" }
    >;
    for (const t of tags) {
      this.detachTag(t.name);
      zone.tags.push(t);
    }
  };

  /** 統一入口：把標籤加入指定的合併區／刪除區／隱藏切換區（拖放與按鈕共用） */
  addTags = (target: GroupTarget, tags: Tag[]) => {
    if (tags.length === 0) return;
    if (target.kind === "group") this.addToGroup(target.id, tags);
    else this.addToZone(target.kind, tags);
  };

  /** 解散指定合併區 */
  dissolveGroup = (groupId: string) => {
    this.removeGroup(groupId);
  };

  /** 清空刪除區或隱藏切換區 */
  dissolveZone = (kind: "delete" | "hidden") => {
    const zone = this.zones.get(kind === "delete" ? DELETE_KEY : HIDDEN_KEY) as Extract<
      Zone,
      { kind: "delete" | "hidden" }
    >;
    zone.tags = [];
  };

  /** 設定合併區的目標名稱（重新命名輸入框、或把某成員設為 canonical），並排程重新查詢張數 */
  renameGroup = (groupId: string, canonical: string) => {
    const zone = this.zones.get(groupId);
    if (zone?.kind !== "group") return;
    zone.canonical = canonical;
    this.queryMergeCount(zone);
  };

  /** 查詢合併或重命名後的目標標籤數量預期 */
  private queryMergeCount(zone: GroupZone) {
    zone.mergeCount = null;

    const prev = this.timers.get(zone.id);
    if (prev) clearTimeout(prev.timer);
    const seq = (prev?.seq ?? 0) + 1;

    const timer = setTimeout(async () => {
      const tags = [zone.canonical.trim(), ...zone.tags.map((m) => m.name)];
      try {
        const params = new URLSearchParams({ tags: tags.join(",") });
        const res = await api.get<{ count: number }>(`/api/proto/tags-union-count?${params}`);
        if (!res.ok || !res.data) throw new Error(res.error || "查詢失敗");
        if (this.timers.get(zone.id)?.seq !== seq) return; // 在途回應已過期
        zone.mergeCount = res.data.count;
      } catch {
        // 查詢失敗不打擾操作，下次變動再試
      }
    }, 200);

    this.timers.set(zone.id, { timer, seq });
  }

  /** 清空整個畫布（含 timer），只在確認離頁後呼叫 */
  private clearAll() {
    for (const timer of this.timers.values()) clearTimeout(timer.timer);
    this.timers.clear();

    for (const [key, zone] of [...this.zones]) {
      if (zone.kind === "group") this.zones.delete(key);
      else zone.tags = [];
    }
  }

  /** 客戶端導航離頁守衛 */
  handleBeforeNavigate = (nav: BeforeNavigate) => {
    if (nav.type === "leave") return;

    const to = nav.to;
    const leaving = to === null || to.url.pathname !== page.url.pathname;
    if (!leaving) return; // 同頁的換頁/篩選 goto 不攔

    if (this.operationsCtx.pending) {
      nav.cancel(); // 避免 in-flight 續跑在新頁面上產生跨頁副作用
      addToast({ message: "操作進行中，請稍候", variant: "info" });
      return;
    }

    if (this.touchedCount === 0) return;

    nav.cancel();
    if (to === null) return;

    const msg = `畫布上還有 ${this.touchedCount} 筆標籤操作尚未送出，離開將會遺失這些排程。確定要離開？`;
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

const key = Symbol("board-controller");

export const createBoardContext = () => {
  const controller = new BoardController();
  setContext(key, controller);
  return controller;
};

export const getBoardContext = () => getContext<BoardController>(key);
