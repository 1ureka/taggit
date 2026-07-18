import { debounce } from "$lib/utils/shared";

/**
 * 控制區域自動隱藏或顯示的互動邏輯：滑鼠移動時顯示，靜止逾時後隱藏。
 */
export class AutoHide {
  /** 是否隱藏 dock */
  hideDock = $state(false);
  /** 自動隱藏的閾值時間（毫秒） */
  readonly timeout = 2000;

  constructor() {
    $effect(() => {
      const hide = debounce(() => (this.hideDock = true), this.timeout);

      const handleActivity = () => {
        this.hideDock = false;
        hide();
      };

      document.addEventListener("mousemove", handleActivity);
      handleActivity();

      return () => {
        document.removeEventListener("mousemove", handleActivity);
      };
    });
  }
}
