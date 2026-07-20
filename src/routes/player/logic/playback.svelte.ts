/**
 * @file playback.svelte.ts
 * 管理播放器引擎綁定、播放狀態與所有 transport 操作（播放/暫停、進度、速度、加速、鍵盤）
 */

import { getContext, setContext } from "svelte";
import type { ImageWithId } from "$lib/database";
import { blurhashStyle } from "$lib/image/client";
import { debounce } from "$lib/utils/shared";

import type { PlayerProgress, PlayerStripItem } from "./player.core";
import { PlayerEngine } from "./player.core";
import { getPageDataContext } from "./page-data.svelte";

type PlaybackImage = ImageWithId & { blurhash: string };

class PlaybackController {
  private pageData = getPageDataContext();

  private images = $derived(
    this.pageData.value.images.map((img) => ({
      ...img,
      blurhash: blurhashStyle({ fit: "contain", blurhash: img.blurhash, width: img.width, height: img.height }),
    })),
  );

  /** 方向鍵單次跳張的張數 */
  readonly jumpStep = 3;
  /** 引擎實例 */
  #engine: PlayerEngine<PlaybackImage> | null = null;

  /** 是否正在播放 */
  playing = $state(false);
  /** 播放速度（px / frame） */
  speed = $state(1.5);
  /** 目前長按加速的方向，null 表示未在加速中 */
  boostDirection = $state<1 | -1 | null>(null);
  /** 可見的項目 */
  visibleItems = $state<PlayerStripItem<PlaybackImage>[]>([]);
  /** 當前的進度資訊 */
  progress = $state<PlayerProgress>({ cameraX: 0, progressValue: 0, currentIndex: 0 });

  /** 播放軌道當前的偏移樣式 */
  stripTransform = $derived(`translateX(${-this.progress.cameraX}px)`); // 攝影機不動時，場景為反向移動
  /** 進度文字，如 `5 / 100` */
  progressText = $derived.by(() => {
    if (this.images.length > 0) return `${this.progress.currentIndex + 1} / ${this.images.length}`;
    else return "0 / 0";
  });

  constructor() {
    $effect(() => {
      const images = this.images;
      if (images.length === 0) return;

      const engine = new PlayerEngine<PlaybackImage>({
        images,
        onVisibleItemsChange: (items) => {
          this.visibleItems = items;
        },
        onProgressChange: (progress) => {
          this.progress = progress;
        },
      });

      this.#engine = engine;
      engine.start();

      const handleResize = debounce(() => engine.resize(), 150);
      window.addEventListener("resize", handleResize);

      return () => {
        engine.dispose();
        this.#engine = null;
        window.removeEventListener("resize", handleResize);
      };
    });
  }

  private togglePlay() {
    this.#engine?.togglePlay();
    this.playing = !this.playing;
  }

  /** 切換播放/暫停 */
  handleTogglePlay = () => {
    this.togglePlay();
  };

  /** 進度條 input 事件（拖曳中） */
  handleProgressInput = (e: Event) => {
    const pct = parseInt((e.currentTarget as HTMLInputElement).value, 10) / 1000;
    this.#engine?.seekMove(pct);
  };

  /** 進度條 change 事件（拖曳結束） */
  handleProgressChange = () => {
    this.#engine?.seekEnd();
  };

  /** 速度滑桿 input 事件 */
  handleSpeedInput = (e: Event) => {
    const rawValue = (e.currentTarget as HTMLInputElement).value;
    const v = parseFloat(rawValue);

    if (!isNaN(v)) {
      this.speed = v;
      this.#engine?.setSpeed(v);
    } else {
      this.speed = 1.5;
      this.#engine?.setSpeed(1.5);
    }
  };

  /** 依方向跳到前後第 {@link jumpStep} 張 */
  handleJump = (direction: 1 | -1) => {
    this.#engine?.jumpBy(this.jumpStep * direction);
  };

  /** 開始長按加速，以目前速度絕對值的兩倍沿指定方向推進，可超出一般速度滑桿的範圍，暫停中也會生效 */
  handleBoostStart = (direction: 1 | -1) => {
    const magnitude = Math.abs(this.speed) * 2 || 3;
    this.boostDirection = direction;
    this.#engine?.startBoost(magnitude * direction);
  };

  /** 結束長按加速，恢復原本的播放/暫停狀態 */
  handleBoostEnd = () => {
    this.boostDirection = null;
    this.#engine?.endBoost();
  };
}

const key = Symbol("playback-controller");

export const createPlaybackContext = () => {
  const controller = new PlaybackController();
  setContext(key, controller);
  return controller;
};

export const getPlaybackContext = () => getContext<PlaybackController>(key);
