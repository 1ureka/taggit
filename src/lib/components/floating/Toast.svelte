<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  import { IconX, IconCheckFilled, IconAlertCircleFilled, IconInfoCircleFilled } from "$lib/icons";
  import MarkupText from "$lib/components/display/MarkupText.svelte";
  import LinearProgress from "$lib/components/display/LinearProgress.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import type { ToastVariant } from "$lib/components/floating/toast-events";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    /** 支援與 `MarkupText` 相同的輕量 markup 語法 */
    message: string;
    /** 通知類型 */
    variant: ToastVariant;
    /** 通知的進度，`undefined` 表示非進度類型 */
    progress?: number;
    /** 提供則顯示關閉按鈕 */
    ondismiss?: () => void;
    /** 關閉按鈕的 aria label */
    dismissLabel: string;
    /** 是否恆定顯示關閉按鈕；省略則只在 hover 與 focus-within 才顯示 */
    alwaysShowClose?: boolean;
  }

  const { message, variant, progress, ondismiss, dismissLabel, alwaysShowClose, ...rest }: Props = $props();
</script>

<div class="container" {...rest}>
  <span class="icon {variant}">
    {#if variant === "success"}
      <IconCheckFilled size={18} />
    {:else if variant === "error"}
      <IconAlertCircleFilled size={18} />
    {:else}
      <IconInfoCircleFilled size={18} />
    {/if}
  </span>

  <div class="body">
    <MarkupText markup={message} style="font: var(--font-body2); margin: 0; word-break: break-word;" />
    {#if progress !== undefined}
      <LinearProgress value={progress * 100} size="sm" color="var(--color-text)" />
    {/if}
  </div>

  {#if ondismiss}
    <span class="close" class:always={alwaysShowClose}>
      <Button variant="ghost" padding="icon" aria-label={dismissLabel} onclick={ondismiss}>
        <IconX size={14} />
      </Button>
    </span>
  {/if}
</div>

<style>
  .container {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.75rem 0.75rem 0.75rem 0.875rem;
    background-color: var(--color-bg-card);
    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 1.5);
  }

  .icon {
    flex-shrink: 0;
    display: inline-flex;
    margin-top: 1px;
    opacity: 0.8;

    &.success {
      color: var(--color-success);
    }
    &.error {
      color: var(--color-error);
    }
    &.info {
      color: var(--color-text);
    }
  }

  .body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .close {
    flex-shrink: 0;
    margin: -0.25rem -0.25rem -0.25rem 0;
    opacity: 0;
    transition: opacity 0.15s ease;

    &.always {
      opacity: 1;
    }

    .container:hover &,
    .container:focus-within & {
      opacity: 1;
    }
  }
</style>
