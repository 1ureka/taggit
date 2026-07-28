/**
 * @file pointers.svelte.ts
 * 管理指向目前篩選清單裡某個檔案的指標，包括編輯中的與全螢幕預覽中的
 */

import { getContext, setContext } from "svelte";
import type { ImageWithId } from "$lib/database";
import { SvelteShallowParam } from "$lib/utils/search-params.svelte";
import { getPageDataContext } from "./page-data.svelte";

/** 一個指標指向目前清單裡的哪個檔案，以及它是清單裡的第幾個（1-based） */
type Pointer = { id: string; index: number; record: ImageWithId } | null;

class PointersController {
  private pageData = getPageDataContext();

  private get files() {
    return this.pageData.value.items.map((r) => r.id);
  }

  /** 把一個檔名解析成指標：不在目前清單內就是 null */
  private locate(id: string | null): Pointer {
    if (id === null) return null;
    const index = this.files.indexOf(id);
    return index < 0 ? null : { id, index: index + 1, record: this.pageData.value.items[index] };
  }

  // ---

  private editingParam = new SvelteShallowParam("currentId");

  /** 目前正在編輯的檔案；篩選/排序改變導致它不在可視範圍時自動回落為 null */
  editing = $derived(this.locate(this.editingParam.value));

  /** 開啟指定檔名的編輯面板 */
  handleSelect = (filename: string) => {
    this.editingParam.set(filename);
  };

  /** 關閉編輯面板 */
  handleClose = () => {
    if (this.editingParam.value === null) return;
    this.editingParam.set(null);
  };

  // ---

  private lightboxTarget = $state<string | null>(null);

  /** 目前全螢幕預覽中的檔案；檔案離開清單時自動回落為 null */
  lightbox = $derived(this.locate(this.lightboxTarget));

  private navigateLightbox(delta: number) {
    if (this.lightbox === null) return;
    const current = this.lightbox.index - 1; // 換回 0-based
    const next = Math.min(this.files.length - 1, Math.max(0, current + delta));
    this.lightboxTarget = this.files[next];
  }

  /** 開啟全螢幕預覽（未指定檔名時預覽目前編輯中的檔案） */
  handleLightboxOpen = (filename?: string) => {
    this.lightboxTarget = filename ?? this.editing?.id ?? null;
  };

  /** 關閉全螢幕預覽 */
  handleLightboxClose = () => {
    this.lightboxTarget = null;
  };

  /** 全螢幕預覽切換到前一張 */
  handleLightboxPrev = () => {
    this.navigateLightbox(-1);
  };

  /** 全螢幕預覽切換到後一張 */
  handleLightboxNext = () => {
    this.navigateLightbox(1);
  };
}

const key = Symbol("pointers-controller");

export const createPointersContext = () => {
  const controller = new PointersController();
  setContext(key, controller);
  return controller;
};

export const getPointersContext = () => getContext<PointersController>(key);
