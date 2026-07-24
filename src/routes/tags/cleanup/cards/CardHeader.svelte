<script lang="ts">
  import { IconX } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import type { Suggestion } from "../logic/suggestions";
  import { getScheduleContext } from "../logic/schedule.svelte";
  import { getFilterContext, KIND_LABELS } from "../logic/filter.svelte";
  import Chip from "$lib/components/display/Chip.svelte";

  let { suggestion: s }: { suggestion: Suggestion } = $props();

  const schedule = getScheduleContext();
  const filter = getFilterContext();

  /** 這張卡片涉及的標籤名稱，用來判斷是否已有排入的操作 */
  const names = $derived(s.kind === "similar" || s.kind === "cooccur" ? [s.a.name, s.b.name] : [s.tag.name]);
  const scheduledName = $derived(names.find((n) => schedule.statusOf(n) !== null));

  const chipBaseStyle =
    "font: var(--font-caption); color: var(--kind-color); border-color: hsl(from var(--kind-color) h s l / 0.5);";
  const chipStyles: Record<typeof s.kind | "scheduled", string> = {
    similar: "--kind-color: var(--color-info);",
    cooccur: "--kind-color: var(--color-success);",
    rare: "--kind-color: var(--color-warning);",
    unused: "--kind-color: var(--color-text-muted);",
    scheduled: "--kind-color: var(--color-success);",
  };

  const kind = $derived(scheduledName !== undefined ? "scheduled" : s.kind);
  const label = $derived(scheduledName !== undefined ? "已排入" : KIND_LABELS[s.kind]);
</script>

<header>
  <Chip variant="outlined" style={chipStyles[kind] + chipBaseStyle}>{label}</Chip>
  <Button variant="ghost" padding="icon" aria-label="忽略這個建議" onclick={() => filter.handleDismiss(s.id)}>
    <IconX size={13} />
  </Button>
</header>

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    gap: 0.5rem;
    padding: 0.25rem 0.25rem 0px 0.5rem;
  }
</style>
