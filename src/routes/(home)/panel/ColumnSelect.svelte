<script lang="ts">
  import Select from "$lib/components/inputs/Select.svelte";

  let { columns = $bindable() }: { columns: number } = $props();
  const id = $props.id();

  const columnOptions = ["1", "2", "3", "4", "5", "6"];
  let columnsKey = $derived(String(columns));
</script>

{#snippet columnsOption(key: string)}{key} 欄{/snippet}

<div>
  <span>圖片牆欄位</span>
  <Select
    id="{id}-columns"
    aria-label="圖片牆欄位"
    options={columnOptions}
    option={columnsOption}
    bind:value={columnsKey}
    onchange={(key) => (columns = Number(key))}
    style="width: 100%"
  />
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.75rem;
    border-bottom: var(--border-style);
  }

  div > span {
    font: var(--font-body2);
    font-weight: 500;
    color: var(--color-text-muted);
  }
</style>
