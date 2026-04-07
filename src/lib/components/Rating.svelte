<script lang="ts">
  import { IconStar, IconStarFilled } from "$lib/icons";
  import { Rating } from "$lib/ui/rating.svelte.js";

  type Props = {
    /** 欄位名稱，用於表單提交 */
    name?: string;
    /** 雙向綁定：目前分數（0–5），0 = 未評分 */
    value?: number;
    /** 星號大小（rem 長度單位，預設 1.25rem） */
    size?: string;
    /** 設為 true 時為唯讀模式（無互動） */
    readonly?: boolean;
    /** 當分數變更時觸發的回調 */
    onchange?: (v: number) => void;
  };

  let { name, value = $bindable(0), size = "1.25rem", readonly = false, onchange }: Props = $props();

  const rating = new Rating({
    get value() {
      return value;
    },
    set value(v) {
      value = v;
    },
    get onchange() {
      return onchange;
    },
    get readonly() {
      return readonly;
    },
  });
</script>

{#if name}
  <input type="hidden" {name} {value} />
{/if}

{#snippet icon(filled: boolean)}
  {#if filled}
    <IconStarFilled {size} />
  {:else}
    <IconStar {size} />
  {/if}
{/snippet}

{#if readonly}
  <div class="rating readonly" role="img" aria-label="評分 {value}/5">
    {#each [1, 2, 3, 4, 5] as i}
      {@const state = rating.getStarState(i)}
      <span class="rating-star" class:bright={state.bright} aria-hidden="true">
        {@render icon(state.filled)}
      </span>
    {/each}
  </div>
{:else}
  <div
    class="rating"
    role="spinbutton"
    aria-label="評分"
    aria-valuenow={value}
    aria-valuemin={0}
    aria-valuemax={5}
    aria-valuetext={value === 0 ? "未評分" : `${value} 顆星`}
    tabindex="0"
    onkeydown={rating.handleContainerKeydown}
    onmouseleave={rating.handleContainerMouseLeave}
  >
    {#each [1, 2, 3, 4, 5] as i}
      {@const state = rating.getStarState(i)}
      <span
        class="rating-star"
        class:bright={state.bright}
        aria-hidden="true"
        onmouseenter={() => rating.handleStarMouseEnter(i)}
        onclick={() => rating.handleStarClick(i)}
      >
        {@render icon(state.filled)}
      </span>
    {/each}
  </div>
{/if}

<style>
  .rating {
    display: inline-flex;
    gap: 0.125rem;
    user-select: none;
    border-radius: 2px;
  }

  .rating > .rating-star {
    display: inline-flex;
    cursor: pointer;
    color: var(--rating-color, var(--text-dim));
    transition:
      color 0.1s,
      transform 0.1s;

    &:hover {
      transform: scale(1.15);
    }

    &.bright {
      color: var(--rating-color-active, var(--text));
    }
  }

  .rating.readonly > .rating-star {
    cursor: default;

    &:hover {
      transform: none;
    }
  }
</style>
