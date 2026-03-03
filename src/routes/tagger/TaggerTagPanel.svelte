<script lang="ts">
  import { IconCheck, IconTrash } from "@tabler/icons-svelte";
  import Rating from "$lib/components/Rating.svelte";
  import TagAutocomplete from "$lib/components/TagAutocomplete.svelte";
  import type { TaggerState } from "./tagger-state.svelte.js";

  let { tagger }: { tagger: TaggerState } = $props();

  let tagInputWrapEl: HTMLDivElement | undefined = $state();

  /** Focus the tag input (called by keyboard shortcut via page). */
  export function focusInput() {
    tagInputWrapEl?.querySelector("input")?.focus();
  }
</script>

<aside class="tagger-panel">
  <div class="tagger-rating">
    <Rating bind:value={tagger.rating} size="1.5rem" />
  </div>
  <div class="separator"></div>

  <div class="tagger-tags">
    <div class="tagger-tags-list">
      {#each tagger.tags as tag}
        <button type="button" class="chip chip-removable" onclick={() => tagger.removeTag(tag)}>
          <span>{tag}</span>
          <span class="chip-remove">x</span>
        </button>
      {/each}
    </div>
    <div class="tagger-tags-input-wrap" bind:this={tagInputWrapEl}>
      <TagAutocomplete
        allTags={tagger.knownTags}
        excludedTags={tagger.tags}
        placeholder="輸入標籤..."
        onselect={(tag) => tagger.addTag(tag)}
        oncommit={() => tagger.commit()}
        onbackspace={() => tagger.popTag()}
      />
    </div>
  </div>

  <div class="separator"></div>

  <div class="tagger-actions">
    <button class="btn btn-primary btn-sm" onclick={() => tagger.commit()} disabled={tagger.busy}>
      <IconCheck size={16} />
      {tagger.busy ? "提交中…" : tagger.selectedCount > 1 ? `提交 ${tagger.selectedCount} 張` : "提交"}
    </button>
    <button class="btn btn-destructive btn-sm" onclick={() => tagger.trash()} disabled={tagger.busy}>
      <IconTrash size={16} />
      {tagger.selectedCount > 1 ? `刪除 ${tagger.selectedCount} 張` : "刪除"}
    </button>
  </div>

  <div class="separator"></div>

  <div class="tagger-shortcuts">
    <div>
      <div><span class="kbd">←</span><span class="kbd">→</span></div>
      切換圖片
    </div>
    <div>
      <div><span class="kbd">1</span>-<span class="kbd">5</span></div>
      評等
    </div>
    <div>
      <div><span class="kbd">T</span></div>
      聚焦標籤
    </div>
    <div>
      <div><span class="kbd">Enter</span></div>
      提交
    </div>
  </div>
</aside>

<style>
  .tagger-panel {
    width: 280px;
    min-width: 280px;
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    border-left: 1px solid var(--border);
    background: var(--bg-card);
    overflow-y: auto;
  }

  .tagger-rating {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0;
  }

  .tagger-tags {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .tagger-tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
    max-height: 12rem;
    overflow-y: auto;
    align-content: flex-start;
  }

  .tagger-tags-input-wrap {
    position: relative;
  }

  .tagger-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .tagger-actions :global(.btn) {
    flex: 1;
    min-width: 0;
  }

  .tagger-shortcuts {
    display: grid;
    grid-template-columns: max-content 1fr max-content 1fr;
    gap: 0.25rem 2rem;
    font-size: 0.6875rem;
    color: var(--text-muted);
  }

  .tagger-shortcuts > div {
    grid-column: span 2;
    display: grid;
    grid-template-columns: subgrid;
    align-items: center;
    gap: 0.25rem;
  }
</style>
