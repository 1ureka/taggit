<script lang="ts">
  import type { Snippet } from "svelte";
  import { page } from "$app/state";
  import { IconPhoto, IconFileSearch, IconFileAlert, IconDatabase } from "@tabler/icons-svelte";
  import type { PageData } from "./$types.js";

  import Alert from "$lib/components/Alert.svelte";
  import Autocomplete from "$lib/components/Autocomplete.svelte";

  import { SettingsNav } from "./settingsNav.svelte.js";
  import { SettingsCollection } from "./settingsCollection.svelte.js";
  import { SettingsTagRename } from "./settingsTagRename.svelte.js";
  import { SettingsImages } from "./settingsImages.svelte.js";
  import { SettingsMaintenance } from "./settingsMaintenance.svelte.js";

  let { data }: { data: PageData } = $props();

  const nav = new SettingsNav({
    get collectionRoot() {
      return data.collectionRoot;
    },
  });

  const collection = new SettingsCollection({
    get collectionRoot() {
      return data.collectionRoot;
    },
  });

  const tagRename = new SettingsTagRename();

  const images = new SettingsImages({
    get cacheStats() {
      return data.cacheStats;
    },
  });

  const maintenance = new SettingsMaintenance();
</script>

<svelte:head>
  <title>設定 — Taggit</title>
</svelte:head>

{#snippet collectionSettings()}
  <section id="section-collection">
    <h2>圖片集路徑</h2>
    <p>設定圖片集的根目錄。此路徑下會自動建立 <code>images/</code> 子目錄：</p>

    <ul>
      <li><code>images/</code> — 所有圖片存放於此。</li>
    </ul>

    {#if page.url.searchParams.get("alert") === "default"}
      <div class="alert-wrapper">
        <Alert type="default" message="尚未設定圖片集路徑，請在下方設定後繼續。" />
      </div>
    {:else if page.url.searchParams.get("alert") === "error"}
      <div class="alert-wrapper">
        <Alert type="error" message="設定的路徑無效或無法存取，請重新設定。" />
      </div>
    {/if}

    <form onsubmit={collection.handleFormSubmit}>
      <label for="collection-root">圖片集根目錄</label>
      <input
        id="collection-root"
        type="text"
        class="text-input"
        bind:value={collection.inputValue}
        placeholder="例如 C:/Users/you/Pictures/tagged"
      />

      {#if collection.message}
        <p class:error={collection.isError}>
          {collection.message}
        </p>
      {/if}

      <button type="submit" class="btn-primary" class:pending={collection.saving} disabled={collection.saving}>
        <span>儲存</span>
      </button>
    </form>
  </section>
{/snippet}

{#snippet tagsSettings()}
  <section id="section-tags">
    <h2>標籤管理</h2>
    <p>將某個標籤全域重命名為另一個名稱。若某張圖片已同時擁有新舊兩個標籤，重命名後舊標籤會直接移除，不會產生重複。</p>

    <div class="field">
      <span class="label">舊標籤名稱</span>
      <Autocomplete
        bind:tags={tagRename.selectedTags}
        variant="inline"
        placeholder="選擇要重命名的標籤..."
        onchange={tagRename.handleSelectChange}
      />
    </div>

    <div class="field">
      <label class="label" for="rename-new">新標籤名稱</label>
      <input
        bind:this={tagRename.newInputEl}
        bind:value={tagRename.newName}
        id="rename-new"
        class="text-input"
        placeholder="輸入新的標籤名稱..."
        autocomplete="off"
        onkeydown={tagRename.handleNewNameKeydown}
      />
    </div>

    <button
      class="btn-primary"
      class:pending={tagRename.busy}
      onclick={tagRename.handleRenameClick}
      disabled={!tagRename.canSubmit}
    >
      <span>重命名</span>
    </button>

    {#if tagRename.result}
      <p class="result" class:error={tagRename.resultIsError}>
        {tagRename.result}
      </p>
    {/if}
  </section>
{/snippet}

{#snippet toolCard(props: {
  /** 該工具的圖示 */
  Icon: typeof IconPhoto;
  /** 工具標題 */
  title: string;
  /** 工具說明文字 */
  description: string;
  /** 可選的額外渲染內容 */
  content?: Snippet;
  /** 工具的所有可用操作 */
  actions: Array<{ label: string; onclick: () => void; pending?: boolean; hide?: boolean }>;
  /** 工具操作的結果 */
  result?: string;
})}
  <article class="tool-card">
    <header>
      <props.Icon size={18} />
      <h3>{props.title}</h3>
    </header>

    <p>{props.description}</p>

    {#if props.content}
      <div>
        {@render props.content()}
      </div>
    {/if}

    <footer>
      {#each props.actions as { label, onclick, pending, hide }}
        {#if !hide}
          <button class="btn-outlined btn-sm" class:pending disabled={pending} {onclick}>
            <span>{label}</span>
          </button>
        {/if}
      {/each}
    </footer>

    {#if props.result}
      <output>{props.result}</output>
    {/if}
  </article>
{/snippet}

{#snippet imagesSettings()}
  <section id="section-images">
    <h2>圖片與快取</h2>
    <p>管理圖片處理快取與檢查資料完整性。</p>

    {#snippet cacheStats()}
      <div class="cache-stats">
        <span>{images.cacheEntries} 張圖片</span>
        <span class="sep">·</span>
        <span>{images.cacheMB} MiB</span>
      </div>
    {/snippet}

    {@render toolCard({
      Icon: IconPhoto,
      title: "圖片快取",
      description: "系統會將處理過的縮圖與 WebP 轉換結果暫存於記憶體中，加速後續存取。快取會在伺服器重啟時自動清空。",
      content: cacheStats,
      actions: [{ label: "清空快取", onclick: images.handleClearBtnClick, pending: images.cacheBusy }],
      result: images.cacheResult,
    })}

    {@render toolCard({
      Icon: IconFileSearch,
      title: "元資料完整性",
      description: "檢查資料庫是否有已提交圖片缺少寬高或 BlurHash 等元資料，檢查後可選擇批次補算。",
      actions: [
        { label: "開始檢查", onclick: images.handleCheckBtnClick, pending: images.metaBusy },
        {
          label: `補算 ${images.metaMissing} 張`,
          onclick: images.handleFixBtnClick,
          pending: images.metaBusy,
          hide: images.metaMissing <= 0,
        },
      ],
      result: images.metaResult,
    })}
  </section>
{/snippet}

{#snippet maintenanceSettings()}
  <section id="section-maintenance">
    <h2>系統維護</h2>
    <p>提供資料完整性檢查與維護工具，確保檔案系統與資料庫之間的一致性。</p>

    {@render toolCard({
      Icon: IconFileAlert,
      title: "缺失檔案檢查",
      description:
        "找出資料庫有記錄但對應檔案已不存在的項目，通常因曾手動刪除檔案而產生，檢查後可選擇移除這些失效的記錄。",
      actions: [
        { label: "開始檢查", onclick: maintenance.handleMissingCheckClick, pending: maintenance.missingBusy },
        {
          label: `刪除 ${maintenance.missingList.length} 個缺失記錄`,
          onclick: maintenance.handleMissingDeleteClick,
          pending: maintenance.missingBusy,
          hide: maintenance.missingList.length <= 0,
        },
      ],
      result: maintenance.missingResult,
    })}

    {@render toolCard({
      Icon: IconDatabase,
      title: "備份",
      description: "將目前的圖片集 (images/ 目錄與 db.json) 打包為 ZIP 備份檔，下載至你的裝置。",
      actions: [{ label: "下載備份", onclick: maintenance.handleBackupClick, pending: maintenance.backupBusy }],
      result: maintenance.backupResult,
    })}
  </section>
{/snippet}

<div class="layout">
  <nav>
    {#each nav.sections as section}
      <button class:active={section.id === nav.activeId} onclick={() => nav.handleNavClick(section.id)}>
        {section.label}
      </button>
    {/each}
  </nav>

  <main id="settings-main">
    <div class="slide-up">
      {@render collectionSettings()}
      {#if data.collectionRoot}
        {@render tagsSettings()}
        {@render imagesSettings()}
        {@render maintenanceSettings()}
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

  nav > button {
    padding: 0.5rem 0.75rem;
    font-size: var(--font-size-body2);
    color: var(--text-muted);
    text-align: left;
    border-radius: var(--radius);
    white-space: nowrap;
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

    & > h2 {
      font-size: var(--font-size-title1);
      font-weight: 500;
      letter-spacing: -0.01em;
      margin-bottom: 0.5rem;
    }

    & > p:first-of-type {
      color: var(--text-muted);
      font-size: var(--font-size-body1);
      line-height: 1.7;
      margin-bottom: 1rem;
    }

    &:last-of-type {
      border-bottom: none;
      margin-bottom: 0;
    }
  }

  /* --- */

  section#section-collection > ul {
    color: var(--text-muted);
    font-size: var(--font-size-body2);
    line-height: 1.8;
    margin-bottom: 1.5rem;
    padding-left: 1.25rem;

    & > li > code {
      font-family: var(--font-mono);
      background: var(--bg-active);
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      font-size: var(--font-size-caption);
    }
  }

  section#section-collection > .alert-wrapper {
    margin-bottom: 1.25rem;
  }

  section#section-collection > form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    & > label {
      font-size: var(--font-size-body1);
      font-weight: 500;
      color: var(--text);
    }

    & > p {
      font-size: var(--font-size-body2);
      color: var(--color-success);

      &.error {
        color: var(--destructive);
      }
    }
  }

  /* --- */

  section#section-tags > .field {
    margin-bottom: 0.75rem;
  }

  section#section-tags > .field > .label {
    display: block;
    font-size: var(--font-size-body1);
    font-weight: 500;
    color: var(--text);
    margin-bottom: 0.375rem;
  }

  section#section-tags > .result {
    margin-top: 0.75rem;
    font-size: var(--font-size-body2);
    color: var(--color-success);

    &.error {
      color: var(--destructive);
    }
  }

  /* --- */

  article.tool-card {
    padding: 1.25rem;
    background: var(--bg-card);
    border: var(--border-style);
    border-radius: calc(var(--radius) * 1.5);
    margin-bottom: 1rem;

    &:last-child {
      margin-bottom: 0;
    }
  }

  article.tool-card > header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    color: var(--text);

    & > h3 {
      font-size: 0.9375rem;
      font-weight: 500;
    }
  }

  article.tool-card > p {
    color: var(--text-muted);
    font-size: var(--font-size-body2);
    line-height: 1.7;
    margin-bottom: 1rem;
  }

  article.tool-card > footer {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  article.tool-card > output {
    display: block;
    margin-top: 0.75rem;
    font-size: var(--font-size-body2);
    color: var(--text-muted);
  }

  /* --- */

  .cache-stats {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    font-size: var(--font-size-body1);
    font-weight: 500;
    color: var(--text);

    & > .sep {
      color: var(--text-dim);
    }
  }
</style>
