<script lang="ts">
  import type { Snippet } from "svelte";
  import { page } from "$app/state";
  import type { PageData } from "./$types.js";

  import { IconPhotoFilled, IconFilter, IconAlertCircleFilled, IconDatabase } from "$lib/ui/icons/index.js";
  import Alert from "$lib/components/feedback/Alert.svelte";
  import Autocomplete from "$lib/components/form/Autocomplete.svelte";

  import { SettingsNav } from "./settingsNav.svelte.js";
  import { SettingsCollection } from "./settingsCollection.svelte.js";
  import { SettingsTagRename } from "./settingsTagRename.svelte.js";
  import { SettingsHiddenTags } from "./settingsHiddenTags.svelte.js";
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

  const hiddenTags = new SettingsHiddenTags({
    get authoringTags() {
      return data.authoringTags;
    },
  });

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
        onkeydown={collection.handleInputKeydown}
        oninput={collection.handleInput}
      />

      <div class="history-hint">
        <span>{collection.historyHint}</span>
        {#if collection.history.length > 0}
          <button type="button" class="link-btn" onclick={collection.handleClearHistoryClick}>清空</button>
        {/if}
      </div>

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
    <ul>
      <li><b>重命名</b> — 選擇並填寫新名稱。若某張圖片同時擁有新舊標籤，只會移除舊標籤，不會產生重複。</li>
      <li><b>刪除</b> — 選擇但不填寫新名稱。若有圖片只剩下該標籤，將會需要透過提供的連結手動先行解決。</li>
    </ul>

    <div class="field">
      <span class="label">標籤名稱</span>
      <Autocomplete
        bind:tags={tagRename.selectedTags}
        candidates={data.authoringTags}
        variant="inline"
        placeholder="選擇標籤..."
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
        placeholder="留空則為刪除標籤..."
        autocomplete="off"
        onkeydown={tagRename.handleNewNameKeydown}
      />
    </div>

    <button
      type="button"
      class="btn-primary"
      class:pending={tagRename.busy}
      onclick={tagRename.handleRenameClick}
      disabled={!tagRename.canSubmit}
    >
      <span>重命名</span>
    </button>

    {#if tagRename.result}
      {#if tagRename.result.type === "conflict"}
        <p class="result error">
          刪除會導致有圖片沒有標籤，請<a href="/editor?includedTags={encodeURIComponent(tagRename.result.tagName)}"
            >前往編輯器</a
          >解決後再試一次。
        </p>
      {:else}
        <p class="result" class:error={tagRename.result.type === "error"}>
          {tagRename.result.message}
        </p>
      {/if}
    {/if}
  </section>
{/snippet}

{#snippet hiddenTagsSettings()}
  <section id="section-hidden">
    <h2>隱藏標籤</h2>
    <p>帶有隱藏標籤的圖片，只有在查詢明確包含此標籤時才會出現，可用來收納想私藏或干擾探索的標籤。</p>

    <div class="field">
      <span class="label">目前隱藏中</span>
      {#if hiddenTags.hiddenTags.length > 0}
        <div class="hidden-list">
          {#each hiddenTags.hiddenTags as tag}
            <span class="chip">{tag}</span>
          {/each}
        </div>
      {:else}
        <p class="empty">尚無隱藏標籤</p>
      {/if}
    </div>

    <div class="field">
      <span class="label">選擇標籤</span>
      <Autocomplete
        bind:tags={hiddenTags.selectedTags}
        candidates={data.authoringTags}
        variant="inline"
        placeholder="選擇標籤..."
        onchange={hiddenTags.handleSelectChange}
      />
    </div>

    <button
      type="button"
      class="btn-primary"
      class:pending={hiddenTags.busy}
      onclick={hiddenTags.handleToggleClick}
      disabled={!hiddenTags.canSubmit}
    >
      <span>{hiddenTags.selectedHidden ? "取消隱藏" : "設為隱藏"}</span>
    </button>

    {#if hiddenTags.message}
      <p class="result" class:error={hiddenTags.isError}>{hiddenTags.message}</p>
    {/if}
  </section>
{/snippet}

{#snippet toolCard(props: {
  /** 該工具的圖示 */
  Icon: typeof IconPhotoFilled;
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
          <button type="button" class="btn-outlined btn-sm" class:pending disabled={pending} {onclick}>
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
      Icon: IconPhotoFilled,
      title: "圖片快取",
      description: "系統會將處理過的縮圖與 WebP 轉換結果暫存於記憶體中，加速後續存取。快取會在伺服器重啟時自動清空。",
      content: cacheStats,
      actions: [{ label: "清空快取", onclick: images.handleClearBtnClick, pending: images.cacheBusy }],
      result: images.cacheResult,
    })}

    {@render toolCard({
      Icon: IconFilter,
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
      Icon: IconAlertCircleFilled,
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
      <button type="button" class:active={section.id === nav.activeId} onclick={() => nav.handleNavClick(section.id)}>
        {section.label}
      </button>
    {/each}
  </nav>

  <main id="settings-main">
    <div class="slide-up">
      {@render collectionSettings()}
      {#if data.databaseLoaded}
        {@render tagsSettings()}
        {@render hiddenTagsSettings()}
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
      font-weight: normal;
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
      background: var(--bg-active);
      padding: 0.125rem 0.375rem;
      border-radius: calc(2 * var(--radius) / 3);
      font-family: var(--font-mono);
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

  section#section-collection > form > .history-hint {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--font-size-caption);
    line-height: 2;
    color: var(--text-dim);

    & > button.link-btn {
      font-size: inherit;
      line-height: inherit;
      color: var(--text-muted);
      text-decoration: underline;
      text-underline-offset: 2px;

      &:hover {
        color: var(--text);
      }
    }
  }

  /* --- */

  section#section-tags > ul {
    color: var(--text-muted);
    font-size: var(--font-size-body1);
    line-height: 1.7;
    margin-bottom: 1rem;
    padding-left: 1.25rem;

    & > li > b {
      font-weight: normal;
      color: var(--text);
    }
  }

  section#section-tags > .field {
    margin-bottom: 0.75rem;
  }

  section#section-tags > .field > .label {
    display: block;
    font-size: var(--font-size-body1);
    color: var(--text);
    margin-bottom: 0.375rem;
  }

  section#section-tags > .result {
    font-size: var(--font-size-body2);
    color: var(--color-success);
    margin-top: 0.75rem;

    &.error {
      color: var(--destructive);
    }

    & > a {
      color: var(--text);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  /* --- */

  section#section-hidden > .field {
    margin-bottom: 0.75rem;
  }

  section#section-hidden > .field > .label {
    display: block;
    font-size: var(--font-size-body1);
    color: var(--text);
    margin-bottom: 0.375rem;
  }

  section#section-hidden .hidden-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  section#section-hidden .empty {
    font-size: var(--font-size-body2);
    color: var(--text-dim);
  }

  section#section-hidden > .result {
    font-size: var(--font-size-body2);
    color: var(--color-success);
    margin-top: 0.75rem;

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
      font-size: var(--font-size-title2);
      font-weight: normal;
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
