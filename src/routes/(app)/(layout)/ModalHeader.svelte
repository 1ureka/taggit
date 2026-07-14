<script lang="ts">
  import { page } from "$app/state";
  import { IconArrowLeft, IconArrowRight } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";

  let { collectionName, onnavigate }: { collectionName: string; onnavigate: () => void } = $props();

  const handleNavigateForward = () => {
    history.forward();
    onnavigate();
  };

  const handleNavigateBack = () => {
    history.back();
    onnavigate();
  };
</script>

<header>
  <Button variant="ghost" padding="icon" onclick={handleNavigateBack} aria-label="上一頁">
    <IconArrowLeft size={16} />
  </Button>
  <span class="ellipsis">
    {collectionName + page.url.pathname + page.url.search}
  </span>
  <Button variant="ghost" padding="icon" onclick={handleNavigateForward} aria-label="下一頁">
    <IconArrowRight size={16} />
  </Button>
</header>

<style>
  header {
    height: 2.5rem;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.5rem;
    align-items: center;
    border-bottom: var(--border-style);
    margin-bottom: 0.5rem;
  }

  header > span {
    font: var(--font-kbd);
    color: var(--color-text-muted);
    text-align: center;
  }
</style>
