<script lang="ts">
  import Popover from "$lib/components/floating/Popover.svelte";
  import { getPickContext } from "../logic/pick.svelte";

  const pick = getPickContext();

  /** 跟著游標移動的 1×1 錨點，讓 Popover 有一個可定位的參照元素 */
  let anchorEl = $state<HTMLSpanElement>();
</script>

<span bind:this={anchorEl} aria-hidden="true" style:left="{pick.cursor.x}px" style:top="{pick.cursor.y}px"></span>

<Popover
  open={pick.label !== null}
  reference={anchorEl}
  placement="bottom"
  offset={10}
  arrow
  arrowColor="var(--color-text)"
>
  <div aria-hidden="true">{pick.label}</div>
</Popover>

<style>
  span {
    position: fixed;
    width: 1px;
    height: 1px;
    pointer-events: none;
  }

  div {
    max-width: min(40ch, 60vw);
    padding: 0.25rem 0.5rem;
    font: var(--font-body2);
    font-weight: 600;
    border-radius: var(--border-radius);
    background-color: var(--color-text);
    color: var(--color-bg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
