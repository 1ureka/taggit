/**
 * @file tag-impact.svelte.ts
 * 管理標籤庫影響評估狀態
 */

import { getContext, setContext } from "svelte";
import { api } from "$lib/utils/request";

import { getDraftsContext } from "./drafts.svelte";
import { getReviewContext } from "./review.svelte";

class TagImpactController {
  private drafts = getDraftsContext();
  private review = getReviewContext();

  private seq = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** 目前可送出項目會用到的所有相異標籤 */
  private names = $derived.by(() => {
    const set = new Set<string>();
    for (const f of this.review.submittableFiles) {
      for (const t of this.drafts.viewOf(f).tags) set.add(t);
    }
    return [...set];
  });

  /** 這些標籤目前在標籤庫的使用數 */
  private counts = $state(new Map<string, number>());

  /** 是否正在查詢中 */
  fetching = $state(false);

  /** 提交後會新增的全新標籤，也就是目前使用數為 0 的那些 */
  newTags = $derived(this.names.filter((t) => (this.counts.get(t) ?? 0) === 0));

  constructor() {
    $effect(() => {
      const current = this.names;
      clearTimeout(this.timer);

      if (!this.review.open || current.length === 0) {
        this.fetching = false;
        return;
      }

      this.fetching = true;
      const seq = ++this.seq;
      this.timer = setTimeout(async () => {
        // 走 POST：名稱可能上百個，塞進 URL 會先撞上 Node 的 header 長度上限
        const res = await api.post<{ counts: Record<string, number> }>("/api/tags/counts", { names: current });
        if (seq !== this.seq) return; // 已有更新的查詢在路上，這次回應作廢
        if (res.ok) this.counts = new Map(Object.entries(res.data.counts));
        this.fetching = false;
      }, 300);
    });
  }
}

const key = Symbol("tag-impact-controller");

export const createTagImpactContext = () => {
  const controller = new TagImpactController();
  setContext(key, controller);
  return controller;
};

export const getTagImpactContext = () => getContext<TagImpactController>(key);
