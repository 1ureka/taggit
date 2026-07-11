/**
 * @file list-options.ts
 * 排序&分頁值物件，其中預設 sort 依領域而異
 */

/** {@link ListOptions} 的資料欄位。 */
export type ListFields<S extends string> = {
  sort: S;
  order: "asc" | "desc";
  page: number;
  limit: number;
};

export class ListOptions<S extends string> {
  /** 本值物件在 URL 上擁有的可能出現的查詢鍵 */
  static readonly KEYS = ["sort", "order", "page", "limit"] as const;

  sort: S;
  order: "asc" | "desc";
  /** 頁碼（從 1 起）。 */
  page: number;
  /** 每頁筆數；0 = 不分頁。 */
  limit: number;

  constructor(init: { sort: S; order?: "asc" | "desc"; page?: number; limit?: number }) {
    this.sort = init.sort;
    this.order = init.order ?? "desc";
    this.page = init.page ?? 1;
    this.limit = init.limit ?? 0;
  }

  /** 複製當前條件並覆寫部分欄位，回傳一個全新的值物件 */
  with(patch: Partial<ListFields<S>>): ListOptions<S> {
    return new ListOptions<S>({
      sort: patch.sort ?? this.sort,
      order: patch.order ?? this.order,
      page: patch.page ?? this.page,
      limit: patch.limit ?? this.limit,
    });
  }
}
