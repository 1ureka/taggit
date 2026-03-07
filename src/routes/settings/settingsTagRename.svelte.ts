import { api } from "$lib/client/api.js";
import { tagCache } from "$lib/client/cache.js";

/**
 * 建立標籤重命名邏輯的核心工廠函數
 */
export function createSettingsTagRename() {
  /** 選中的舊標籤（以陣列形式承接 Autocomplete） */
  let selectedTags = $state<string[]>([]);
  /** 新標籤名稱 */
  let newName = $state("");
  /** 新名稱輸入框 DOM 引用 */
  let newInputEl = $state<HTMLInputElement>();
  /** 是否正在處理 */
  let busy = $state(false);
  /** 操作結果訊息 */
  let result = $state("");
  /** 結果是否為錯誤 */
  let resultIsError = $state(false);

  /** 舊標籤名稱（取第一個選中的標籤） */
  const oldName = $derived(selectedTags[0] ?? "");
  /** 是否可提交（舊名與新名皆有值且不相同） */
  const canSubmit = $derived(
    !!oldName.trim() && !!newName.trim() && oldName.trim().toLowerCase() !== newName.trim().toLowerCase() && !busy,
  );

  // ---

  /** 執行標籤重命名的核心邏輯 */
  async function doRename() {
    const trimOld = oldName.trim().toLowerCase();
    const trimNew = newName.trim().toLowerCase();
    if (!trimOld || !trimNew || trimOld === trimNew) return;

    busy = true;
    result = "";
    resultIsError = false;

    const res = await api.post<{ affected: number }>("/api/metadata/tags", {
      oldName: trimOld,
      newName: trimNew,
    });

    if (res.ok && res.data) {
      result = `已將「${trimOld}」重命名為「${trimNew}」，影響 ${res.data.affected} 張圖片`;
      resultIsError = false;
      tagCache.invalidate();
      selectedTags = [];
      newName = "";
    } else {
      result = "錯誤: " + (res.error || "未知");
      resultIsError = true;
    }
    busy = false;
  }

  // ---

  /** 處理標籤選取變更事件，只保留最後一個選中的標籤並聚焦新名稱輸入框 */
  function handleSelectChange() {
    if (selectedTags.length > 1) selectedTags = [selectedTags.at(-1)!];
    if (oldName) requestAnimationFrame(() => newInputEl?.focus());
  }

  // ---

  /** 處理重命名按鈕點擊事件，呼叫 API 進行全域重命名 */
  function handleRenameClick() {
    doRename();
  }

  // ---

  /** 處理新名稱輸入框 keydown 事件，按 Enter 時提交 */
  function handleNewNameKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      doRename();
    }
  }

  // ---

  return {
    /** 存取選中標籤列表的 getter */
    get selectedTags() {
      return selectedTags;
    },
    /** 設定選中標籤列表的 setter */
    set selectedTags(v: string[]) {
      selectedTags = v;
    },
    /** 存取舊標籤名稱的 getter */
    get oldName() {
      return oldName;
    },
    /** 存取新標籤名稱的 getter */
    get newName() {
      return newName;
    },
    /** 設定新標籤名稱的 setter */
    set newName(v: string) {
      newName = v;
    },
    /** 獲取新名稱輸入框 DOM 引用的 getter */
    get newInputEl() {
      return newInputEl;
    },
    /** 設定新名稱輸入框 DOM 引用的 setter */
    set newInputEl(el: HTMLInputElement | undefined) {
      newInputEl = el;
    },
    /** 存取處理中狀態的 getter */
    get busy() {
      return busy;
    },
    /** 存取結果訊息的 getter */
    get result() {
      return result;
    },
    /** 存取結果是否為錯誤的 getter */
    get resultIsError() {
      return resultIsError;
    },
    /** 存取是否可提交的 getter */
    get canSubmit() {
      return canSubmit;
    },
    /** 處理標籤選取變更事件，只保留最後一個選中的標籤並聚焦新名稱輸入框 */
    handleSelectChange,
    /** 處理重命名按鈕點擊事件，呼叫 API 進行全域重命名 */
    handleRenameClick,
    /** 處理新名稱輸入框 keydown 事件，按 Enter 時提交 */
    handleNewNameKeydown,
  };
}
