<script lang="ts">
  import type { Suggestion } from "../logic/suggestions";
  import Button from "$lib/components/actions/Button.svelte";
  import { getScheduleContext } from "../logic/schedule.svelte";

  let { suggestion: s }: { suggestion: Suggestion } = $props();

  const schedule = getScheduleContext();

  /** 這張卡片涉及的標籤名稱，用來判斷是否已有排入的操作 */
  const names = $derived(s.kind === "similar" || s.kind === "cooccur" ? [s.a.name, s.b.name] : [s.tag.name]);
  const scheduledName = $derived(names.find((n) => schedule.statusOf(n) !== null));

  const buttonProps = {
    style: "font: var(--font-body2); padding: 0.25rem 0.5rem;",
    variant: "ghost",
    padding: "sm",
  } as const;
</script>

<footer>
  {#if scheduledName !== undefined}
    {@const target = scheduledName}
    <Button onclick={() => schedule.handleUndo(target)} {...buttonProps}>取消排程</Button>
  {:else if s.kind === "similar" || s.kind === "cooccur"}
    {@const a = s.a}
    {@const b = s.b}
    {@const both = s.both}
    <Button onclick={() => schedule.handleScheduleMerge(a.name, b.name, a.count, b.count, both)} {...buttonProps}>
      合併 →「{b.name}」
    </Button>
    <Button onclick={() => schedule.handleScheduleMerge(b.name, a.name, b.count, a.count, both)} {...buttonProps}>
      合併 →「{a.name}」
    </Button>
  {:else if s.kind === "rare"}
    {@const tag = s.tag}
    {@const topCo = s.topCo}
    {#if topCo}
      {@const co = topCo}
      <Button
        onclick={() => schedule.handleScheduleMerge(tag.name, co.tag.name, tag.count, co.tag.count, co.both)}
        {...buttonProps}
      >
        合併 →「{co.tag.name}」
      </Button>
    {/if}
    <Button onclick={() => schedule.handleScheduleHide(tag.name, tag.count)} {...buttonProps}>隱藏</Button>
    <Button onclick={() => schedule.handleScheduleDelete(tag.name, tag.count)} {...buttonProps} variant="destructive">
      刪除
    </Button>
  {:else}
    {@const tag = s.tag}
    <Button onclick={() => schedule.handleScheduleDelete(tag.name, tag.count)} {...buttonProps} variant="destructive">
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
</style>
