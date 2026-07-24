<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { IconAlertCircleFilled, IconInfoCircleFilled, IconAlertTriangleFilled } from "$lib/icons";

  type Props = {
    /** 警告的類型 */
    status: "info" | "error" | "warning";
    /** 警告的訊息 */
    message: string;
  } & HTMLAttributes<HTMLParagraphElement>;

  const { status, message, ...rest }: Props = $props();

  const Icon = $derived.by(() => {
    if (status === "info") return IconInfoCircleFilled;
    if (status === "error") return IconAlertCircleFilled;
    return IconAlertTriangleFilled;
  });
</script>

<p class={{ [status]: true }} {...rest}>
  <Icon size={18} />
  {message}
</p>

<style>
  p {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font: var(--font-body2);
    border: var(--border-style);
    border-radius: var(--border-radius);
    padding: 0px 0.75rem;
    height: 2.5rem;
  }

  p.info {
    --color-alert: var(--color-accent);
  }

  p.error {
    --color-alert: var(--color-error);
  }

  p.warning {
    --color-alert: var(--color-warning);
  }

  p {
    color: var(--color-alert);
    background-color: hsl(from var(--color-alert) h s l / 0.1);
    border-color: hsl(from var(--color-alert) h s l / 0.5);
  }
</style>
