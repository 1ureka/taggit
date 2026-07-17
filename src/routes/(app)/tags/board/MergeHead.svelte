<script lang="ts">
  import { IconTagPlus, IconX } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import TextInput from "$lib/components/inputs/TextInput.svelte";
  import GroupLink from "./GroupLink.svelte";

  type Props = {
    /** 目前選取中的標籤數量 */
    selected: number;
    /** 該組的所有標籤 */
    tags: string[];
    /** 該組啟用中的標籤 */
    active: string;
    /** 合併後的預估張數，尚未取得時為 undefined */
    count: number | undefined;
    /** 加入事件 */
    onadd: () => void;
    /** 解散事件 */
    ondissolve: () => void;
    /** 標籤輸入事件 */
    oninput: () => void;
  };

  let { selected, tags, active = $bindable(), count, onadd, ondissolve, oninput }: Props = $props();
</script>

<div class="head">
  <div>
    <div>
      <p>合併區</p>
      <GroupLink names={tags} />
    </div>

    <Button
      variant="ghost"
      padding="icon"
      aria-label="加入選取中的標籤"
      onclick={onadd}
      status={selected === 0 ? "disabled" : undefined}
      {@attach tooltip({ content: "加入選取中的標籤", placement: "left" })}
    >
      <IconTagPlus size={16} />
    </Button>
    <Button
      variant="ghost"
      padding="icon"
      aria-label="解散這一堆"
      onclick={ondissolve}
      {@attach tooltip({ content: "解散這一堆" })}
    >
      <IconX size={16} />
    </Button>
  </div>

  <div>
    <TextInput
      label="合併後的名稱"
      labelHidden
      maxlength={50}
      bind:value={active}
      {oninput}
      style="flex: 1; min-width: 0;"
      {@attach tooltip({ content: "合併後的名稱", placement: "left" })}
    />

    <span class="count">
      → {count ?? "…"} 張
    </span>
  </div>
</div>

<style>
  div.head {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    align-self: stretch;
    gap: 0.5rem;
  }

  div.head > div:nth-of-type(1) {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    & > div {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
    }
  }

  div.head > div:nth-of-type(2) {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 0.5rem;
  }

  span.count {
    flex-shrink: 0;
    font: var(--font-body2);
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
    white-space: nowrap;
  }
</style>
