<script lang="ts">
  import type { Tag } from "$lib/database";
  import { TagQuery, TagWhere, ListOptions } from "$lib/query-spec";
  import { scale } from "svelte/transition";
  import { api } from "$lib/utils/request";

  import { IconAlertTriangleFilled } from "$lib/icons";
  import Combo from "$lib/components/inputs/Combo.svelte";
  import Chip from "$lib/components/display/Chip.svelte";
  import CircularProgress from "$lib/components/display/CircularProgress.svelte";

  type Props = {
    /** 已選標籤（雙向綁定） */
    tags: string[];
    /** 欄位標籤 */
    label: string;
    /** 是否隱藏標籤（僅供螢幕閱讀器） */
    labelHidden?: boolean;
    /** 輸入框佔位文字 */
    placeholder?: string;
    /** 分面查詢的 scope；候選與 count 將限定在該圖片篩選範圍內 */
    scope?: string;
    /** 任何新增/移除後觸發 */
    onchange?: (tags: string[]) => void;
  };

  let { tags = $bindable(), label, labelHidden, placeholder, scope, onchange }: Props = $props();

  // ---

  let value = $state("");

  /** 這次向後端查詢回來的結果；已選標籤的排除是前端做的 derived */
  let rawMatches = $state<Tag[]>([]);
  const tagIndex = $derived(new Map(rawMatches.map((t) => [t.name, t])));
  const candidates = $derived(rawMatches.filter((t) => !tags.includes(t.name)));
  const candidateKeys = $derived(candidates.map((t) => t.name));

  let fetching = $state(false);
  const listboxExtra = $derived(
    fetching ? loadingRow : value.trim() && candidates.length === 0 ? noMatchesRow : undefined,
  );

  // ---

  let requestSeq = 0;
  let debounceTimer: ReturnType<typeof setTimeout>;

  $effect(() => {
    return () => clearTimeout(debounceTimer);
  });

  /** 向 `/api/tags` 查詢候選；過期回應以序號丟棄 */
  async function runQuery(query: string) {
    const seq = ++requestSeq;
    fetching = true;

    const q = query.trim();

    const where = new TagWhere({ name: q || undefined });
    const listOptions = new ListOptions({ sort: "count", limit: 30 });
    const params = new TagQuery(where, listOptions).toSearchParams(new URLSearchParams(scope));

    const res = await api.get<{ items: Tag[]; total: number }>(`/api/tags?${params.toString()}`);
    if (seq !== requestSeq) return; // 已有更新的查詢在路上

    fetching = false;
    if (res.ok && res.data) rawMatches = res.data.items;
  }

  /** 條件變化立即顯示「搜尋中…」，實際查詢 debounce 才發 */
  $effect(() => {
    scope; // _ = <-scopeCh
    value;

    requestSeq++; // 遞增序號讓在途回應立即失效
    fetching = true;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runQuery(value), 250);
  });

  // ---

  /** 逗號分隔一次輸入多個標籤 */
  function commitTags(raw: string) {
    const parts = raw
      .split(/[,，]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const unique = Array.from(new Set(parts)).filter((name) => !tags.includes(name));
    if (unique.length > 0) {
      tags = [...tags, ...unique];
      onchange?.(tags);
    }

    value = "";
  }

  function removeTag(name: string) {
    tags = tags.filter((t) => t !== name);
    onchange?.(tags);
  }

  function handleKeydown(e: KeyboardEvent) {
    // 輸入框清空時按 Backspace 可清掉最後一個標籤
    if (e.key === "Backspace" && !value && tags.length > 0) {
      tags = tags.slice(0, -1);
      onchange?.(tags);
    }
  }
</script>

{#snippet loadingRow()}
  <span class="spinner"><CircularProgress size="0.875rem" /></span>
  <span>搜尋中…</span>
{/snippet}

{#snippet noMatchesRow()}
  <span>沒有符合「{value.trim()}」的標籤</span>
{/snippet}

<div class="tag-input">
  {#if tags.length > 0}
    <div class="tags">
      {#each tags as tag (tag)}
        <div in:scale={{ duration: 150, start: 0.9 }} out:scale={{ duration: 150, start: 0.9 }}>
          <Chip removable onclick={() => removeTag(tag)}>
            <span class="ellipsis">{tag}</span>
          </Chip>
        </div>
      {/each}
    </div>
  {/if}

  <Combo
    {label}
    {labelHidden}
    {placeholder}
    bind:value
    candidates={candidateKeys}
    onchange={commitTags}
    onkeydown={handleKeydown}
    {listboxExtra}
    autocomplete="off"
    style="width: 100%"
  >
    {#snippet candidate(key, active)}
      {@const meta = tagIndex.get(key)}
      <span class="option ellipsis" class:accent={active}>{key}</span>
      <span class="option meta">
        {#if meta?.meta.hidden}<IconAlertTriangleFilled size="0.75rem" />{/if}
        <span class="option count">{meta?.count}</span>
      </span>
    {/snippet}
  </Combo>
</div>

<style>
  .tag-input {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    width: 100%;
  }

  div.tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;

    & > div {
      max-width: 100%;
    }
  }

  span.spinner {
    display: flex;
    flex-shrink: 0;
  }

  span.option {
    &.ellipsis {
      flex: 1;
    }

    &.accent {
      color: var(--color-accent);
    }

    &.meta {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      gap: 0.25rem;
      color: var(--color-text-muted);
    }

    &.count {
      font: var(--font-caption);
      font-family: var(--font-family-mono);
    }
  }
</style>
