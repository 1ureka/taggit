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
    min-width: max-content;
  }
</style>
