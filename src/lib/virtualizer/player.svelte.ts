import type { ItemWithSize } from "$lib/virtualizer/types";
import type { PlayerStripItem, PlayerProgress } from "$lib/virtualizer/player.core";
import { PlayerEngine } from "$lib/virtualizer/player.core";
import { isInEditable } from "$lib/components/dom";
import { debounce } from "$lib/utils";

/**
 * 播放器的配置選項
 */
type PlayerOptions<T extends ItemWithSize> = {
  /** 圖片列表 */
  get images(): T[];
};

/**
 * 播放器的互動邏輯，連接 Engine 與 Svelte 模板
 */
export class Player<T extends ItemWithSize> {
  /** 是否正在播放 */
  playing = $state(true);
  /** 播放速度（px / frame） */
  speed = $state(1.5);
  /** 格式化的速度顯示文字 */
  speedDisplay: string;

  /** 可見的項目（含虛擬化樣式） */
  visibleItems = $state<PlayerStripItem<T>[]>([]);
  /** 當前的進度資訊 */
  progress = $state<PlayerProgress>({ cameraX: 0, progressValue: 0, currentIndex: 0 });
  /** 進度文字，如 "5 / 100" */
  progressText: string;
  /** 播放軌道當前的偏移樣式 */
  stripTransform: string;

  /** @internal 引擎實例 */
  #engine: PlayerEngine<T> | null = null;

  constructor(options: PlayerOptions<T>) {
    this.speedDisplay = $derived(this.speed.toFixed(1));

    // 攝影機不動時，場景為反向移動
    this.stripTransform = $derived(`translateX(${-this.progress.cameraX}px)`);

    this.progressText = $derived.by(() => {
      if (options.images.length > 0) {
        return `${this.progress.currentIndex + 1} / ${options.images.length}`;
      } else {
        return "0 / 0";
      }
    });

    $effect(() => {
      const images = options.images;
      if (images.length === 0) return;

      const engine = new PlayerEngine<T>({
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

  // ---

  /** 切換播放/暫停 */
  #togglePlay() {
    this.#engine?.togglePlay();
    this.playing = !this.playing;
  }

  // ---

  /** 點擊播放器，切換播放/暫停 */
  handlePlayerClick = () => {
    this.#togglePlay();
  };

  /** 點擊播放按鈕，切換播放/暫停 */
  handlePlayButtonClick = () => {
    this.#togglePlay();
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

  /** 全域鍵盤事件 */
  handleKeydown = (e: KeyboardEvent) => {
    if (isInEditable(e.target)) return;

    if (e.key === " ") {
      e.preventDefault();
      this.#togglePlay();
    } else if (e.key === "Escape") {
      e.preventDefault();
      history.back();
    }
  };
}
