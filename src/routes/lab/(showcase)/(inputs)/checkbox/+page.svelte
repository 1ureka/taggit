<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";

  // --- Standalone toggle ---

  let sortByCount = $state(false);
  let onlyDirty = $state(true);

  // --- Field-include checklist ---

  type StampField = "name" | "rating" | "tags";
  let stampInclude = $state<Record<StampField, boolean>>({ name: true, rating: true, tags: false });

  // --- List row selection, no visible label ---

  const reviewRows = [
    { id: "r1", name: "sunset-01.jpg", problem: false },
    { id: "r2", name: "sunset-02.jpg", problem: true },
    { id: "r3", name: "sunset-03.jpg", problem: false },
  ];
  let reviewIncludes = $state(new Set(["r1", "r3"]));

  function toggleReview(id: string) {
    const next = new Set(reviewIncludes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    reviewIncludes = next;
  }

  // --- Header select-all with indeterminate ---

  const pageItems = [
    { id: "p1", name: "beach.jpg" },
    { id: "p2", name: "forest.jpg" },
    { id: "p3", name: "night.jpg" },
  ];
  let selected = $state(new Set(["p1"]));

  const allSelected = $derived(pageItems.every((r) => selected.has(r.id)));
  const someSelected = $derived(pageItems.some((r) => selected.has(r.id)));

  function toggleAll() {
    selected = allSelected ? new Set() : new Set(pageItems.map((r) => r.id));
  }

  function toggleRow(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }
</script>

<svelte:head>
  <title>Checkbox</title>
</svelte:head>

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      <h4>Sizes & status</h4>
      <div class="row">
        <Checkbox size="sm" label="sm" />
        <Checkbox size="sm" label="sm checked" checked />
        <Checkbox size="md" label="md" />
        <Checkbox size="md" label="md checked" checked />
        <Checkbox size="md" status="error" label="error" />
        <Checkbox size="md" status="error" label="error checked" checked />
        <Checkbox size="md" status="disabled" label="disabled" />
        <Checkbox size="md" status="disabled" label="disabled checked" checked />
      </div>

      <h4>Standalone toggle</h4>
      <div class="col">
        <Checkbox bind:checked={sortByCount} label="依使用數排序" />
        <Checkbox bind:checked={onlyDirty} label="只看已修改" />
      </div>

      <h4>Field-include checklist</h4>
      <div class="col">
        <Checkbox bind:checked={stampInclude.name} label={`名稱「sunset-01」`} />
        <Checkbox bind:checked={stampInclude.rating} label="評等 ★4" />
        <Checkbox bind:checked={stampInclude.tags} label="標籤 golden-hour、portrait" />
      </div>

      <h4>List row selection, no visible label</h4>
      <ul class="rows">
        {#each reviewRows as row (row.id)}
          <li class:excluded={!reviewIncludes.has(row.id)}>
            <Checkbox
              checked={reviewIncludes.has(row.id)}
              status={row.problem ? "disabled" : "default"}
              onchange={() => toggleReview(row.id)}
              aria-label={`包含 ${row.name}`}
            />
            <span class="thumb" aria-hidden="true"></span>
            <span class="name ellipsis">{row.name}</span>
            {#if row.problem}<span class="hint">有問題，無法包含</span>{/if}
          </li>
        {/each}
      </ul>

      <h4>Header select-all with indeterminate</h4>
      <div class="table">
        <div class="thead">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected && !allSelected}
            onchange={toggleAll}
            aria-label="全選本頁"
          />
          <span class="hint">{selected.size} / {pageItems.length} 已選取</span>
        </div>
        <ul class="rows">
          {#each pageItems as item (item.id)}
            <li>
              <Checkbox
                checked={selected.has(item.id)}
                onchange={() => toggleRow(item.id)}
                aria-label={`選取 ${item.name}`}
              />
              <span class="thumb" aria-hidden="true"></span>
              <span class="name ellipsis">{item.name}</span>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  </PreviewCanvas>
{/snippet}

<PreviewLayout
  component="Checkbox"
  label="One box, composed the rest"
  guide="A single checkbox, wired up five different ways — a plain toggle, a field-include list, unlabeled row selection, and a select-all header that derives its own `indeterminate` from its children. No group or select-all component needed."
  {preview}
/>

<style>
  .container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    max-width: 24rem;
  }

  h4 {
    font: var(--font-body1);
    color: var(--color-text-muted);

    &:not(:first-child) {
      margin-top: 0.5rem;
    }
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 1rem;
  }

  .col {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .hint {
    font: var(--font-caption);
    color: var(--color-text-muted);
  }

  /* --- */

  .rows {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    list-style: none;
  }

  .rows > li {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.375rem 0.5rem;
    border-radius: var(--border-radius);
    transition: opacity 0.15s ease;
  }

  .rows > li.excluded > * {
    opacity: 0.5;
  }

  .thumb {
    flex-shrink: 0;
    width: 1.75rem;
    height: 1.75rem;
    background: var(--color-bg-active);
    border-radius: calc(var(--border-radius) / 1.5);
  }

  .name {
    flex: 1;
    font: var(--font-body2);
  }

  /* --- */

  .table {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.625rem;
    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 1.5);
  }

  .thead {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0 0.5rem;
  }
</style>
