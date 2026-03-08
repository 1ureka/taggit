<script lang="ts">
  import { IconPhoto, IconFileSearch } from "@tabler/icons-svelte";
  import { createSettingsImages } from "./settingsImages.svelte.js";

  const ui = createSettingsImages();
</script>

<section id="section-images" class="settings-section">
  <h2 class="section-title">圖片與快取</h2>
  <p class="section-desc">管理圖片處理快取與檢查資料完整性。</p>

  <!-- 快取狀態與清空 -->
  <div class="tool-card">
    <div class="tool-header">
      <IconPhoto size={18} />
      <h3 class="tool-title">圖片快取</h3>
    </div>
    <p class="tool-desc">
      系統會將處理過的縮圖與 WebP 轉換結果暫存於記憶體中，加速後續存取。快取會在伺服器重啟時自動清空。
    </p>

    <div class="cache-stats">
      <span class="cache-stat">{ui.cacheEntries} 張圖片</span>
      <span class="cache-stat-sep">·</span>
      <span class="cache-stat">{ui.cacheMB} MB</span>
    </div>

    <div class="tool-actions">
      <button class="btn btn-sm" onclick={ui.handleClearBtnClick} disabled={ui.cacheBusy}>
        {ui.cacheBusy ? "清空中…" : "清空快取"}
      </button>
    </div>
    {#if ui.cacheResult}
      <p class="tool-result">{ui.cacheResult}</p>
    {/if}
  </div>

  <!-- 元資料檢查 -->
  <div class="tool-card">
    <div class="tool-header">
      <IconFileSearch size={18} />
      <h3 class="tool-title">元資料完整性</h3>
    </div>
    <p class="tool-desc">
      檢查是否有圖片缺少寬高或 BlurHash 等元資料。這可能因提交時 sharp 處理失敗所導致。檢查後可選擇批次補算。
    </p>
    <div class="tool-actions">
      <button class="btn btn-sm" onclick={ui.handleCheckBtnClick} disabled={ui.metaBusy}>
        {ui.metaBusy ? "檢查中…" : "開始檢查"}
      </button>
      {#if ui.metaMissing > 0}
        <button class="btn btn-sm" onclick={ui.handleFixBtnClick} disabled={ui.metaBusy}>
          {ui.metaBusy ? "補算中…" : `補算 ${ui.metaMissing} 張`}
        </button>
      {/if}
    </div>
    {#if ui.metaResult}
      <p class="tool-result">{ui.metaResult}</p>
    {/if}
  </div>
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
    margin-bottom: 1.25rem;
  }

  .tool-card {
    padding: 1.25rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) * 1.5);
    margin-bottom: 1rem;
  }

  .tool-card:last-child {
    margin-bottom: 0;
  }

  .tool-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    color: var(--text);
  }

  .tool-title {
    font-size: 0.9375rem;
    font-weight: 500;
  }

  .tool-desc {
    color: var(--text-muted);
    font-size: 0.8125rem;
    line-height: 1.7;
    margin-bottom: 1rem;
  }

  .cache-stats {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text);
  }

  .cache-stat-sep {
    color: var(--text-dim);
  }

  .tool-actions {
    display: flex;
    gap: 0.5rem;
  }

  .tool-result {
    margin-top: 0.75rem;
    font-size: 0.8125rem;
    color: var(--text-muted);
  }
</style>
