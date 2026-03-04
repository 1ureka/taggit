<script lang="ts">
  import { IconInfoCircle, IconAlertCircle, IconAlertTriangle } from "@tabler/icons-svelte";

  let {
    type = "default",
    message,
  }: {
    type?: "info" | "error" | "default";
    message: string;
  } = $props();

  const color = $derived(
    type === "info" ? "var(--color-info)" : type === "error" ? "var(--destructive)" : "var(--color-warning)",
  );
</script>

<div class="alert alert-{type} slide-up" role="alert">
  <span class="alert-icon" style="color: {color}">
    {#if type === "info"}
      <IconInfoCircle size={16} stroke={1.5} />
    {:else if type === "error"}
      <IconAlertCircle size={16} stroke={1.5} />
    {:else}
      <IconAlertTriangle size={16} stroke={1.5} />
    {/if}
  </span>
  <span class="alert-message">{message}</span>
</div>

<style>
  .alert {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.75rem 1rem;
    border-radius: var(--radius);
    border: 1px solid;
    font-size: 0.875rem;
    color: var(--text);
    line-height: 1.6;
  }

  .alert-info {
    border-color: var(--color-info);
    background: hsl(from var(--color-info) h s l / 0.08);
  }

  .alert-error {
    border-color: var(--destructive);
    background: hsl(from var(--destructive) h s l / 0.08);
  }

  .alert-default {
    border-color: var(--color-warning);
    background: hsl(from var(--color-warning) h s l / 0.08);
  }

  .alert-icon {
    flex-shrink: 0;
    display: inline-flex;
    margin-top: 2px;
  }

  .alert-message {
    flex: 1;
    min-width: 0;
  }
</style>
