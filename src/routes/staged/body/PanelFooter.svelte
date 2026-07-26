<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";

  type BatchProps = {
    variant: "batch";
    /** 是否可套用 */
    applicable: boolean;
    /** 預期會套用的總數 */
    count: number;
    /** 套用點擊事件 */
    onapply: () => void;
  };

  type SingleProps = {
    variant: "single";
    /** 是否有一次刪除正在進行中 */
    pending: boolean;
    /** 清空草稿事件 */
    ondiscard: () => void;
    /** 永久刪除事件 */
    ondelete: () => void;
  };

  const props: BatchProps | SingleProps = $props();
</script>

<footer>
  {#if props.variant === "batch"}
    {@const status = props.applicable ? "default" : "disabled"}
    <Button variant="primary" style="flex: 1;" {status} onclick={props.onapply}>
      套用
      {#if props.count > 0}<div><span>{props.count}</span></div>{/if}
    </Button>
  {:else if props.variant === "single"}
    {@const status = props.pending ? "disabled" : "default"}
    <Button variant="outlined" style="flex: 1;" {status} onclick={props.ondiscard}>清空草稿</Button>
    <Button
      variant="destructive"
      style="flex: 1;"
      status={props.pending ? "pending" : "default"}
      onclick={props.ondelete}
    >
      刪除此張
    </Button>
  {/if}
</footer>

<style>
  footer {
    display: flex;
    padding: 0.75rem;
    gap: 0.5rem;
    margin-top: auto;
  }

  div {
    display: inline-flex;
    align-items: center;
    height: 0px;
    overflow: visible;
  }

  div > span {
    padding: 0 0.25rem;
    font: var(--font-caption);
    font-family: var(--font-family-mono);
  }
</style>
