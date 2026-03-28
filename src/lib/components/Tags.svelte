<script lang="ts">
  let { tags }: { tags: string[] } = $props();
</script>

<ul>
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
</style>
