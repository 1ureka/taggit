/**
 * @file changeset.svelte.ts
 * 由異動區推導出每個標籤的異動，並判斷能不能送出
 */

import { getContext, setContext } from "svelte";
import { getZonesContext, type Zone } from "./zones.svelte";

/** 合併後的名稱長度上限，與 `Mutation.renameTag` 的驗證一致 */
const MAX_NAME_LENGTH = 50;

/** 扁平化異動區後，每個標籤各一筆的異動 */
export type TagChange =
  | { kind: "rename" | "merge"; name: string; count: number; to: string; groupId: string }
  | { kind: "delete"; name: string; count: number }
  | { kind: "hidden" | "visible"; name: string; count: number };

/** 扁平化單個異動區至每個標籤的異動 */
function buildChanges(zone: Zone): TagChange[] {
  const changes: TagChange[] = [];

  if (zone.kind === "group") {
    const canonical = zone.canonical.trim();
    const kind = zone.tags.length > 1 ? "merge" : "rename";

    for (const { name, count } of zone.tags) {
      if (name === canonical) continue;
      changes.push({ kind, name, count, to: canonical, groupId: zone.id });
    }
  }

  if (zone.kind === "delete") {
    for (const { name, count } of zone.tags) changes.push({ kind: "delete", name, count });
  }

  if (zone.kind === "hidden") {
    for (const { name, count, meta } of zone.tags) {
      changes.push({ kind: meta.hidden ? "visible" : "hidden", name, count });
    }
  }

  return changes;
}

class ChangesetController {
  private zones = getZonesContext();

  /** 全部的標籤異動，維持異動區的呈現順序 */
  changes = $derived(this.zones.all.flatMap(buildChanges));

  private byName = $derived(new Map(this.changes.map((c) => [c.name, c])));

  /** 指定標籤目前的異動，沒有排入任何異動區時為 `undefined` */
  changeOf(name: string): TagChange | undefined {
    return this.byName.get(name);
  }

  /** 指定標籤的異動是否有問題，以及在有問題時的描述；沒有異動時恆為 `null` */
  problemOf(name: string): string | null {
    const change = this.changeOf(name);
    if (change === undefined) return null;
    if (change.kind !== "rename" && change.kind !== "merge") return null;

    const to = change.to;
    if (to.length === 0 || to.length > MAX_NAME_LENGTH || to.includes(",")) {
      return `新名稱不合法（1–${MAX_NAME_LENGTH} 字元、不可含逗號）`;
    }

    const conflict = this.changeOf(to);
    if (conflict?.kind === "rename" || conflict?.kind === "merge") return `目標「${to}」本身也被排入重新命名`;
    if (conflict?.kind === "delete") return `目標「${to}」已被排入刪除`;

    return null;
  }
}

const key = Symbol("changeset-controller");

export const createChangesetContext = () => {
  const controller = new ChangesetController();
  setContext(key, controller);
  return controller;
};

export const getChangesetContext = () => getContext<ChangesetController>(key);
