<script lang="ts">
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
      <section id="section-collection">
        <h2 class="title">圖片集路徑</h2>
        <p class="desc">設定圖片集的根目錄。此路徑下會自動建立 <code>images/</code> 子目錄：</p>

        <ul class="dir-list">
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

        <form class="collection-form" onsubmit={collection.handleFormSubmit}>
          <label for="collection-root">圖片集根目錄</label>
          <input
            id="collection-root"
            type="text"
            class="text-input"
            bind:value={collection.inputValue}
            placeholder="例如 C:/Users/you/Pictures/tagged"
          />
          {#if collection.message}
            <p class="form-message" class:error={collection.isError}>
              {collection.message}
            </p>
          {/if}
          <button type="submit" class="btn-primary" class:pending={collection.saving} disabled={collection.saving}>
            <span>儲存</span>
          </button>
        </form>
      </section>

      {#if data.collectionRoot}
        <section id="section-tags">
          <h2 class="title">標籤管理</h2>
          <p class="desc">
            將某個標籤全域重命名為另一個名稱。若某張圖片已同時擁有新舊兩個標籤，重命名後舊標籤會直接移除，不會產生重複。
          </p>

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

        <section id="section-images">
          <h2 class="title">圖片與快取</h2>
          <p class="desc">管理圖片處理快取與檢查資料完整性。</p>

          <div class="tool-card">
            <div class="tool-header">
              <IconPhoto size={18} />
              <h3>圖片快取</h3>
            </div>
            <p class="tool-desc">
              系統會將處理過的縮圖與 WebP 轉換結果暫存於記憶體中，加速後續存取。快取會在伺服器重啟時自動清空。
            </p>
            <div class="cache-stats">
              <span>{images.cacheEntries} 張圖片</span>
              <span class="sep">·</span>
              <span>{images.cacheMB} MB</span>
            </div>
            <div class="tool-actions">
              <button
                class="btn-outlined btn-sm"
                class:pending={images.cacheBusy}
                onclick={images.handleClearBtnClick}
                disabled={images.cacheBusy}
              >
                <span>清空快取</span>
              </button>
            </div>
            {#if images.cacheResult}
              <p class="tool-result">{images.cacheResult}</p>
            {/if}
          </div>

          <div class="tool-card">
            <div class="tool-header">
              <IconFileSearch size={18} />
              <h3>元資料完整性</h3>
            </div>
            <p class="tool-desc">
              檢查是否有圖片缺少寬高或 BlurHash 等元資料。這可能因提交時 sharp 處理失敗所導致。檢查後可選擇批次補算。
            </p>
            <div class="tool-actions">
              <button
                class="btn-outlined btn-sm"
                class:pending={images.metaBusy}
                onclick={images.handleCheckBtnClick}
                disabled={images.metaBusy}
              >
                <span>開始檢查</span>
              </button>
              {#if images.metaMissing > 0}
                <button
                  class="btn-outlined btn-sm"
                  class:pending={images.metaBusy}
                  onclick={images.handleFixBtnClick}
                  disabled={images.metaBusy}
                >
                  <span>補算 {images.metaMissing} 張</span>
                </button>
              {/if}
            </div>
            {#if images.metaResult}
              <p class="tool-result">{images.metaResult}</p>
            {/if}
          </div>
        </section>

        <section id="section-maintenance">
          <h2 class="title">系統維護</h2>
          <p class="desc">提供資料完整性檢查與維護工具，確保檔案系統與資料庫之間的一致性。</p>

          <div class="tool-card">
            <div class="tool-header">
              <IconFileAlert size={18} />
              <h3>缺失檔案檢查</h3>
            </div>
            <p class="tool-desc">
              掃描資料庫，找出有記錄但對應檔案已不存在的項目。這類記錄通常因檔案曾被手動刪除而產生。檢查後可選擇移除這些失效的資料庫記錄。
            </p>
            <div class="tool-actions">
              <button
                class="btn-outlined btn-sm"
                class:pending={maintenance.missingBusy}
                onclick={maintenance.handleMissingCheckClick}
                disabled={maintenance.missingBusy}
              >
                <span>開始檢查</span>
              </button>
              {#if maintenance.missingList.length > 0}
                <button
                  class="btn-destructive btn-sm"
                  class:pending={maintenance.missingBusy}
                  onclick={maintenance.handleMissingDeleteClick}
                  disabled={maintenance.missingBusy}
                >
                  <span>刪除 {maintenance.missingList.length} 個缺失記錄</span>
                </button>
              {/if}
            </div>
            {#if maintenance.missingResult}
              <p class="tool-result">{maintenance.missingResult}</p>
            {/if}
            {#if maintenance.missingList.length > 0}
              <ul class="file-list">
                {#each maintenance.missingList as id}
                  <li>{id}</li>
                {/each}
              </ul>
            {/if}
          </div>

          <div class="tool-card">
            <div class="tool-header">
              <IconDatabase size={18} />
              <h3>備份</h3>
            </div>
            <p class="tool-desc">將目前的圖片集（images/ 目錄與 db.json）打包為 ZIP 備份檔，下載至你的裝置。</p>
            <div class="tool-actions">
              <button
                class="btn-outlined btn-sm"
                class:pending={maintenance.backupBusy}
                onclick={maintenance.handleBackupClick}
                disabled={maintenance.backupBusy}
              >
                <span>下載備份</span>
              </button>
            </div>
            {#if maintenance.backupResult}
              <p class="tool-result">{maintenance.backupResult}</p>
            {/if}
          </div>
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

  /* --- Nav --- */

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

  /* --- Main --- */

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

  /* --- Sections --- */

  section {
    padding-bottom: 2.5rem;
    margin-bottom: 2.5rem;
    border-bottom: var(--border-style);

    & > .title {
      font-size: 1.25rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      margin-bottom: 0.5rem;
    }

    & > .desc {
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

  /* --- Collection --- */

  .dir-list {
    color: var(--text-muted);
    font-size: var(--font-size-body2);
    line-height: 1.8;
    margin-bottom: 1.5rem;
    padding-left: 1.25rem;

    & code {
      font-family: var(--font-mono);
      background: var(--bg-active);
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      font-size: var(--font-size-caption);
    }
  }

  .alert-wrapper {
    margin-bottom: 1.25rem;
  }

  .collection-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    & > label {
      font-size: var(--font-size-body1);
      font-weight: 500;
      color: var(--text);
    }

    & > .form-message {
      font-size: var(--font-size-body2);
      color: var(--color-success);

      &.error {
        color: var(--destructive);
      }
    }
  }

  /* --- Tags --- */

  .field {
    margin-bottom: 0.75rem;
  }

  .label {
    display: block;
    font-size: var(--font-size-body1);
    font-weight: 500;
    color: var(--text);
    margin-bottom: 0.375rem;
  }

  .result {
    margin-top: 0.75rem;
    font-size: var(--font-size-body2);
    color: var(--color-success);

    &.error {
      color: var(--destructive);
    }
  }

  /* --- Tool cards --- */

  .tool-card {
    padding: 1.25rem;
    background: var(--bg-card);
    border: var(--border-style);
    border-radius: calc(var(--radius) * 1.5);
    margin-bottom: 1rem;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .tool-header {
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

  .tool-desc {
    color: var(--text-muted);
    font-size: var(--font-size-body2);
    line-height: 1.7;
    margin-bottom: 1rem;
  }

  .tool-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .tool-result {
    margin-top: 0.75rem;
    font-size: var(--font-size-body2);
    color: var(--text-muted);
  }

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

  .file-list {
    margin-top: 0.5rem;
    padding-left: 1.25rem;
    font-size: var(--font-size-body2);
    color: var(--text-dim);
    line-height: 1.6;
    max-height: 12rem;
    overflow-y: auto;
  }
</style>
