<script lang="ts">
  import { IconAlertCircleFilled } from "$lib/icons";
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";
  import Rating from "$lib/components/inputs/Rating.svelte";
  import Chip from "$lib/components/display/Chip.svelte";

  import type { ReviewEntry } from "../logic/review-entry";
  import { getReviewContext } from "../logic/review.svelte";
  import { getLightboxContext } from "../logic/lightbox.svelte";

  let { entry }: { entry: ReviewEntry } = $props();

  const review = getReviewContext();
  const lightbox = getLightboxContext();
</script>

{#snippet thumbnail({ filename, imgSrc }: ReviewEntry)}
  {@const label = `檢視 ${filename} 大圖`}
  {@const handleClick = () => lightbox.handleOpen(filename)}
  <button type="button" class="thumbnail" title={label} aria-label={label} onclick={handleClick}>
    <img src={imgSrc} alt={filename} />
  </button>
{/snippet}

{#snippet name({ name, filename }: ReviewEntry)}
  {@const label = `繼續編輯 ${filename}`}
  {@const handleClick = () => review.handleEdit(filename)}
  <button type="button" class="name ellipsis" title={label} aria-label={label} onclick={handleClick}>
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

<li class:excluded={!entry.checked}>
  <Checkbox
    checked={entry.checked}
    status={entry.checkable ? "default" : "disabled"}
    onchange={() => review.handleToggle(entry.filename)}
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

<style>
  li {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0px;
  }

  li > div.info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.1875rem;
    align-items: flex-start;
  }

  li.excluded > * {
    opacity: 0.5;
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

  /* --- */

  span.file {
    max-width: 100%;
    font: var(--font-caption);
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
  }

  div.meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
  }

  div.meta > div.tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    min-width: 0;
  }

  span.problem {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font: var(--font-caption);
    color: var(--color-warning);
  }
</style>
