import type { QueryResult } from "$lib/types.js";
import { api } from "$lib/client/api.js";
import { debounce } from "$lib/utils.js";
import { goto } from "$app/navigation";

/**
 * BrowseForm 的排序選項類型
 */
type Sort = "committedAt" | "rating" | "name" | "random";

/**
 * BrowseForm 的配置選項
 */
type BrowseFormOptions = {
  /** 唯讀：SSR 預查的符合數量 */
  matchCount: number;
};

/**
 * BrowseForm 的互動邏輯
 */
export class BrowseForm {
  /** 當前所選的篩選標籤 */
  tags = $state<string[]>([]);
  /** 最低評等篩選值（0 = 不篩選） */
  rating = $state(0);
  /** 目前選中的排序方式 */
  sort = $state<Sort>("committedAt");
  /** 是否正在查詢中 */
  loading = $state(false);
  /** 符合條件的圖片數量（可寫入的 SSR 副本） */
  matchCount = $state(0);

  /** 開始按鈕是否禁用 */
  startDisabled: boolean;
  /** 計數文字 */
  countText: string;

  /** 排序選項列表 */
  readonly sortOptions: { value: Sort; label: string }[] = [
    { value: "committedAt", label: "提交時間" },
    { value: "rating", label: "評等" },
    { value: "name", label: "名稱" },
    { value: "random", label: "隨機" },
  ];

  // ---

  constructor(options: BrowseFormOptions) {
    this.matchCount = options.matchCount;
    this.startDisabled = $derived(this.matchCount === 0);
    this.countText = $derived(this.loading ? "查詢中..." : `共 ${this.matchCount} 張符合`);
  }

  // ---

  /** debounce 版的計數查詢 */
  #fetchCount = debounce(async () => {
    this.loading = true;

    const params = new URLSearchParams({ limit: "1", page: "1" });

    if (this.tags.length > 0) {
      params.set("tags", this.tags.join(","));
    }

    if (this.rating > 0) {
      params.set("rating", String(this.rating));
      params.set("ratingOp", "gte");
    }

    try {
      const res = await api.get<QueryResult>(`/api/committed?${params}`);
      this.matchCount = res.ok && res.data ? res.data.total : 0;
    } catch {
      this.matchCount = 0;
    } finally {
      this.loading = false;
    }
  }, 200);

  /** 組裝查詢參數並回傳 Player URL，若無符合圖片回傳 null */
  #buildPlayerUrl(): string | null {
    if (this.matchCount === 0) return null;

    const params = new URLSearchParams();

    params.set("sort", this.sort);

    if (this.tags.length > 0) {
      params.set("tags", this.tags.join(","));
    }
    if (this.rating > 0) {
      params.set("rating", String(this.rating));
    }
    if (this.sort !== "random") {
      params.set("order", this.sort === "name" ? "asc" : "desc");
    }

    const qs = params.toString();
    return `/browse/player${qs ? "?" + qs : ""}`;
  }

  // ---

  /** 處理標籤變更事件，觸發 debounce 查詢 */
  handleTagChange = () => {
    this.#fetchCount();
  };

  /** 處理評等變更事件，觸發 debounce 查詢 */
  handleRatingChange = () => {
    this.#fetchCount();
  };

  /** 處理提交事件，導航至 Player */
  handleSubmit = () => {
    const url = this.#buildPlayerUrl();
    if (url) goto(url);
  };
}
