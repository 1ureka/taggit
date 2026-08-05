<script lang="ts">
  import type { Suggestion } from "../logic/page-data.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import { getScheduleContext } from "../logic/schedule.svelte";

  let { suggestion: s }: { suggestion: Suggestion } = $props();

  const schedule = getScheduleContext();

  const scheduledName = $derived(schedule.scheduledNameOf(s));

  const buttonProps = {
    style: "font: var(--font-body2); padding: 0.25rem 0.5rem;",
    variant: "ghost",
    padding: "sm",
  } as const;
</script>

<footer class:scheduled={scheduledName !== undefined}>
  {#if scheduledName !== undefined}
    {@const target = scheduledName}
    <Button onclick={() => schedule.handleUndo(target)} {...buttonProps}>取消排程</Button>
  {:else if s.kind === "similar" || s.kind === "cooccur"}
    {@const a = s.a}
    {@const b = s.b}
    {@const both = s.both}
    <Button onclick={() => schedule.handleScheduleMerge(a, b, both)} {...buttonProps}>
      合併 →「{b.name}」
    </Button>
    <Button onclick={() => schedule.handleScheduleMerge(b, a, both)} {...buttonProps}>
      合併 →「{a.name}」
    </Button>
  {:else if s.kind === "rare"}
    {@const tag = s.tag}
    {@const topCo = s.topCo}
    {#if topCo}
      {@const co = topCo}
      <Button onclick={() => schedule.handleScheduleMerge(tag, co.tag, co.both)} {...buttonProps}>
        合併 →「{co.tag.name}」
      </Button>
    {/if}
    <Button onclick={() => schedule.handleScheduleHide(tag)} {...buttonProps}>隱藏</Button>
    <Button onclick={() => schedule.handleScheduleDelete(tag)} {...buttonProps} variant="destructive">刪除</Button>
  {:else}
    {@const tag = s.tag}
    <Button onclick={() => schedule.handleScheduleDelete(tag)} {...buttonProps} variant="destructive">
      刪除元資料
    </Button>
  {/if}
</footer>

<style>
  footer {
    display: flex;
    flex-wrap: nowrap;
    flex-shrink: 0;
    gap: 0.25rem;
    border-top: var(--border-style);
    background-color: var(--color-bg);
    padding: 0.25rem 0.75rem 0rem 0.75rem;
    overflow-x: scroll;
  }

  footer.scheduled {
    border-color: hsl(from var(--color-success) h s l / 0.75);
    background-color: hsl(from var(--color-success) h s l / 0.1);
  }
</style>
