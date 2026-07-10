<script lang="ts">
  import { ImageWhere } from "$lib/poc/query-spec";

  type Props = {
    tags: string[];
    nowrap?: boolean;
    readonly?: boolean;
  };

  let { tags, nowrap = false, readonly = false }: Props = $props();

  function href(tag: string): string {
    return `/?${new ImageWhere({ includedTags: [tag] }).toSearchParams()}`;
  }
</script>

<ul class:nowrap>
  {#each tags as tag}
    <li>
      {#if readonly}
        {tag}
      {:else}
        <a href={href(tag)}>{tag}</a>
      {/if}
    </li>
  {/each}
</ul>

<style>
  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  li {
    display: inline-flex;
    align-items: center;
    padding: 0.1875rem 0.5rem;
    font-size: var(--font-size-body2);
    color: var(--text-muted);
    background: var(--bg-active);
    border: var(--border-style);
    border-radius: 9999px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    user-select: none;
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  li:has(a) {
    pointer-events: auto;
  }

  li:has(a):hover {
    border-color: var(--border-hover);
    color: var(--text);
  }

  ul.nowrap {
    flex-wrap: nowrap;
    overflow: hidden;
    max-width: 100%;
    mask-image: linear-gradient(to right, black calc(100% - 7rem), transparent);

    & > li {
      flex-shrink: 0;
    }
  }
</style>
