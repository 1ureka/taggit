<script lang="ts">
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { IconArrowsShuffle, IconReload } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import Select from "$lib/components/inputs/Select.svelte";

  type Props = {
    /** 全頁共用的操作鎖 */
    pending: boolean;
    /** 隨機抽選事件 */
    onshuffle: (count: number) => void;
    /** 重新整理事件 */
    onrefresh: () => void;
  };

  let { pending, onshuffle, onrefresh }: Props = $props();

  const id = $props.id();
  const shuffleOptions = ["2", "3", "4", "6"];

  let shuffleKey = $state<string | undefined>("2");
</script>

{#snippet shuffleOption(key: string)}
  <span style="display: block; width: 100%; text-align: center;"> {`抽 ${key} 張`}</span>
{/snippet}

<div>
  <Button
    variant="ghost"
    padding="icon"
    aria-label="重新整理"
    status={pending ? "pending" : undefined}
    onclick={onrefresh}
    {@attach tooltip({ content: "重新整理" })}
  >
    <IconReload size={16} />
  </Button>

  <Select
    id="{id}-shuffle-count"
    aria-label="抽選張數"
    options={shuffleOptions}
    option={shuffleOption}
    bind:value={shuffleKey}
  />

  <Button variant="primary" onclick={() => onshuffle(Number(shuffleKey ?? "2"))}>
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
