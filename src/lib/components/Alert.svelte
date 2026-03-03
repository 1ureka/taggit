<script lang="ts">
  let {
    type = "default",
    message,
  }: {
    type?: "info" | "error" | "default";
    message: string;
  } = $props();

  const styles: Record<string, { bg: string; border: string; icon: string }> = {
    info: { bg: "rgba(59,130,246,0.08)", border: "#3b82f6", icon: "ℹ️" },
    error: { bg: "rgba(239,68,68,0.08)", border: "var(--destructive)", icon: "❌" },
    default: { bg: "rgba(234,179,8,0.08)", border: "#eab308", icon: "⚠️" },
  };

  const s = $derived(styles[type] ?? styles.default);
</script>

<div
  class="alert slide-up"
  style="
    background: {s.bg};
    border: 1px solid {s.border};
    padding: 0.75rem 1rem;
    border-radius: var(--radius);
    font-size: 0.875rem;
    color: var(--text);
    line-height: 1.6;
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  "
>
  <span>{s.icon}</span>
  <span>{message}</span>
</div>
