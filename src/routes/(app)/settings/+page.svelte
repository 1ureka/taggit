<script lang="ts">
  import type { PageData } from "./$types";

  import CollectionSection from "./sections/CollectionSection.svelte";
  import CacheSection from "./sections/CacheSection.svelte";
  import MaintenanceSection from "./sections/MaintenanceSection.svelte";
  import Button from "$lib/components/actions/Button.svelte";

  let { data }: { data: PageData } = $props();

  // ---

  const sections = $derived.by(() => {
    const base = [{ id: "collection", label: "圖片集路徑" }];
    if (data.databaseLoaded) {
      base.push({ id: "images", label: "圖片與快取" });
      base.push({ id: "maintenance", label: "系統維護" });
    }
    return base;
  });

  let mainEl = $state<HTMLElement>();
  let activeId = $state("collection");

  // scroll-spy：捲動時以「區塊頂端進入容器頂端 100px 內」判定當前區塊
  $effect(() => {
    const container = mainEl;
    if (!container) return;
    const ids = sections.map((s) => s.id);

    const onScroll = () => {
      const containerTop = container.getBoundingClientRect().top;
      let current = ids[0] ?? "collection";
      for (const id of ids) {
        const el = document.getElementById(`section-${id}`);
        if (!el) continue;
        if (el.getBoundingClientRect().top - containerTop <= 100) {
          current = id;
        }
      }
      activeId = current;
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  });

  const handleNavClick = (id: string) => {
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth" });
  };
</script>

<svelte:head>
  <title>設定 — Taggit</title>
</svelte:head>

<div class="layout">
  <nav>
    {#each sections as section (section.id)}
      {@const active = section.id === activeId}
      {@const background = active ? "background-color: var(--color-bg-active);" : ""}
      {@const style = `font: var(--font-body2); display: block; text-align: left; ${background}`}
      <Button variant="ghost" {style} onclick={() => handleNavClick(section.id)}>
        {section.label}
      </Button>
    {/each}
  </nav>

  <main bind:this={mainEl}>
    <div class="slide-up">
      <section id="section-collection">
        <h2>圖片集路徑</h2>
        <CollectionSection collectionRoot={data.collectionRoot} />
      </section>

      {#if data.databaseLoaded}
        <section id="section-images">
          <h2>圖片與快取</h2>
          <CacheSection cacheStats={data.cacheStats} />
        </section>

        <section id="section-maintenance">
          <h2>系統維護</h2>
          <MaintenanceSection />
        </section>
      {/if}
    </div>
  </main>
</div>

<style>
  .layout {
    display: flex;
    flex: 1;
    min-height: 0;

    @media (max-width: 768px) {
      flex-direction: column;
    }
  }

  /* --- */

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

  /* --- */

  main {
    flex: 1;
    overflow-y: auto;
    scrollbar-gutter: stable;
    min-height: 0;

    & > div.slide-up {
      max-width: 720px;
      margin: 0 auto;
      padding: 2rem 2rem 6rem;

      @media (max-width: 768px) {
        padding: 1.5rem 1rem 4rem;
      }
    }
  }

  section {
    padding-bottom: 2.5rem;
    margin-bottom: 2.5rem;
    border-bottom: var(--border-style);

    &:last-of-type {
      border-bottom: none;
      margin-bottom: 0;
    }

    & > h2 {
      font: var(--font-title1);
      font-weight: normal;
      margin-bottom: 0.75rem;
    }
  }
</style>
