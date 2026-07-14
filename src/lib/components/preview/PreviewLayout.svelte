<script lang="ts">
  import type { Snippet } from "svelte";
  import MarkupText from "$lib/components/display/MarkupText.svelte";

  let {
    component,
    label,
    guide,
    preview,
  }: { component: string; label: string; guide?: string; preview: Snippet } = $props();
</script>

<article>
  <header>
    <p class="eyebrow">{component}</p>
    <h1>{label}</h1>
    {#if guide}
      <MarkupText markup={guide} />
    {/if}
  </header>

  {@render preview()}
</article>

<style>
  article {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  header {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .eyebrow {
    font: var(--font-caption);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }

  h1 {
    font: var(--font-title1);
  }
</style>
