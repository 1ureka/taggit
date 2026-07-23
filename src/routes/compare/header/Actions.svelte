<script lang="ts">
  import { IconArrowsShuffle } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import Select from "$lib/components/inputs/Select.svelte";
  import RefreshButton from "$lib/components/toolbar/RefreshButton.svelte";

  import { getOperationsContext } from "../logic/operations.svelte";
  import { getPinnedContext } from "../logic/pinned.svelte";

  const operations = getOperationsContext();
  const pinned = getPinnedContext();

  const id = $props.id();
  const shuffleOptions = ["2", "3", "4", "6"];

  let shuffleKey = $state<string | undefined>("2");
</script>

{#snippet shuffleOption(key: string)}
  <span style="display: block; width: 100%; text-align: center;">{`抽 ${key} 張`}</span>
{/snippet}

<div>
  <RefreshButton pending={operations.pending} onrefresh={operations.handleRefresh} />

  <Select
    id="{id}-shuffle-count"
    aria-label="抽選張數"
    options={shuffleOptions}
    option={shuffleOption}
    bind:value={shuffleKey}
  />

  <Button variant="primary" onclick={() => pinned.handleShuffle(Number(shuffleKey ?? "2"))}>
    <IconArrowsShuffle size={16} />
    <span>隨機抽選</span>
  </Button>
</div>

<style>
  div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>
