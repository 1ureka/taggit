/**
 * Player dock 自動隱藏或顯示的互動邏輯
 */
export class PlayerAutoHide {
  /** 是否隱藏 dock */
  hideDock = $state(false);
  /** 自動隱藏的閾值時間（毫秒） */
  readonly timeout = 2000;

  constructor() {
    $effect(() => {
      let rafId: number | null = null;
      let lastActivityTime = 0;

      const handleActivity = () => {
        this.hideDock = false;
        lastActivityTime = Date.now();
      };

      const loop = () => {
        if (Date.now() - lastActivityTime > this.timeout) this.hideDock = true;
        rafId = requestAnimationFrame(loop);
      };

      document.addEventListener("mousemove", handleActivity);
      rafId = requestAnimationFrame(loop);

      return () => {
        document.removeEventListener("mousemove", handleActivity);
        if (rafId !== null) cancelAnimationFrame(rafId);
      };
    });
  }
}
