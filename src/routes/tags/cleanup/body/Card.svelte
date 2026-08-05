<script lang="ts">
  import type { Suggestion } from "../logic/page-data.svelte";
  import { getScheduleContext } from "../logic/schedule.svelte";
  import CardSamples from "./CardSamples.svelte";
  import CardHeader from "./CardHeader.svelte";
  import CardFooter from "./CardFooter.svelte";
  import CardBody from "./CardBody.svelte";

  let { suggestion: s }: { suggestion: Suggestion } = $props();

  const schedule = getScheduleContext();

  const scheduled = $derived(schedule.scheduledNameOf(s) !== undefined);
</script>

<article class:scheduled>
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
