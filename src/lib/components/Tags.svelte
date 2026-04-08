<script lang="ts">
  type Props = {
    tags: string[];
    nowrap?: boolean;
  };

  let { tags, nowrap = false }: Props = $props();
</script>

<ul class:nowrap>
  {#each tags as tag}
    <li class="chip">{tag}</li>
  {/each}
</ul>

<style>
  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  ul.nowrap {
    flex-wrap: nowrap;
    overflow: hidden;
    mask-image: linear-gradient(to right, black calc(100% - 7rem), transparent);

    & > .chip {
      flex-shrink: 0;
    }
  }
</style>
