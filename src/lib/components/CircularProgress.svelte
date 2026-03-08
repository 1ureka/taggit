<script lang="ts">
  type Props = { label?: string };
  let { label = "載入中…" }: Props = $props();
</script>

<div class="circular-progress">
  <span class="circular-progress-label">{label}</span>
  <span class="circular-progress-spinner"></span>
</div>

<style>
  .circular-progress {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .circular-progress-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
  }

  @keyframes circular-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .circular-progress-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid var(--text-dim);
    border-top-color: var(--text);
    border-radius: 50%;
    animation: circular-spin 0.6s linear infinite;
  }
</style>
