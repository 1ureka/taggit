<script lang="ts">
  import { SettingsNav } from "./settingsNav.svelte.js";

  type Props = { collectionRoot: string };
  let { collectionRoot }: Props = $props();

  const ui = new SettingsNav({
    get collectionRoot() {
      return collectionRoot;
    },
  });
</script>

<nav>
  {#each ui.sections as section}
    <button class:active={section.id === ui.activeId} onclick={() => ui.handleNavClick(section.id)}>
      {section.label}
    </button>
  {/each}
</nav>

<style>
  nav {
    width: 200px;
    flex-shrink: 0;
    padding: 1.5rem 0.75rem;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  nav > button {
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
    color: var(--text-muted);
    text-align: left;
    border-radius: var(--radius);
    transition:
      color 0.15s,
      background 0.15s;

    &:hover {
      color: var(--text);
      background: var(--bg-hover);
    }

    &.active {
      color: var(--text);
      background: var(--bg-active);
    }
  }
</style>
