<script lang="ts">
  import type { PageData } from "./$types";

  import { createPageDataContext } from "./logic/page-data.svelte";
  import { createNavContext } from "./logic/nav.svelte";
  import { createCollectionContext } from "./logic/collection.svelte";
  import { createCacheContext } from "./logic/cache.svelte";
  import { createMetadataContext } from "./logic/metadata.svelte";
  import { createMissingContext } from "./logic/missing.svelte";
  import { createBackupContext } from "./logic/backup.svelte";

  import SectionNav from "./nav/SectionNav.svelte";
  import CollectionSection from "./sections/CollectionSection.svelte";
  import CacheSection from "./sections/CacheSection.svelte";
  import MaintenanceSection from "./sections/MaintenanceSection.svelte";

  let { data }: { data: PageData } = $props();

  createPageDataContext(() => data);
  const nav = createNavContext();
  createCollectionContext();
  createCacheContext();
  createMetadataContext();
  createMissingContext();
  createBackupContext();
</script>

<svelte:head>
  <title>設定 — Taggit</title>
</svelte:head>

<div class="layout">
  <SectionNav />

  <main>
    <div class="slide-up">
      <section id="section-collection" {@attach nav.observe}>
        <h2>圖片集路徑</h2>
        <CollectionSection />
      </section>

      {#if data.databaseLoaded}
        <section id="section-images" {@attach nav.observe}>
          <h2>圖片與快取</h2>
          <CacheSection />
        </section>

        <section id="section-maintenance" {@attach nav.observe}>
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

  main {
    flex: 1;
    overflow-y: auto;
    scrollbar-gutter: stable;
    scroll-behavior: smooth;
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
