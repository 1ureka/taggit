/**
 * @file gesture.svelte.ts
 * 管理播放器的手勢判斷（長按加速 vs 點擊切換播放）與播放/暫停的瞬間反饋動畫
 */

import { tick, getContext, setContext } from "svelte";
import { getPlaybackContext } from "./playback.svelte";
import { getPickContext } from "./pick.svelte";

class GestureController {
  private playback = getPlaybackContext();
  private pick = getPickContext();

  /** 播放/暫停反饋的瞬間信號 */
  feedback = $state(false);

  /** 是否已跑過首次 feedback 觸發（跳過掛載當下的無條件閃爍） */
  private hasMounted = false;
  /** 每次 feedback 觸發的世代標記，避免快速連續切換時較早的 tick() 延續提早把 feedback 歸位 */
  private feedbackToken = 0;

  /** 長按判定的計時器 */
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  /** 長按是否已達閾值、進入加速狀態 */
  private longPressEngaged = false;
  /** 是否有一次從播放區域開始、尚未結束的按壓，用來過濾掉不是從播放區域開始的 pointerup（例如點擊 Dock 上的按鈕） */
  private pressActive = false;
  /** 長按判定閾值（毫秒），超過此時間才視為長按加速，否則視為點擊切換播放/暫停 */
  private readonly longPressThreshold = 300;

  constructor() {
    $effect(() => {
      this.playback.playing;
      if (!this.hasMounted) {
        this.hasMounted = true;
        return;
      }

      const token = ++this.feedbackToken;
      this.feedback = true;
      tick().then(() => {
        if (token === this.feedbackToken) this.feedback = false;
      });
    });
  }

  /** 按下播放區域：開始判定長按，超過閾值則進入加速狀態 */
  handlePointerDown = (e: PointerEvent) => {
    if (this.pick.active) return; // 挑選模式的按壓歸「前往編輯」，不啟動長按加速

    const direction = e.clientX < window.innerWidth / 2 ? -1 : 1;

    this.pressActive = true;
    this.longPressEngaged = false;
    this.longPressTimer = setTimeout(() => {
      this.longPressEngaged = true;
      this.playback.handleBoostStart(direction);
    }, this.longPressThreshold);
  };

  /** 放開事件，未達長按閾值視為點擊切換播放/暫停，已達閾值則結束加速 */
  handlePointerUp = () => {
    if (!this.pressActive) return;
    this.pressActive = false;

    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (this.longPressEngaged) {
      this.longPressEngaged = false;
      this.playback.handleBoostEnd();
    } else if (!this.pick.active) {
      // 按壓期間才按下 Ctrl：這一次點擊歸挑選模式，不切換播放
      this.playback.handleTogglePlay();
    }
  };
}

const key = Symbol("gesture-controller");

export const createGestureContext = () => {
  const controller = new GestureController();
  setContext(key, controller);
  return controller;
};

export const getGestureContext = () => getContext<GestureController>(key);
