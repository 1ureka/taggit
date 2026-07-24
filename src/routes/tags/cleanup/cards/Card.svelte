<script lang="ts">
  import type { Suggestion } from "../logic/suggestions";
  import { getScheduleContext } from "../logic/schedule.svelte";
  import CardSamples from "./CardSamples.svelte";
  import CardHeader from "./CardHeader.svelte";
  import CardFooter from "./CardFooter.svelte";
  import CardBody from "./CardBody.svelte";

  let { suggestion: s }: { suggestion: Suggestion } = $props();

  const schedule = getScheduleContext();

  /** 這張卡片涉及的標籤名稱，用來判斷是否已有排入的操作 */
  const names = $derived(s.kind === "similar" || s.kind === "cooccur" ? [s.a.name, s.b.name] : [s.tag.name]);
  const scheduledName = $derived(names.find((n) => schedule.statusOf(n) !== null));
</script>

<article class:scheduled={scheduledName !== undefined}>
  <CardHeader suggestion={s} />
  <CardBody suggestion={s} />
  {#if s.kind !== "unused"}
    <CardSamples suggestion={s} />
  {/if}
  <CardFooter suggestion={s} />
</article>

<style>
  article {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-card);
    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 1.5);
    overflow: hidden;
  }

  article.scheduled {
    border-color: hsl(from var(--color-success) h s l / 0.75);
  }
</style>
