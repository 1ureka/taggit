import type { ImageWithId, QueryResult } from "$lib/types.js";
import { api } from "$lib/client/api.js";

/**
 * 比較頁面組件的配置選項
 */
type CompareViewOptions = {
  /** SSR 預載的圖片 A */
  pairA: ImageWithId | null;
  /** SSR 預載的圖片 B */
  pairB: ImageWithId | null;
  /** SSR 預載的符合條件總數 */
  total: number;
};

/**
 * 建立比較頁面邏輯的核心工廠函數
 */
export function createCompareView(options: CompareViewOptions) {
  /** 篩選標籤 */
  let filterTags = $state<string[]>([]);
  /** 最低評等篩選值（0 = 不篩選） */
  let filterMinRating = $state(0);
  /** 圖片 A */
  let pairA = $state<ImageWithId | null>(options.pairA);
  /** 圖片 B */
  let pairB = $state<ImageWithId | null>(options.pairB);
  /** 符合條件的總數 */
  let totalCount = $state(options.total);
  /** 是否正在載入 */
  let loading = $state(false);
  /** 是否顯示載入提示（延遲顯示，避免快速載入閃爍） */
  let showLoading = $state(false);
  /** 錯誤訊息 */
  let errorMsg = $state(options.pairA ? "" : "圖片不足兩張");

  // ---

  /** 載入提示延遲毫秒數 */
  const LOADING_DELAY = 200;

  /** 載入提示延遲計時器 */
  let loadingTimer: ReturnType<typeof setTimeout> | null = null;

  // ---

  /** 隨機載入一組圖片（sort=random, limit=2） */
  async function loadPair() {
    loading = true;
    errorMsg = "";

    if (loadingTimer) clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => {
      if (loading) showLoading = true;
    }, LOADING_DELAY);

    try {
      const params = new URLSearchParams();
      params.set("sort", "random");
      params.set("limit", "2");
      if (filterTags.length > 0) params.set("tags", filterTags.join(","));
      if (filterMinRating > 0) {
        params.set("rating", String(filterMinRating));
        params.set("ratingOp", "gte");
      }

      const res = await api.get<QueryResult>(`/api/images?${params.toString()}`);
      if (!res.ok || !res.data) {
        errorMsg = res.error || "載入失敗";
        pairA = null;
        pairB = null;
        return;
      }

      const items = res.data.items;
      totalCount = res.data.total;

      if (items.length < 2) {
        errorMsg = "篩選條件下的圖片不足兩張";
        pairA = null;
        pairB = null;
        return;
      }

      pairA = items[0];
      pairB = items[1];
    } catch {
      errorMsg = "載入失敗，請稍後再試";
      pairA = null;
      pairB = null;
    } finally {
      loading = false;
      if (loadingTimer) clearTimeout(loadingTimer);
      showLoading = false;
    }
  }

  /** 在 Editor 中開啟指定圖片 */
  function openInEditor(img: ImageWithId | null) {
    if (img) {
      window.open(`/editor/${encodeURIComponent(img.id)}`, "_blank");
    }
  }

  // ---

  /** 處理 Filter 標籤變更事件，重新載入圖片 */
  function handleFilterTagChange() {
    loadPair();
  }

  /** 處理 Filter 評等變更事件，重新載入圖片 */
  function handleFilterRatingChange() {
    loadPair();
  }

  // ---

  /** 處理 Shuffle 按鈕點擊事件，隨機載入新的一組圖片 */
  function handleShuffleClick() {
    loadPair();
  }

  // ---

  /** 處理 Card 點擊事件，在 Editor 中開啟圖片 */
  function handleCardClick(img: ImageWithId | null) {
    openInEditor(img);
  }

  // ---

  /** 處理 Window 鍵盤事件，按空白鍵重新載入圖片 */
  function handleWindowKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    if (e.key === " ") {
      e.preventDefault();
      loadPair();
    }
  }

  // ---

  return {
    /** 獲取篩選標籤的 getter */
    get filterTags() {
      return filterTags;
    },
    /** 設定篩選標籤的 setter */
    set filterTags(v) {
      filterTags = v;
    },
    /** 獲取最低評等篩選值的 getter */
    get filterMinRating() {
      return filterMinRating;
    },
    /** 設定最低評等篩選值的 setter */
    set filterMinRating(v) {
      filterMinRating = v;
    },

    /** 存取圖片 A 的 getter */
    get pairA() {
      return pairA;
    },
    /** 存取圖片 B 的 getter */
    get pairB() {
      return pairB;
    },
    /** 存取符合條件總數的 getter */
    get totalCount() {
      return totalCount;
    },
    /** 存取載入狀態的 getter */
    get loading() {
      return loading;
    },
    /** 存取載入提示顯示狀態的 getter */
    get showLoading() {
      return showLoading;
    },
    /** 存取錯誤訊息的 getter */
    get errorMsg() {
      return errorMsg;
    },

    /** 處理 Filter 標籤變更事件，重新載入圖片 */
    handleFilterTagChange,
    /** 處理 Filter 評等變更事件，重新載入圖片 */
    handleFilterRatingChange,
    /** 處理 Shuffle 按鈕點擊事件，隨機載入新的一組圖片 */
    handleShuffleClick,
    /** 處理 Card 點擊事件，在 Editor 中開啟圖片 */
    handleCardClick,
    /** 處理 Window 鍵盤事件，按空白鍵重新載入圖片 */
    handleWindowKeydown,
  };
}
