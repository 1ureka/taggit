<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";

  const { disabled, onclick, count }: { disabled: boolean; onclick: () => void; count: number } = $props();
</script>

<Button variant="primary" status={disabled ? "disabled" : undefined} {onclick}>
  檢視變更
  {#if count > 0}
    <div><span>{count}</span></div>
  {/if}
</Button>

<style>
  div {
    display: inline-flex;
    align-items: center;
    height: 0px;
    overflow: visible;
  }

  span {
    padding: 0 0.25rem;
    font: var(--font-caption);
    font-family: var(--font-family-mono);
  }
</style>
