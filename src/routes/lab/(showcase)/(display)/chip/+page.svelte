<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import Chip from "$lib/components/display/Chip.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import { IconAlertTriangleFilled } from "$lib/icons";
  import { addToast } from "$lib/components/floating/toast-events";

  // --- Clickable ---

  function handleClickableChip(label: string) {
    addToast({ message: `Clicked "${label}"` });
  }

  // --- Removable ---

  const initialDefaultTags = ["golden-hour", "portrait", "long-exposure"];
  const initialOutlinedTags = ["sunset", "macro"];

  let defaultTags = $state([...initialDefaultTags]);
  let outlinedTags = $state([...initialOutlinedTags]);

  function removeDefaultTag(tag: string) {
    defaultTags = defaultTags.filter((t) => t !== tag);
  }

  function removeOutlinedTag(tag: string) {
    outlinedTags = outlinedTags.filter((t) => t !== tag);
  }

  function resetRemovable() {
    defaultTags = [...initialDefaultTags];
    outlinedTags = [...initialOutlinedTags];
  }

  // --- Overflow row with mask-image ---

  const manyTags = [
    "street",
    "long-exposure",
    "black-and-white",
    "golden-hour",
    "architecture",
    "minimal",
    "reflection",
    "silhouette",
    "texture",
    "abstract",
    "night-photo",
    "wide-angle",
  ];

  // --- Diff add/remove ---

  const addedTags = ["forest", "wildlife"];
  const removedTags = ["city", "indoor"];

  // --- Draggable between zones, with count & hidden badge ---

  type PoolTag = { name: string; count: number; hidden: boolean };
  type Zone = "pool" | "selected";

  let pool = $state<PoolTag[]>([
    { name: "beach", count: 42, hidden: false },
    { name: "night-photo", count: 3, hidden: true },
    { name: "portrait", count: 118, hidden: false },
    { name: "underexposed", count: 1, hidden: true },
  ]);
  let selected = $state<PoolTag[]>([]);

  let draggingName = $state<string | null>(null);
  let draggingFrom = $state<Zone | null>(null);
  let dragOverZone = $state<Zone | null>(null);

  function handleDragStart(name: string, from: Zone) {
    draggingName = name;
    draggingFrom = from;
  }

  function handleDragEnd() {
    draggingName = null;
    draggingFrom = null;
    dragOverZone = null;
  }

  function allowDrop(e: DragEvent, zone: Zone) {
    e.preventDefault();
    dragOverZone = zone;
  }

  function handleDragLeave(zone: Zone) {
    if (dragOverZone === zone) dragOverZone = null;
  }

  function handleDrop(e: DragEvent, zone: Zone) {
    e.preventDefault();
    dragOverZone = null;
    if (!draggingName || draggingFrom === zone) return;
    const source = draggingFrom === "pool" ? pool : selected;
    const target = zone === "pool" ? pool : selected;
    const index = source.findIndex((t) => t.name === draggingName);
    if (index === -1) return;
    const [item] = source.splice(index, 1);
    target.push(item);
    draggingName = null;
    draggingFrom = null;
  }
</script>

{#snippet dragChip(tag: PoolTag, zone: Zone)}
  <Chip
    draggable="true"
    ondragstart={() => handleDragStart(tag.name, zone)}
    ondragend={handleDragEnd}
    style="cursor: grab;"
  >
    <span>{tag.name}</span>
    <span class="meta">
      {#if tag.hidden}
        <IconAlertTriangleFilled size="0.75rem" />
      {/if}
      <span class="count">{tag.count}</span>
    </span>
  </Chip>
{/snippet}

<svelte:head>
  <title>Chip</title>
</svelte:head>

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      <h4>Variants & status</h4>
      <div class="row">
        <Chip variant="filled">default</Chip>
        <Chip variant="outlined">outlined</Chip>
        <Chip variant="filled" status="disabled">disabled</Chip>
        <Chip variant="outlined" status="disabled">disabled</Chip>
      </div>

      <h4>Clickable</h4>
      <div class="row">
        <Chip variant="filled" onclick={() => handleClickableChip("filled")}>filled</Chip>
        <Chip variant="outlined" onclick={() => handleClickableChip("outlined")}>outlined</Chip>
      </div>

      <div>
        <h4>Removable</h4>
        <Button variant="ghost" padding="sm" onclick={resetRemovable}>Reset</Button>
      </div>
      <div class="row">
        {#each defaultTags as tag (tag)}
          <Chip removable onclick={() => removeDefaultTag(tag)}>{tag}</Chip>
        {/each}
        {#each outlinedTags as tag (tag)}
          <Chip variant="outlined" removable onclick={() => removeOutlinedTag(tag)}>{tag}</Chip>
        {/each}
        {#if defaultTags.length === 0 && outlinedTags.length === 0}
          <span class="hint">No tags selected</span>
        {/if}
      </div>

      <h4>Overflow row, masked with CSS</h4>
      <div class="mask-row">
        {#each manyTags as tag}
          <Chip style="flex-shrink: 0;">{tag}</Chip>
        {/each}
      </div>

      <h4>Diff semantics</h4>
      <div class="row">
        {#each addedTags as tag}
          <Chip
            style="color: var(--color-success); border-color: hsl(from var(--color-success) h s l / 0.5); background: hsl(from var(--color-success) h s l / 0.08);"
          >
            <span class="sign">+</span>{tag}
          </Chip>
        {/each}
        {#each removedTags as tag}
          <Chip
            style="color: var(--color-error); border-color: hsl(from var(--color-error) h s l / 0.5); background: hsl(from var(--color-error) h s l / 0.08);"
          >
            <span class="sign">−</span>{tag}
          </Chip>
        {/each}
      </div>

      <h4>Draggable between zones, with count & hidden badge</h4>
      <div class="drag-zones">
        <div
          class="zone"
          class:dropping={dragOverZone === "pool"}
          role="list"
          aria-label="Available tags"
          ondragover={(e) => allowDrop(e, "pool")}
          ondragleave={() => handleDragLeave("pool")}
          ondrop={(e) => handleDrop(e, "pool")}
        >
          <p class="zone-label">Available</p>
          <div class="zone-chips">
            {#each pool as tag (tag.name)}
              {@render dragChip(tag, "pool")}
            {:else}
              <span class="hint">Drag tags here</span>
            {/each}
          </div>
        </div>

        <div
          class="zone"
          class:dropping={dragOverZone === "selected"}
          role="list"
          aria-label="Selected tags"
          ondragover={(e) => allowDrop(e, "selected")}
          ondragleave={() => handleDragLeave("selected")}
          ondrop={(e) => handleDrop(e, "selected")}
        >
          <p class="zone-label">Selected</p>
          <div class="zone-chips">
            {#each selected as tag (tag.name)}
              {@render dragChip(tag, "selected")}
            {:else}
              <span class="hint">Drag tags here</span>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </PreviewCanvas>
{/snippet}

<PreviewLayout
  component="Chip"
  label="Token shell, composed the rest"
  guide="The base chip stays plain on purpose — everything below (removable, truncated, diff-colored, draggable) is built around it."
  {preview}
/>

<style>
  .container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    max-width: 30rem;
  }

  h4 {
    font: var(--font-body1);
    color: var(--color-text-muted);

    &:not(:first-child) {
      margin-top: 0.5rem;
    }
  }

  div.container > div:has(> h4) {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .hint {
    font: var(--font-caption);
    color: var(--color-text-muted);
  }

  .sign {
    font-family: var(--font-family-mono);
  }

  .meta {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--color-text-muted);
  }

  .count {
    font: var(--font-caption);
    font-family: var(--font-family-mono);
  }

  .mask-row {
    display: flex;
    flex-wrap: nowrap;
    gap: 0.375rem;
    max-width: 100%;
    overflow: hidden;
  }

  @supports (mask-image: linear-gradient(to right, black, transparent)) {
    .mask-row {
      mask-image: linear-gradient(to right, black calc(100% - 3rem), transparent 100%);
    }
  }

  .drag-zones {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .zone {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-height: 5rem;
    padding: 0.625rem;
    border: var(--border-style);
    border-style: dashed;
    border-radius: calc(var(--border-radius) * 1.5);
    transition: all 0.15s ease;
  }

  .zone.dropping {
    border-color: var(--color-info);
    background: var(--color-bg-hover);
  }

  .zone-label {
    font: var(--font-caption);
    color: var(--color-text-muted);
  }

  .zone-chips {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 0.375rem;
  }
</style>
