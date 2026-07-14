type ModalOptions = {
  /** 開關狀態 */
  open: boolean;
  /** 關閉請求回呼 */
  onclose?: () => void;
};

export class Modal {
  dialogEl = $state<HTMLDialogElement>();

  constructor(private options: ModalOptions) {
    $effect(() => {
      const { open } = this.options;
      const node = this.dialogEl;
      if (!node) return;

      if (open) {
        if (!node.open) node.showModal();
      }
    });
  }

  // ::backdrop 點擊時 e.target 是 dialog 元素本身（不會是內容區或其子節點）
  handleClick = (event: MouseEvent) => {
    if (event.target === this.dialogEl) {
      this.options.onclose?.();
    }
  };

  // Escape 觸發原生 cancel 事件；攔截後改走 onclose，讓外部先更新 open 再由元件播放離場動畫，維持受控狀態
  handleCancel = (event: Event) => {
    event.preventDefault();
    this.options.onclose?.();
  };

  // 內容離場動畫結束後呼叫，此時才真正關閉 dialog
  handleOutroEnd = () => {
    if (!this.options.open && this.dialogEl?.open) {
      this.dialogEl.close();
    }
  };
}
