/**
 * @file pagination.svelte.ts
 * 把一份會變動的清單切成固定大小的頁，並管理當前頁碼的通用工具
 */

import { paginate, type Paginated } from "$lib/utils/pagination.core";

/**
 * 響應式分頁，來源清單縮短時，頁碼會自動夾回合法範圍
 */
export class SveltePagination<T> {
  private getItems: () => T[];
  private size: number;
  /** 呼叫端要求的頁碼，允許超出範圍；實際生效的一律讀 `page` */
  private intent = $state(1);
  private result: Paginated<T>;

  constructor(getItems: () => T[], size: number) {
    this.getItems = getItems;
    this.size = size;
    this.result = $derived(paginate(this.getItems(), this.intent, this.size));
  }

  /** 當前頁的項目 */
  get items() {
    return this.result.items;
  }

  /** 當前頁碼（1-based），已夾在合法範圍內 */
  get page() {
    return this.result.page;
  }

  /** 總頁數，至少為 1 */
  get pages() {
    return this.result.pages;
  }

  /** 分頁前的項目總數 */
  get total() {
    return this.result.total;
  }

  /** 跳到指定頁碼，超出範圍時由 `page` 自動夾住，呼叫端不需要判斷邊界 */
  set(page: number) {
    this.intent = page;
  }
}
