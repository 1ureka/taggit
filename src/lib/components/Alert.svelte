<script lang="ts">
  import { IconInfoCircleFilled, IconAlertCircleFilled, IconAlertTriangleFilled } from "$lib/components/icons";

  type Props = {
    /** 警示類型，會影響顏色與圖示 */
    type?: "info" | "error" | "default";
    /** 警示訊息內容 */
    message: string;
  };

  let { type = "default", message }: Props = $props();
</script>

<div
  role="alert"
  class="slide-up"
  class:info={type === "info"}
  class:error={type === "error"}
  class:default={type === "default"}
>
  <span class="icon">
    {#if type === "info"}
      <IconInfoCircleFilled size={16} color="var(--color-info)" />
    {:else if type === "error"}
      <IconAlertCircleFilled size={16} color="var(--destructive)" />
    {:else}
      <IconAlertTriangleFilled size={16} color="var(--color-warning)" />
    {/if}
  </span>
  <span class="message">{message}</span>
</div>

<style>
  div {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.75rem 1rem;
    border-radius: var(--radius);
    border: var(--border-style);
    font-size: var(--font-size-body1);
    color: var(--text);
    line-height: 1.6;

    &.info {
      border-color: var(--color-info);
      background: hsl(from var(--color-info) h s l / 0.08);
    }

    &.error {
      border-color: var(--destructive);
      background: hsl(from var(--destructive) h s l / 0.08);
    }

    &.default {
      border-color: var(--color-warning);
      background: hsl(from var(--color-warning) h s l / 0.08);
    }
  }

  div > .icon {
    flex-shrink: 0;
    display: inline-flex;
    margin-top: 2px;
  }

  div > .message {
    flex: 1;
    min-width: 0;
  }
</style>
