import type { ItemWithSize } from "$lib/types";
import type { CarouselItem } from "$lib/virtualizer/player.core";
import { CarouselEngine } from "$lib/virtualizer/player.core";
import { isInEditable } from "$lib/client/dom";
import { debounce } from "$lib/utils";

/**
 * Player 的配置選項
 */
type PlayerOptions<T extends ItemWithSize> = {
  /** 圖片列表 */
  get images(): T[];
};

/**
 * Player 輪播的互動邏輯——連接 CarouselEngine 與 Svelte 模板
 */
export class Player<T extends ItemWithSize> {
  /** 輪播軌道容器，由模板 bind:this 綁定 */
  trackEl = $state<HTMLElement | null>(null);

  /** 是否正在播放 */
  playing = $state(true);
  /** 播放速度（px / frame） */
  speed = $state(1.5);
  /** 格式化的速度顯示文字 */
  speedDisplay: string;

  /** 可見的輪播項目（含虛擬化樣式） */
  visibleItems = $state<CarouselItem<T>[]>([]);
  /** 進度條數值 0–1000 */
  progressValue = $state(0);
  /** 目前顯示的圖片索引 */
  currentIndex = $state(0);
  /** 進度文字，如 "5 / 100" */
  progressText: string;

  /** @internal 引擎實例 */
  #engine: CarouselEngine<T> | null = null;

  constructor(options: PlayerOptions<T>) {
    this.speedDisplay = $derived(this.speed.toFixed(1));
    this.progressText = $derived(
      options.images.length > 0 ? `${this.currentIndex + 1} / ${options.images.length}` : "0 / 0",
    );

    $effect(() => {
      const el = this.trackEl;
      if (!el) return;

      const images = options.images;
      if (images.length === 0) return;

      const engine = new CarouselEngine<T>({
        images,
        onVisibleItemsChange: (items) => {
          this.visibleItems = items;
        },
        onProgressChange: ({ scrollX, progressValue, currentIndex }) => {
          el.style.transform = `translateX(${-scrollX}px)`;
          this.progressValue = progressValue;
          this.currentIndex = currentIndex;
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

  // ---

  /** 點擊輪播區域：切換播放 */
  handleCarouselClick = () => {
    this.#engine?.togglePlay();
    this.playing = !this.playing;
  };

  /** 切換播放/暫停（dock 按鈕） */
  handleTogglePlay = () => {
    this.#engine?.togglePlay();
    this.playing = !this.playing;
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
    const v = parseFloat((e.currentTarget as HTMLInputElement).value) || 1.5;
    this.speed = v;
    this.#engine?.setSpeed(v);
  };

  /** 全域鍵盤事件 */
  handleKeydown = (e: KeyboardEvent) => {
    if (isInEditable(e.target)) return;

    if (e.key === " ") {
      e.preventDefault();
      this.handleTogglePlay();
    } else if (e.key === "Escape") {
      e.preventDefault();
      history.back();
    }
  };
}
