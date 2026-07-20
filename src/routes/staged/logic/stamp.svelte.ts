/**
 * @file stamp.svelte.ts
 * 把目前編輯中的暫存釘選為範本，點擊或拖曳連續套用到其他卡片的暫存
 */

import { getContext, setContext } from "svelte";
import { addToast } from "$lib/components/floating/toast-events";
import { isTouched, type Draft } from "./draft";
import { getEditorContext } from "./editor.svelte";

/** 已釘選的圖章 */
export type Stamp = {
  /** 圖章內容的來源檔名（顯示用；套用時會跳過此檔本身） */
  sourceFile: string;
  /** 這個圖章要套用哪些欄位，於釘選當下決定，之後可即時調整 */
  include: { name: boolean; rating: boolean; tags: boolean };
  name: string;
  rating: number;
  tags: string[];
  /** 已套用次數，僅供顯示 */
  count: number;
};

/** 圖章內容的簡短摘要文字，用於卡片提示與模式指示徽章 */
const summarize = (stamp: Stamp): string => {
  const parts: string[] = [];
  if (stamp.include.name) parts.push(stamp.name ? `「${stamp.name}」` : "（清空名稱）");
  if (stamp.include.rating) parts.push(`★${stamp.rating}`);
  if (stamp.include.tags) parts.push(stamp.tags.length > 0 ? stamp.tags.join("、") : "（無標籤）");
  return parts.join("・") || "未選擇任何欄位";
};

class StampController {
  private editor = getEditorContext();

  /** 目前釘選的圖章，null 表示未啟用圖章模式 */
  private current = $state<Stamp | null>(null);
  /** 目前是否處於一次連續拖曳套用中 */
  private dragging = false;
  /** 這次拖曳筆劃已套用過的檔名，避免同一次拖曳重複套用同一張 */
  private strokeSet = new Set<string>();
  /** pointerdown 已套用過的檔名，讓緊接著觸發的 click 不再重複套用一次 */
  private suppressClickFile: string | null = null;

  /** 目前釘選的圖章 */
  active = $derived(this.current);
  /** 是否處於圖章模式 */
  isActive = $derived(this.current !== null);
  /** 圖章內容的摘要文字 */
  summary = $derived(this.current ? summarize(this.current) : "");
  /** 目前編輯中的暫存是否可以釘選為圖章（只要求已動過，不要求可提交） */
  canPin = $derived.by(() => {
    const draft = this.editor.activeDraft;
    return draft !== undefined && isTouched(draft);
  });

  /** 把目前編輯中的暫存釘選為圖章 */
  handlePin = () => {
    const file = this.editor.activeFile;
    const draft = this.editor.activeDraft;
    if (file === null || !draft || !isTouched(draft)) return;

    this.current = {
      sourceFile: file,
      include: { name: false, rating: true, tags: true },
      name: draft.name.trim(),
      rating: draft.rating,
      tags: [...draft.tags],
      count: 0,
    };
  };

  /** 離開圖章模式 */
  handleExit = () => {
    this.current = null;
  };

  /** 把圖章套用到指定檔案的暫存 */
  private applyTo = (file: string) => {
    const stamp = this.current;
    if (!stamp) return;

    if (file === stamp.sourceFile) {
      addToast({ message: "這是圖章的來源，未套用", variant: "info" });
      return;
    }

    const target = this.editor.draftOf(file);
    const next: Draft = { ...target };
    if (stamp.include.tags) next.tags = [...new Set([...target.tags, ...stamp.tags])];
    if (stamp.include.rating) next.rating = stamp.rating;
    if (stamp.include.name) next.name = stamp.name;

    this.editor.writeDraft(file, next);
    stamp.count += 1;
  };

  /** 圖章模式中套用圖章到該卡片 */
  handleCardClick = (file: string) => {
    if (!this.current) return;
    if (this.suppressClickFile === file) {
      this.suppressClickFile = null;
      return;
    }
    this.applyTo(file);
  };

  /** 圖章模式中視為一次拖曳筆劃的起點，立即套用第一張 */
  handleCardPointerDown = (e: PointerEvent, file: string) => {
    if (!this.current) return;
    e.preventDefault(); // 避免拖曳跨越多張卡片時觸發瀏覽器原生的圖片拖曳／文字選取
    this.dragging = true;
    this.strokeSet = new Set([file]);
    this.suppressClickFile = file;
    this.applyTo(file);
  };

  /** 拖曳中經過新卡片時套用圖章 */
  handleCardPointerEnter = (e: PointerEvent, file: string) => {
    if (!this.current || !this.dragging || e.buttons === 0 || this.strokeSet.has(file)) return;
    this.strokeSet.add(file);
    this.applyTo(file);
  };

  /** 結束拖曳筆劃 */
  handleWindowPointerUp = () => {
    this.dragging = false;
  };
}

const key = Symbol("stamp-controller");

export const createStampContext = () => {
  const controller = new StampController();
  setContext(key, controller);
  return controller;
};

export const getStampContext = () => getContext<StampController>(key);
