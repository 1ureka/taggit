/**
 * @file drag.svelte.ts
 * 追蹤目前拖曳中的標籤與懸停中的放置目標
 */

import { getContext, setContext } from "svelte";
import type { Tag } from "$lib/database";

import { getBoardContext, type ZoneTarget } from "./board.svelte";
import { getSelectionContext } from "./selection.svelte";

class DragController {
  private board = getBoardContext();
  private selection = getSelectionContext();

  /** 目前正在拖曳的標籤 */
  dragging = $state<Tag | null>(null);
  private overKey = $state<string | null>(null);

  /** 把放置目標壓成可比對的字串鍵；合併區以外的種類本身就唯一，直接拿 kind 當鍵 */
  private keyOf(target: ZoneTarget): string {
    return target.kind === "group" ? `group:${target.id}` : target.kind;
  }

  /** 指定位置目前是否為懸停中的放置目標 */
  isOver = (target: ZoneTarget): boolean => this.overKey === this.keyOf(target);

  handleDragStart = (tag: Tag) => {
    this.dragging = tag;
  };

  handleDragEnd = () => {
    this.dragging = null;
    this.overKey = null;
  };

  handleDragOver = (target: ZoneTarget) => {
    this.overKey = this.keyOf(target);
  };

  handleDragLeave = (target: ZoneTarget) => {
    if (this.isOver(target)) this.overKey = null;
  };

  /** 放下：被拖的標籤在選取中就整組放，否則只放它自己 */
  handleDrop = (target: ZoneTarget) => {
    this.overKey = null;

    const dragged = this.dragging;
    if (dragged === null) return;
    this.dragging = null;

    const tags = this.selection.isSelected(dragged.name) ? this.selection.consume() : [dragged];
    this.board.handleAssign(target, tags);
  };
}

const key = Symbol("drag-controller");

export const createDragContext = () => {
  const controller = new DragController();
  setContext(key, controller);
  return controller;
};

export const getDragContext = () => getContext<DragController>(key);
