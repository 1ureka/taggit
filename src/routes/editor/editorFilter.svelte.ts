import { page } from "$app/state";
import { goto } from "$app/navigation";
import { untrack } from "svelte";
import { buildQueryString, parseQueryParams } from "$lib/utils.js";
import type { QueryOptions } from "$lib/types.js";

/**
 * EditorFilter 的配置選項
 */
type EditorFilterOptions = {
  /** 雙向綁定：操作狀態 (共用鎖) */
  get pending(): boolean;
  set pending(v: boolean);
};

/**
 * EditorFilter 的互動邏輯，管理篩選 Modal 與 URL goto
 */
export class EditorFilter {
  /** Modal 是否開啟 */
  open = $state(false);

  // 表單狀態（從 URL 同步）
  search = $state("");
  includedTags = $state<string[]>([]);
  excludedTags = $state<string[]>([]);
  rating = $state<number | undefined>(undefined);
  ratingOp = $state<"gte" | "lte" | "eq">("gte");
  sort = $state<"committedAt" | "rating" | "name" | "random">("committedAt");
  order = $state<"asc" | "desc">("desc");

  constructor(private options: EditorFilterOptions) {
    // 初始化
    const initial = untrack(() => parseQueryParams(page.url));
    this.#resetFields(initial);

    // URL 變動時同步
    $effect(() => {
      this.#resetFields(parseQueryParams(page.url));
    });
  }

  // ---

  /** 根據提供的選項重置欄位 */
  #resetFields(opts: QueryOptions) {
    this.search = opts.search ?? "";
    this.includedTags = opts.includedTags ?? [];
    this.excludedTags = opts.excludedTags ?? [];
    this.rating = opts.rating;
    this.ratingOp = opts.ratingOp ?? "gte";
    this.sort = opts.sort ?? "committedAt";
    this.order = opts.order ?? "desc";
  }

  // ---

  /** 打開篩選 Modal */
  handleOpenClick = () => {
    this.#resetFields(parseQueryParams(page.url));
    this.open = true;
  };

  /** 關閉篩選 Modal */
  handleClose = () => {
    this.open = false;
  };

  // ---

  /** 處理篩選表單提交 */
  handleFilterSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (this.options.pending) return;

    this.options.pending = true;

    try {
      const opts: QueryOptions = {
        search: this.search,
        includedTags: this.includedTags,
        excludedTags: this.excludedTags,
        rating: this.rating,
        ratingOp: this.ratingOp,
        sort: this.sort,
        order: this.order,
      };

      const qs = buildQueryString(opts, new URLSearchParams(page.url.searchParams));
      await goto(`/editor${qs}`, { replaceState: true, noScroll: true, keepFocus: true });

      this.open = false;
    } finally {
      this.options.pending = false;
    }
  };

  /** 處理篩選表單重置 */
  handleFilterReset = (e: Event) => {
    e.preventDefault();
    this.#resetFields({});
  };
}
