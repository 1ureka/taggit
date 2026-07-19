<script lang="ts">
  import { getNavContext } from "../logic/nav.svelte";
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";

  const nav = getNavContext();
</script>

<nav>
  {#each nav.sections as section (section.id)}
    {@const active = section.id === nav.activeId}
    {@const background = active ? "background-color: var(--color-bg-active);" : ""}
    {@const style = `font: var(--font-body2); display: block; text-align: left; ${background}`}
    <ButtonLink variant="ghost" {style} href="#section-{section.id}">
      {section.label}
    </ButtonLink>
  {/each}
</nav>

<style>
  nav {
    width: 200px;
    flex-shrink: 0;
    padding: 1.5rem 0.75rem;
    border-right: var(--border-style);
    display: flex;
    flex-direction: column;
    gap: 0.125rem;

    @media (max-width: 768px) {
      width: 100%;
      flex-direction: row;
      padding: 0.5rem 0.75rem;
      border-right: none;
      border-bottom: var(--border-style);
      overflow-x: auto;
      gap: 0.25rem;
    }
  }
</style>
