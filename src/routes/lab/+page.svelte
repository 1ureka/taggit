<script lang="ts">
  import { showcaseSections } from "./config";
</script>

<svelte:head>
  <title>Component Playground</title>
</svelte:head>

<main class="slide-up">
  <header>
    <h1>Component Playground</h1>
    <p>A parking lot for UI components — built here, tested here.</p>
  </header>

  {#each showcaseSections as section (section.category)}
    <section>
      <h2>{section.category}</h2>

      {#if section.cards.length === 0}
        <p class="empty">Nothing here yet.</p>
      {:else}
        <div class="grid">
          {#each section.cards as card (card.slug)}
            <a class="card" href="/{card.slug}">
              <p class="eyebrow">{card.component}</p>
              <h3>{card.label}</h3>
              <p>{card.blurb}</p>
            </a>
          {/each}
        </div>
      {/if}
    </section>
  {/each}
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    gap: 3rem;
    max-width: min(160ch, 100%);
    min-height: var(--height-content);
    margin: 0 auto;
    padding: 3rem 1.5rem;
  }

  header {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  header h1 {
    font: var(--font-title1);
  }

  header p {
    font: var(--font-body1);
    color: var(--color-text);
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  section h2 {
    font: var(--font-title2);
  }

  .empty {
    font: var(--font-body2);
    color: var(--color-text-muted);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
    gap: 1rem;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 1rem 1.25rem;
    background-color: var(--color-bg-card);
    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 2);
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .card:hover {
    background-color: var(--color-bg-hover);
    border-color: var(--color-border-hover);
  }

  .card .eyebrow {
    font: var(--font-caption);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }

  .card h3 {
    font: var(--font-title2);
  }

  .card p:last-child {
    font: var(--font-body2);
    color: var(--color-text);
  }
</style>
