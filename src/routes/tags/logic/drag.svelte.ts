/**
 * @file drag.svelte.ts
 * 拖曳中狀態，以及各 zone 的拖放事件工廠（統一用 ZoneTarget 判別，
 * 取代舊版三個各自 `zone.startsWith("group:")` 解析同一個字串協議的工廠函式）
 */

import { getContext, setContext } from "svelte";
import type { Tag } from "$lib/database";
import { getBoardContext } from "./board.svelte";
import { getSelectionContext } from "./selection.svelte";

export type ZoneTarget =
  | { kind: "pool" }
  | { kind: "new-group" }
  | { kind: "delete" }
  | { kind: "hidden" }
  | { kind: "group"; id: string };

function keyOf(target: ZoneTarget): string {
  return target.kind === "group" ? `group:${target.id}` : target.kind;
}

class DragController {
  private board = getBoardContext();
  private selection = getSelectionContext();

  /** 目前正在拖曳的標籤 */
  dragging = $state<Tag | null>(null);
  private overKey = $state<string | null>(null);

  handleDragStart = (tag: Tag) => {
    this.dragging = tag;
  };

  handleDragEnd = () => {
    this.dragging = null;
    this.overKey = null;
  };

  /** 供 ZoneContainer / Pool 直接 spread 的一組拖放事件處理器 */
  zoneHandlers = (target: ZoneTarget) => {
    const key = keyOf(target);

    const ondragover = (e: DragEvent) => {
      e.preventDefault();
      this.overKey = key;
    };

    const ondragleave = (e: DragEvent) => {
      // 冒泡到子元素（按鈕、輸入框、chip）時 relatedTarget 仍在目前元素內，不算真的離開，避免 dropping 樣式閃爍
      const related = e.relatedTarget;
      const current = e.currentTarget;
      if (related instanceof Node && current instanceof HTMLElement && current.contains(related)) return;
      if (this.overKey === key) this.overKey = null;
    };

    const ondrop = (e: DragEvent) => {
      e.preventDefault();
      this.overKey = null;

      const dragged = this.dragging;
      if (!dragged) return;
      this.dragging = null;

      const tags = this.selection.isSelected(dragged.name) ? this.selection.consume() : [dragged];
      switch (target.kind) {
        case "new-group":
          this.board.createGroup(tags);
          break;
        case "delete":
          this.board.addToZone("delete", tags);
          break;
        case "hidden":
          this.board.addToZone("hidden", tags);
          break;
        case "group":
          this.board.addToGroup(target.id, tags);
          break;
        case "pool":
          for (const t of tags) this.board.detachTag(t.name);
          break;
      }
    };

    return { ondragover, ondragleave, ondrop, dropping: this.overKey === key };
  };
}

const key = Symbol("drag-controller");

export const createDragContext = () => {
  const controller = new DragController();
  setContext(key, controller);
  return controller;
};

export const getDragContext = () => getContext<DragController>(key);
