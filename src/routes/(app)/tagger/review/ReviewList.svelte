<script lang="ts">
  import type { ReviewEntry } from "./ReviewModal.svelte";
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";
  import Rating from "$lib/components/inputs/Rating.svelte";
  import Chip from "$lib/components/display/Chip.svelte";
  import { IconAlertCircleFilled } from "$lib/icons";

  type Props = {
    /** 可勾選的數量 */
    checkableCount: number;
    /** 已勾選的數量 */
    checkedCount: number;
    /** 所有紀錄 */
    entries: ReviewEntry[];
    /** 點擊紀錄名稱：關閉本 modal 並繼續編輯該張 */
    onedit: (filename: string) => void;
    /** 點擊紀錄圖片：開啟大圖預覽 */
    onpreview: (filename: string) => void;
    /** 點擊紀錄勾選框 */
    ontoggle: (filename: string) => void;
    /** 點擊全選勾選框 */
    ontoggleall: () => void;
  };

  let { checkableCount, checkedCount, entries, ontoggle, ontoggleall, onedit, onpreview }: Props = $props();

  const bulkSelectionState = $derived.by(() => {
    if (checkableCount === 0 || checkedCount === 0) return "unchecked";
    if (checkableCount === checkedCount) return "checked";
    return "indeterminate";
  });
</script>

{#snippet thumbnail({ filename, imgSrc }: ReviewEntry)}
  {@const label = `檢視 ${filename} 大圖`}
  <button type="button" class="thumbnail" title={label} aria-label={label} onclick={() => onpreview(filename)}>
    <img src={imgSrc} alt={filename} />
  </button>
{/snippet}

{#snippet name({ name, filename }: ReviewEntry)}
  {@const label = `繼續編輯 ${filename}`}
  <button type="button" class="name ellipsis" title={label} aria-label={label} onclick={() => onedit(filename)}>
    {name}
  </button>
{/snippet}

{#snippet meta({ rating, tags }: ReviewEntry)}
  <div class="meta">
    <Rating value={rating} readonly size="sm" />

    {#if tags.length > 0}
      <div class="tags">
        {#each tags as tag (tag)}<Chip variant="outlined" style="font: var(--font-caption);">{tag}</Chip>{/each}
      </div>
    {/if}
  </div>
{/snippet}

<ul>
  <li class="select-all">
    <Checkbox
      checked={bulkSelectionState === "checked"}
      indeterminate={bulkSelectionState === "indeterminate"}
      status={checkableCount === 0 ? "disabled" : "default"}
      onchange={ontoggleall}
      aria-label="全選可提交的項目"
    />
    <span>全選</span>
    <span>{entries.filter((e) => e.checked).length} / {checkableCount} 可提交紀錄已選取</span>
  </li>

  {#each entries as entry (entry.filename)}
    <li class:excluded={!entry.checked}>
      <Checkbox
        checked={entry.checked}
        status={entry.disabled ? "disabled" : "default"}
        onchange={() => ontoggle(entry.filename)}
        aria-label={`包含 ${entry.filename}`}
      />

      {@render thumbnail(entry)}

      <div class="info">
        {@render name(entry)}

        <span class="file ellipsis">{entry.filename}</span>

        {@render meta(entry)}

        {#if entry.problem}
          <span class="problem"><IconAlertCircleFilled size={13} />{entry.problem}</span>
        {/if}
      </div>
    </li>
  {/each}
</ul>

<style>
  ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    max-height: 50vh;
    overflow-y: auto;
    padding: 1rem;
  }

  ul > li {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0px;

    &.excluded > * {
      opacity: 0.5;
    }
  }

  li.select-all {
    padding: 0.25rem 0px;
  }

  li.select-all > span:nth-of-type(1) {
    font: var(--font-body2);
  }

  li.select-all > span:nth-of-type(2) {
    margin-left: auto;
    font: var(--font-caption);
    color: var(--color-text-muted);
  }

  /* --- */

  button.thumbnail {
    display: block;
    padding: 0;
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border-radius: calc(var(--border-radius) / 1.5);
    overflow: hidden;
    background: var(--color-bg-active);
    cursor: pointer;

    & > img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  /* --- */

  div.info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.1875rem;
    align-items: flex-start;
  }

  button.name {
    max-width: 100%;
    padding: 0;
    font: var(--font-body2);
    color: var(--color-text);
    text-align: left;
    text-decoration-line: underline;
    text-decoration-color: transparent;
    text-underline-offset: 2px;
    transition: text-decoration-color 0.15s ease;

    &:hover {
      text-decoration-color: var(--color-text-muted);
    }
  }

  span.file {
    max-width: 100%;
    font: var(--font-caption);
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
  }

  /* --- */

  div.meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
  }

  div.tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    min-width: 0;
  }

  /* --- */

  span.problem {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font: var(--font-caption);
    color: var(--color-warning);
  }
</style>
