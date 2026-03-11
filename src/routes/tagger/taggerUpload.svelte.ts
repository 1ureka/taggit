import { invalidateAll } from "$app/navigation";
import { api } from "$lib/client/api.js";
import { addToast } from "$lib/client/dom.js";

/**
 * TaggerUpload 元件的配置選項
 */
type TaggerUploadOptions = {
  /** 雙向綁定：載入狀態 */
  get loading(): boolean;
  set loading(v: boolean);
};

/**
 * 建立上傳按鈕邏輯的核心工廠函數
 */
export function createTaggerUpload(options: TaggerUploadOptions) {
  /** 隱藏的檔案上傳 input 元素 */
  let fileInputEl = $state<HTMLInputElement>();

  // ---

  /** 處理上傳按鈕點擊事件，觸發檔案選擇對話框 */
  function handleUploadClick() {
    fileInputEl?.click();
  }

  /** 處理檔案上傳 input change 事件，上傳選取的檔案 */
  async function handleUploadChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length || options.loading) return;

    options.loading = true;
    try {
      const body = new FormData();
      for (const f of input.files) body.append("files", f);

      const res = await api.post<{ added: string[]; errors: string[] }>("/api/staged", body);

      if (!res.ok || !res.data) {
        addToast(res.error || "上傳失敗", "error");
        return;
      }

      const { added, errors } = res.data;

      if (errors.length) {
        addToast(`${errors.length} 個檔案加入失敗`, "error");
      }
      if (added.length) {
        addToast(`已加入 ${added.length} 張圖片`, "success");
      }

      await invalidateAll();
    } catch {
      addToast("上傳請求失敗", "error");
    } finally {
      options.loading = false;
      input.value = "";
    }
  }

  // ---

  return {
    /** 獲取檔案上傳 input 元素的 getter */
    get fileInputEl() {
      return fileInputEl as HTMLInputElement;
    },
    /** 設定檔案上傳 input 元素的 setter */
    set fileInputEl(el: HTMLInputElement) {
      fileInputEl = el;
    },

    /** 存取載入狀態的 getter */
    get loading() {
      return options.loading;
    },

    /** 處理上傳按鈕點擊事件，觸發檔案選擇對話框 */
    handleUploadClick,
    /** 處理檔案上傳 input change 事件，上傳選取的檔案 */
    handleUploadChange,
  };
}
