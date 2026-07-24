/**
 * @file tag-impact.svelte.ts
 * 管理標籤庫影響評估狀態
 */

import { getContext, setContext } from "svelte";
import { api } from "$lib/utils/request";

import { getDraftsContext } from "./drafts.svelte";
import { getRevertMarkContext } from "./reverts.svelte";
import { getReviewContext } from "./review.svelte";

class TagImpactController {
  private drafts = getDraftsContext();
  private reverts = getRevertMarkContext();
  private review = getReviewContext();

  private seq = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** 目前可送出項目各自的標籤淨變化 */
  private deltas = $derived.by(() => {
    const deltas = new Map<string, number>();
    const bump = (tag: string, delta: number) => deltas.set(tag, (deltas.get(tag) ?? 0) + delta);

    for (const f of this.review.submittableFiles) {
      const snapshot = this.reverts.draftOf(f);
      if (snapshot !== undefined) {
        for (const t of snapshot.tags) bump(t, -1);
      } else {
        const { toAdd, toRemove } = this.drafts.tagDiffOf(f);
        for (const t of toAdd) bump(t, 1);
        for (const t of toRemove) bump(t, -1);
      }
    }
    return deltas;
  });

  private counts = $state(new Map<string, number>());
  private names = $derived([...this.deltas.keys()]);

  /** 是否正在查詢中 */
  fetching = $state(false);

  /** 提交後會新增的全新標籤 */
  newTags = $derived(
    this.names.filter((t) => {
      const before = this.counts.get(t) ?? 0;
      const after = this.deltas.get(t) ?? 0;
      return before === 0 && before + after > 0;
    }),
  );

  /** 提交後會變成沒有任何圖片使用的標籤 */
  orphanedTags = $derived(
    this.names.filter((t) => {
      const before = this.counts.get(t) ?? 0;
      const after = this.deltas.get(t) ?? 0;
      return before > 0 && before + after <= 0;
    }),
  );

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
        const res = await api.get<{ counts: { name: string; count: number }[] }>(
          `/api/proto/tags-impact?names=${encodeURIComponent(current.join(","))}`,
        );
        if (seq !== this.seq) return; // 已有更新的查詢在路上，這次回應作廢
        if (res.ok) this.counts = new Map(res.data.counts.map((c) => [c.name, c.count]));
        this.fetching = false;
      }, 200);
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
