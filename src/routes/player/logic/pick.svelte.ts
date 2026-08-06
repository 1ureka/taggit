/**
 * @file pick.svelte.ts
 * 管理按住 Ctrl 的挑選模式：指出游標當下懸停的是哪一張圖片，並讓點擊前往該圖片的編輯頁
 */

import { getContext, setContext } from "svelte";
import { getPlaybackContext } from "./playback.svelte";

class PickController {
  private playback = getPlaybackContext();

  /** 游標是否還在播放區內，移到控制列上或移出視窗即為 false */
  private inside = $state(false);

  /** 是否在挑選模式（按住 Ctrl） */
  active = $state(false);
  /** 最後一次游標在播放區內的座標，離開後保留原值，避免提示在離場動畫期間飛走 */
  cursor = $state({ x: 0, y: 0 });

  /** 游標下的那張圖片，未在挑選模式或未命中時為 null */
  private target = $derived.by(() => {
    if (!this.active || !this.inside) return null;
    // 圖片帶以 translateX(-cameraX) 呈現，螢幕座標加回 cameraX 才是它在圖片帶上的座標
    const x = this.cursor.x + this.playback.progress.cameraX;
    return this.playback.visibleItems.find((item) => x >= item.pixelX && x < item.pixelX + item.pixelW) ?? null;
  });

  /** 提示文字，null 表示不顯示提示 */
  label = $derived(this.target ? `點擊前往編輯 ${this.target.name}` : null);

  /** 游標在播放區內移動 */
  handleMove = (e: MouseEvent) => {
    this.inside = true;
    this.cursor = { x: e.clientX, y: e.clientY };
  };

  /** 游標離開播放區 */
  handleLeave = () => {
    this.inside = false;
  };

  /** 進入挑選模式 */
  handleActivate = () => {
    this.active = true;
  };

  /** 離開挑選模式 */
  handleDeactivate = () => {
    this.active = false;
  };

  /** 點擊播放區：挑選模式下以新分頁開啟該圖片的編輯頁，並帶上當下的篩選參數 */
  handleClick = () => {
    const target = this.target;
    if (!target) return;

    const params = new URLSearchParams(location.search);
    params.set("currentId", target.id);
    window.open(`/committed?${params.toString()}`, "_blank", "noopener");
  };
}

const key = Symbol("pick-controller");

export const createPickContext = () => {
  const controller = new PickController();
  setContext(key, controller);
  return controller;
};

export const getPickContext = () => getContext<PickController>(key);
