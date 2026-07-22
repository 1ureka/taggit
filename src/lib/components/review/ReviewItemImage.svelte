<script lang="ts">
  import { IconAlertCircleFilled } from "$lib/icons";
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";
  import RatingDel from "$lib/components/widgets/RatingDel.svelte";
  import TagsDiff from "$lib/components/widgets/TagsDiff.svelte";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { imgSrc } from "$lib/image/client";
  import Rating from "$lib/components/inputs/Rating.svelte";

  type Props = {
    /** 項目是否可勾選 */
    checkable: boolean;
    /** 項目是否勾選 */
    checked: boolean;
    /** 項目的紀錄名稱 */
    name: string;
    /** 項目對應的檔案名稱 */
    filename: string;
    /** 對項目名稱的改動 */
    changeName?: { before: string; after: string };
    /** 對項目評分的改動 */
    changeRating?: { before: number; after: number };
    /** 對項目標籤的改動 */
    changeTags?: { toAdd?: string[]; toRemove?: string[]; toDel?: string[] };
    /** 項目的問題 */
    problem: string | null;
    /** 點擊項目圖片事件 */
    onclickimage: () => void;
    /** 點擊項目名稱事件 */
    onclickname: () => void;
    /** 項目勾選事件 */
    ontoggle: () => void;
    /** TODO: 項目撤銷事件 */
    // ondiscard: () => void;
  };

  let {
    checkable,
    checked,
    name,
    filename,
    changeName,
    changeRating,
    changeTags,
    problem,
    onclickimage,
    onclickname,
    ontoggle,
    // ondiscard,
  }: Props = $props();

  const displayName = $derived(changeName ? changeName.after : name);
</script>

{#snippet thumbnail()}
  {@const label = `檢視 ${filename} 大圖`}
  <button
    type="button"
    class="thumbnail"
    aria-label={label}
    {@attach tooltip({ content: label })}
    onclick={onclickimage}
  >
    <img src={imgSrc(filename, "sm")} alt={filename} />
  </button>
{/snippet}

{#snippet title()}
  {@const label = `繼續編輯 ${filename}`}
  <button
    type="button"
    class="name ellipsis"
    aria-label={label}
    {@attach tooltip({ content: label })}
    onclick={onclickname}
  >
    {displayName}
  </button>
{/snippet}

{#snippet file()}
  <span class="file ellipsis">{filename}</span>
{/snippet}

{#snippet diffName()}
  {#if changeName}
    <span class="diff-name ellipsis">
      <del class="ellipsis">{changeName.before}</del>
      →
      <ins class="ellipsis">{changeName.after}</ins>
    </span>
  {/if}
{/snippet}

{#snippet diffRating()}
  <div class="diff-rating">
    {#if changeRating && changeRating.after === 0}
      <RatingDel value={changeRating.before} />
    {:else if changeRating && changeRating.before === 0}
      <Rating readonly size="sm" value={changeRating.after} />
    {:else if changeRating}
      <RatingDel value={changeRating.before} /> → <Rating readonly size="sm" value={changeRating.after} />
    {/if}
  </div>
{/snippet}

{#snippet diffTags()}
  {#if changeTags}
    <div class="diff-tags">
      <TagsDiff tags={changeTags.toAdd ?? []} sign="+" />
      <TagsDiff tags={changeTags.toRemove ?? []} sign="-" />
      <TagsDiff tags={changeTags.toDel ?? []} sign="~" />
    </div>
  {/if}
{/snippet}

{#snippet issue()}
  {#if problem}
    <span class="problem"><IconAlertCircleFilled size={13} />{problem}</span>
  {/if}
{/snippet}

<li class:excluded={!checked}>
  <Checkbox {checked} status={checkable ? "default" : "disabled"} onchange={ontoggle} aria-label={`包含 ${filename}`} />
  {@render thumbnail()}
  <div>
    {@render title()}
    {@render file()}
    {@render diffName()}
    {@render diffRating()}
    {@render diffTags()}
    {@render issue()}
  </div>
</li>

<style>
  li {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0px;
  }

  li > div {
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

  span.file {
    max-width: 100%;
    font: var(--font-caption);
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
  }

  /* --- */

  span.diff-name {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font: var(--font-body2);
    color: var(--color-text-muted);
    max-width: 100%;

    & > * {
      display: block;
      max-width: 40%;
    }

    & > del {
      opacity: 0.7;
      text-decoration-line: line-through;
    }

    & > ins {
      color: var(--color-text);
      text-decoration: none;
    }
  }

  div.diff-rating {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.25rem;
    min-width: 0;
    font: var(--font-body2);
    color: var(--color-text-muted);
    opacity: 0.75;
  }

  div.diff-tags {
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
