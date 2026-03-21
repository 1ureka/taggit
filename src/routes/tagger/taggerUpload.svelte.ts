import { invalidateAll } from "$app/navigation";
import { api } from "$lib/client/api.js";
import { addToast } from "$lib/client/dom.js";

/**
 * TaggerUpload 的互動邏輯
 */
export class TaggerUpload {
  /** 上傳操作狀態 */
  pending = $state(false);

  // ---

  /** 處理檔案上傳 input change 事件 */
  handleUploadChange = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length || this.pending) return;

    this.pending = true;
    try {
      const body = new FormData();
      for (const f of input.files) body.append("files", f);

      const res = await api.post<{ added: string[]; errors: string[] }>("/api/staged", body);

      if (!res.ok || !res.data) {
        addToast(res.error || "上傳失敗", "error");
        return;
      }

      const { added, errors } = res.data;
      if (errors.length) addToast(`${errors.length} 個檔案加入失敗`, "error");
      if (added.length) addToast(`已加入 ${added.length} 張圖片`, "success");

      await invalidateAll();
    } catch {
      addToast("上傳請求失敗", "error");
    } finally {
      this.pending = false;
      input.value = "";
    }
  };
}
