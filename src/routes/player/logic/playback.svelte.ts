/**
 * @file playback.ts
 * 管理播放器本身：圖片資料投影、播放/暫停反饋、長按加速
 */

import { tick, getContext, setContext } from "svelte";
import type { ImageWithId } from "$lib/database";
import { blurhashStyle } from "$lib/image/client";
import { Player } from "$lib/virtualizer/player.svelte";
import { getPageDataContext } from "./page-data.svelte";

class PlaybackController {
  private pageData = getPageDataContext();

  private images = $derived(
    this.pageData.value.images.map((img) => ({
      ...img,
      blurhash: blurhashStyle({ fit: "contain", blurhash: img.blurhash, width: img.width, height: img.height }),
    })),
  );

  player: Player<ImageWithId & { blurhash: string }>;

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
    const images = () => this.images;
    this.player = new Player({
      get images() {
        return images();
      },
    });

    $effect(() => {
      this.player.playing;
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
    const direction = e.clientX < window.innerWidth / 2 ? -1 : 1;

    this.pressActive = true;
    this.longPressEngaged = false;
    this.longPressTimer = setTimeout(() => {
      this.longPressEngaged = true;
      this.player.handleBoostStart(direction);
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
      this.player.handleBoostEnd();
    } else {
      this.player.handlePlayerClick();
    }
  };
}

const key = Symbol("playback-controller");

export const createPlaybackContext = () => {
  const controller = new PlaybackController();
  setContext(key, controller);
  return controller;
};

export const getPlaybackContext = () => getContext<PlaybackController>(key);
