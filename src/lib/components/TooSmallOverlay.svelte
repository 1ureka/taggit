<script lang="ts">
  let {
    minWidth,
    minHeight,
    currentWidth,
    currentHeight,
    label = "此功能",
  }: {
    minWidth: number;
    minHeight: number;
    currentWidth: number;
    currentHeight: number;
    label?: string;
  } = $props();
</script>

<div class="too-small-overlay">
  <div class="too-small-card">
    <div class="too-small-icon">⚠</div>
    <h2 class="too-small-title">視窗過小</h2>
    <p class="too-small-desc">
      {label}需要至少 {minWidth}×{minHeight} 的視窗大小才能正常使用。<br />請放大您的瀏覽器視窗。
    </p>
    <span class="too-small-current">{currentWidth} × {currentHeight}</span>
  </div>
</div>

<style>
  .too-small-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    z-index: 9999;
  }

  .too-small-card {
    text-align: center;
    padding: 2.5rem;
    max-width: 24rem;
  }

  .too-small-icon {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    opacity: 0.6;
  }

  .too-small-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    color: var(--text);
  }

  .too-small-desc {
    font-size: 0.875rem;
    color: var(--text-muted);
    line-height: 1.6;
    margin-bottom: 1rem;
  }

  .too-small-current {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-dim);
  }
</style>
