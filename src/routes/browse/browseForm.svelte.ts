import type { QueryResult } from "$lib/types.js";
import { api } from "$lib/client/api.js";
import { debounce } from "$lib/utils.js";
import { goto } from "$app/navigation";

/** 排序欄位類型 */
type Sort = "committedAt" | "rating" | "name" | "random";

/**
 * 篩選表單組件的配置選項
 */
type BrowseFormOptions = {
  /** 雙向綁定：預測的總數量 */
  matchCount: number;
  /** debounce 延遲時間 */
  debounceTime: number;
};

/**
 * 建立篩選表單邏輯的核心工廠函數
 */
export function createBrowseForm(options: BrowseFormOptions) {
  /** 當前所選的篩選標籤 */
  let tags = $state<string[]>([]);
  /** 最低評等篩選值（0 = 不篩選） */
  let rating = $state(0);
  /** 目前選中的排序方式 */
  let sort = $state<Sort>("committedAt");

  /** 是否正在查詢中 */
  let loading = $state(false);

  /** 開始按鈕是否禁用 */
  const startDisabled = $derived(options.matchCount === 0);
  /** 計數文字 */
  const countText = $derived(loading ? "查詢中..." : `共 ${options.matchCount} 張符合`);

  // ---

  /** 排序選項列表 */
  const sortOptions: { value: Sort; label: string }[] = [
    { value: "committedAt", label: "提交時間" },
    { value: "rating", label: "評等" },
    { value: "name", label: "名稱" },
    { value: "random", label: "隨機" },
  ];

  // ---

  /** 以 debounce 方式查詢符合條件的圖片數量 */
  const updateCount = debounce(async () => {
    loading = true;

    try {
      const params = new URLSearchParams({ limit: "1", page: "1" });

      if (tags.length > 0) {
        params.set("tags", tags.join(","));
      }
      if (rating > 0) {
        params.set("rating", String(rating));
        params.set("ratingOp", "gte");
      }

      const res = await api.get<QueryResult>(`/api/images?${params}`);

      options.matchCount = res.ok && res.data ? res.data.total : 0;
    } catch {
      options.matchCount = 0;
    } finally {
      loading = false;
    }
  }, options.debounceTime);

  /** 組裝查詢參數並導航至 Player 子路由 */
  function startPlayer() {
    if (options.matchCount === 0) return;

    const params = new URLSearchParams();

    if (tags.length > 0) {
      params.set("tags", tags.join(","));
    }
    if (rating > 0) {
      params.set("rating", String(rating));
    }

    params.set("sort", sort);

    if (sort !== "random") {
      params.set("order", sort === "name" ? "asc" : "desc");
    }

    const qs = params.toString();
    goto(`/browse/player${qs ? "?" + qs : ""}`);
  }

  // ---

  /** 處理 Form 標籤變更事件，觸發 debounce 查詢更新 */
  function handleFormTagChange() {
    updateCount();
  }

  /** 處理 Form 評等變更事件，觸發 debounce 查詢更新 */
  function handleFormRatingChange() {
    updateCount();
  }

  /** 處理 Form 提交事件，開始瀏覽 */
  function handleFormSubmit() {
    startPlayer();
  }

  // ---

  return {
    /** 獲取當前篩選標籤的 getter */
    get tags() {
      return tags;
    },
    /** 設定篩選標籤的 setter */
    set tags(value) {
      tags = value;
    },
    /** 獲取最低評等篩選值的 getter */
    get rating() {
      return rating;
    },
    /** 設定最低評等篩選值的 setter */
    set rating(value) {
      rating = value;
    },
    /** 獲取排序方式的 getter */
    get sort() {
      return sort;
    },
    /** 設定排序方式的 setter */
    set sort(value) {
      sort = value;
    },

    /** 存取查詢中狀態的 getter */
    get loading() {
      return loading;
    },

    /** 存取開始按鈕是否禁用的 getter */
    get startDisabled() {
      return startDisabled;
    },
    /** 存取計數文字的 getter */
    get countText() {
      return countText;
    },

    /** 獲取排序選項列表的 getter */
    get sortOptions() {
      return sortOptions;
    },

    /** 處理 Form 標籤變更事件，觸發 debounce 查詢更新 */
    handleFormTagChange,
    /** 處理 Form 評等變更事件，觸發 debounce 查詢更新 */
    handleFormRatingChange,
    /** 處理 Form 提交事件，開始瀏覽 */
    handleFormSubmit,
  };
}
