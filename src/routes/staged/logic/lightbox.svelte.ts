/**
 * @file lightbox.svelte.ts
 * 暫存圖片的全螢幕大圖預覽與前後切換
 */

import { getContext, setContext } from "svelte";
import { getPageDataContext } from "./page-data.svelte";
import { getEditorContext } from "./editor.svelte";

class LightboxController {
  private pageData = getPageDataContext();
  private editor = getEditorContext();

  /** 大圖預覽中的檔名，使用者的原始意圖，不主動清除 */
  private target = $state<string | null>(null);

  private get files() {
    return this.pageData.value.stagedFiles;
  }

  /** 暫存檔案總數 */
  total = $derived(this.files.length);
  /** 目前預覽中的圖片；檔案離開清單時自動回落為 null */
  image = $derived.by(() => {
    if (this.target === null) return null;
    const index = this.files.indexOf(this.target);
    if (index < 0) return null;
    return { id: this.target, index: index + 1 };
  });

  private navigate(delta: number) {
    const current = this.image ? this.image.index - 1 : null;
    if (current === null) return;
    const next = Math.min(this.files.length - 1, Math.max(0, current + delta));
    this.target = this.files[next];
  }

  /** 開啟大圖預覽（未指定檔名時預覽目前編輯中的圖片） */
  handleOpen = (filename?: string) => {
    this.target = filename ?? this.editor.activeFile;
  };

  /** 關閉大圖預覽 */
  handleClose = () => {
    this.target = null;
  };

  /** 前往預覽前一張暫存圖片的大圖 */
  handlePrev = () => {
    this.navigate(-1);
  };

  /** 前往預覽下一張暫存圖片的大圖 */
  handleNext = () => {
    this.navigate(1);
  };
}

const key = Symbol("lightbox-controller");

export const createLightboxContext = () => {
  const controller = new LightboxController();
  setContext(key, controller);
  return controller;
};

export const getLightboxContext = () => getContext<LightboxController>(key);
