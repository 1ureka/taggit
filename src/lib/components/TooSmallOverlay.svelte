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
  @import "../styles/TooSmallOverlay.css";
</style>
