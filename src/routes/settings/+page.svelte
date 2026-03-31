<script lang="ts">
  import type { PageData } from "./$types.js";

  import SettingsNav from "./SettingsNav.svelte";
  import SettingsCollection from "./SettingsCollection.svelte";
  import SettingsTagRename from "./SettingsTagRename.svelte";
  import SettingsImages from "./SettingsImages.svelte";
  import SettingsMaintenance from "./SettingsMaintenance.svelte";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Settings — Image Manager</title>
</svelte:head>

<div class="layout">
  <SettingsNav collectionRoot={data.collectionRoot} />

  <main id="settings-main">
    <div class="slide-up">
      <section id="section-collection">
        <h2 class="title">圖片集路徑</h2>
        <p class="desc">設定圖片集的根目錄。此路徑下會自動建立 <code>images/</code> 子目錄：</p>
        <SettingsCollection collectionRoot={data.collectionRoot} />
      </section>

      {#if data.collectionRoot}
        <section id="section-tags">
          <h2 class="title">標籤管理</h2>
          <p class="desc">
            將某個標籤全域重命名為另一個名稱。若某張圖片已同時擁有新舊兩個標籤，重命名後舊標籤會直接移除，不會產生重複。
          </p>
          <SettingsTagRename />
        </section>

        <section id="section-images">
          <h2 class="title">圖片與快取</h2>
          <p class="desc">管理圖片處理快取與檢查資料完整性。</p>
          <SettingsImages cacheStats={data.cacheStats} />
        </section>

        <section id="section-maintenance">
          <h2 class="title">系統維護</h2>
          <p class="desc">提供資料完整性檢查與維護工具，確保檔案系統與資料庫之間的一致性。</p>
          <SettingsMaintenance />
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
  }

  main {
    flex: 1;
    overflow-y: auto;
    scrollbar-gutter: stable;
    min-height: 0;

    & > div.slide-up {
      max-width: 720px;
      margin: 0 auto;
      padding: 2rem 2rem 6rem;
    }
  }

  section {
    padding-bottom: 2.5rem;
    margin-bottom: 2.5rem;
    border-bottom: 1px solid var(--border);

    & > .title {
      font-size: 1.25rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      margin-bottom: 0.5rem;
    }

    & > .desc {
      color: var(--text-muted);
      font-size: 0.875rem;
      line-height: 1.7;
      margin-bottom: 1rem;
    }

    &:last-of-type {
      border-bottom: none;
      margin-bottom: 0;
    }
  }
</style>
