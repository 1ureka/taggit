<script lang="ts">
  import Alert from "$lib/components/Alert.svelte";
  import { getSettingsContext } from "./context.svelte.js";
  import { createSettingsCollection } from "./settingsCollection.svelte.js";

  const ctx = getSettingsContext();
  const ui = createSettingsCollection();
</script>

<section id="section-collection" class="settings-section">
  <h2 class="section-title">圖片集路徑</h2>
  <p class="section-desc">設定圖片集的根目錄。此路徑下會自動建立三個子目錄：</p>
  <ul class="section-list">
    <li><code>staged/</code> — 待審查的新圖片放在這裡，由 Tagger 進行標記與提交。</li>
    <li><code>committed/</code> — 已提交的圖片與其標籤資料存放於此。</li>
    <li><code>trash/</code> — 被刪除的圖片暫存在此，可從垃圾桶恢復或永久刪除。</li>
  </ul>

  {#if ctx.alert === "default"}
    <div class="section-alert">
      <Alert type="default" message="尚未設定圖片集路徑，請在下方設定後繼續。" />
    </div>
  {:else if ctx.alert === "error"}
    <div class="section-alert">
      <Alert type="error" message="設定的路徑無效或無法存取，請重新設定。" />
    </div>
  {/if}

  <form onsubmit={ui.handleFormSubmit} class="section-form">
    <label for="collection-root" class="section-label">圖片集根目錄</label>
    <input
      id="collection-root"
      type="text"
      class="input"
      bind:value={ui.inputValue}
      placeholder="例如 C:/Users/you/Pictures/tagged"
    />

    {#if ui.message}
      <p class="section-message" class:error={ui.isError}>
        {ui.message}
      </p>
    {/if}

    <button type="submit" class="btn btn-primary" disabled={ui.saving}>
      {ui.saving ? "儲存中…" : "儲存"}
    </button>
  </form>
</section>

<style>
  .settings-section {
    padding-bottom: 2.5rem;
    margin-bottom: 2.5rem;
    border-bottom: 1px solid var(--border);
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin-bottom: 0.5rem;
  }

  .section-desc {
    color: var(--text-muted);
    font-size: 0.875rem;
    line-height: 1.7;
    margin-bottom: 0.5rem;
  }

  .section-list {
    color: var(--text-muted);
    font-size: 0.8125rem;
    line-height: 1.8;
    margin-bottom: 1.5rem;
    padding-left: 1.25rem;
  }

  .section-list code {
    font-family: var(--font-mono);
    background: var(--bg-active);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-size: 0.75rem;
  }

  .section-alert {
    margin-bottom: 1.25rem;
  }

  .section-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text);
  }

  .section-message {
    font-size: 0.8125rem;
    color: var(--color-success);
  }

  .section-message.error {
    color: var(--destructive);
  }
</style>
