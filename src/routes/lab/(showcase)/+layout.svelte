<script lang="ts">
  let { children } = $props();
</script>

<main class="slide-up">
  <a class="back" href="/lab">← All components</a>
  {@render children()}
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    max-width: min(70ch, 100%);
    min-height: var(--height-content);
    margin: 0 auto;
    padding: 3rem 1.5rem;
  }

  .back {
    align-self: flex-start;
    font: var(--font-body2);
    color: var(--color-text-muted);
    text-decoration: none;

    &:hover {
      color: var(--color-text);
    }
  }
</style>
