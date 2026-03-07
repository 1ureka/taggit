import type { QueryResult } from "$lib/types.js";
import { api } from "$lib/client/api.js";
import { debounce } from "$lib/utils.js";
import { goto } from "$app/navigation";

/** ? */
type Sort = "committedAt" | "rating" | "originalName" | "random";

/**
 * ?
 */
type FormOptions = {
  /** 雙向綁定：預測的總數量 */
  matchCount: number;
  /** debounce 延遲時間 */
  debounceTime: number;
};

/**
 * ?
 */
export function createForm(options: FormOptions) {
  /** ? */
  let tags = $state<string[]>([]);
  /** ? */
  let rating = $state(0);
  /** ? */
  let sort = $state<Sort>("committedAt");

  /** 是否正在查詢中 */
  let loading = $state(false);

  // ---

  /** ? */
  const sortOptions: { value: Sort; label: string }[] = [
    { value: "committedAt", label: "提交時間" },
    { value: "rating", label: "評等" },
    { value: "originalName", label: "檔名" },
    { value: "random", label: "隨機" },
  ];

  // ---

  /** ? */
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

  /** ? */
  const startPlayer = () => {
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
      params.set("order", sort === "originalName" ? "asc" : "desc");
    }

    const qs = params.toString();
    goto(`/browse/player${qs ? "?" + qs : ""}`);
  };

  // ---

  /** ? */
  const handleTagChange = () => {
    updateCount();
  };

  /** ? */
  const handleRatingChange = () => {
    updateCount();
  };

  /** ? */
  const handleSubmit = () => {
    startPlayer();
  };

  // ---

  return {
    /** ? */
    get tags() {
      return tags;
    },
    /** ? */
    set tags(value) {
      tags = value;
    },
    /** ? */
    get rating() {
      return rating;
    },
    /** ? */
    set rating(value) {
      rating = value;
    },
    /** ? */
    get sort() {
      return sort;
    },
    /** ? */
    set sort(value) {
      sort = value;
    },

    /** ? */
    get loading() {
      return loading;
    },

    /** ? */
    get sortOptions() {
      return sortOptions;
    },

    /** ? */
    handleTagChange,
    /** ? */
    handleRatingChange,
    /** ? */
    handleSubmit,
  };
}
