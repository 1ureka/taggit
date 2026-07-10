/**
 * @file list-options.ts
 * ListOptions<S> —— 排序 + 分頁選項（isomorphic 值物件，泛型、dumb）。
 *
 * 「預設 sort」依領域而異（image=rating / tag=count），故由 ImageQuery / TagQuery
 * 在 parse/serialize 時提供；本類別只認被填好的 sort，不耦合任何領域。
 */

/** {@link ListOptions} 的資料欄位。 */
export type ListFields<S extends string> = {
  sort: S;
  order: "asc" | "desc";
  page: number;
  limit: number;
};

export class ListOptions<S extends string> {
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

  with(patch: Partial<ListFields<S>>): ListOptions<S> {
    return new ListOptions<S>({
      sort: patch.sort ?? this.sort,
      order: patch.order ?? this.order,
      page: patch.page ?? this.page,
      limit: patch.limit ?? this.limit,
    });
  }
}
