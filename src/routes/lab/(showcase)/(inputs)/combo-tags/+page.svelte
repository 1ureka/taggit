<script lang="ts">
  import { scale } from "svelte/transition";
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";

  import { IconAlertTriangleFilled } from "$lib/icons";
  import Combo from "$lib/components/inputs/Combo.svelte";
  import Chip from "$lib/components/display/Chip.svelte";
  import CircularProgress from "$lib/components/display/CircularProgress.svelte";

  // ---

  type Tag = { name: string; count: number; hidden: boolean };

  const longTag = "This is a very long tag that should be truncated with an ellipsis when it overflows the container";

  // 模擬後端資料源
  const allTags: Tag[] = [
    { name: "street", count: 84, hidden: false },
    { name: "long-exposure", count: 12, hidden: false },
    { name: "black-and-white", count: 57, hidden: false },
    { name: "golden-hour", count: 133, hidden: false },
    { name: "architecture", count: 41, hidden: false },
    { name: longTag, count: 50, hidden: false },
    { name: "minimal", count: 29, hidden: false },
    { name: "reflection", count: 8, hidden: true },
    { name: "silhouette", count: 19, hidden: false },
    { name: "texture", count: 6, hidden: true },
    { name: "abstract", count: 23, hidden: false },
    { name: "night-photo", count: 3, hidden: true },
    { name: "wide-angle", count: 47, hidden: false },
    { name: "portrait", count: 118, hidden: false },
    { name: "macro", count: 15, hidden: false },
  ];

  // ---

  let tags = $state<string[]>(["golden-hour", longTag]);
  let value = $state("");

  let rawMatches = $state<Tag[]>(allTags); // 這次向後端查詢回來的結果；已選標籤的排除是前端做的 derived
  const tagIndex = $derived(new Map(rawMatches.map((t) => [t.name, t]))); // 只從這次查詢結果建立，貼近實際後端回應
  const candidates = $derived(rawMatches.filter((t) => !tags.includes(t.name)));
  const candidateKeys = $derived(candidates.map((t) => t.name));

  let fetching = $state(false);
  let showSpinner = $state(false);

  const listboxExtra = $derived(
    showSpinner ? loadingRow : !fetching && value.trim() && candidates.length === 0 ? noMatchesRow : undefined,
  );

  // ---

  let fetchTimer: ReturnType<typeof setTimeout>;
  let spinnerTimer: ReturnType<typeof setTimeout>;

  $effect(() => {
    return () => {
      clearTimeout(fetchTimer);
      clearTimeout(spinnerTimer);
    };
  });

  function runQuery(query: string) {
    fetching = true;
    clearTimeout(spinnerTimer);
    spinnerTimer = setTimeout(() => {
      if (fetching) showSpinner = true;
    }, 200);

    clearTimeout(fetchTimer);
    fetchTimer = setTimeout(() => {
      const q = query.trim().toLowerCase();
      rawMatches = q ? allTags.filter((t) => t.name.toLowerCase().includes(q)) : allTags;
      fetching = false;
      showSpinner = false;
    }, 700);
  }

  // ---

  function commitTags(raw: string) {
    // 逗號分隔一次輸入多個標籤
    const parts = raw
      .split(/[,，]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const unique = Array.from(new Set(parts)).filter((name) => !tags.includes(name));
    if (unique.length > 0) tags = [...tags, ...unique];
    value = "";
  }

  function removeTag(name: string) {
    tags = tags.filter((t) => t !== name);
  }

  function handleKeydown(e: KeyboardEvent) {
    // 輸入框清空時按 Backspace 可清掉最後一個標籤
    if (e.key === "Backspace" && !value && tags.length > 0) {
      tags = tags.slice(0, -1);
    }
  }
</script>

<svelte:head>
  <title>Combo + Chip: Tags</title>
</svelte:head>

{#snippet loadingRow()}
  <span class="spinner"><CircularProgress size="0.875rem" /></span>
  <span>Searching…</span>
{/snippet}

{#snippet noMatchesRow()}
  <span>No matches for “{value.trim()}”</span>
{/snippet}

{#snippet committedTags()}
  <div class="tags">
    {#each tags as tag (tag)}
      <div in:scale={{ duration: 150, start: 0.9 }} out:scale={{ duration: 150, start: 0.9 }}>
        <Chip removable onclick={() => removeTag(tag)}>
          <span class="ellipsis">{tag}</span>
        </Chip>
      </div>
    {/each}
  </div>
{/snippet}

{#snippet tagInput()}
  <Combo
    label="Tags"
    labelHidden
    bind:value
    candidates={candidateKeys}
    oninput={() => runQuery(value)}
    onchange={commitTags}
    onkeydown={handleKeydown}
    {listboxExtra}
    placeholder="Add a tag…"
    style="width: 100%"
  >
    {#snippet candidate(key, active)}
      {@const meta = tagIndex.get(key)}
      <span class="option ellipsis" class:accent={active}>{key}</span>
      <span class="option meta">
        {#if meta?.hidden}<IconAlertTriangleFilled size="0.75rem" />{/if}
        <span class="option count">{meta?.count}</span>
      </span>
    {/snippet}
  </Combo>
{/snippet}

{#snippet readout()}
  <span class="readout">
    Comma-separate to add several at once, e.g. "macro, abstract". Backspace on an empty input drops the last tag.
  </span>
{/snippet}

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      {#if tags.length > 0}
        {@render committedTags()}
      {/if}
      {@render tagInput()}
      {@render readout()}
    </div>
  </PreviewCanvas>
{/snippet}

<PreviewLayout
  component="Combo + Chip"
  label="Tags input, composed not built-in"
  guide="No `mode=tags` on `Combo` — the caller pushes onto its own `tags` array in `onchange` and clears the input. Candidates are re-queried on every keystroke like a real search endpoint, already-selected tags are filtered out client-side, and a listbox row covers both the loading and no-results states."
  {preview}
/>

<style>
  .container {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    width: min(24rem, 100%);
  }

  div.tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;

    & > div {
      max-width: 100%;
    }
  }

  span.spinner {
    display: flex;
    flex-shrink: 0;
  }

  span.option {
    &.ellipsis {
      flex: 1;
    }

    &.accent {
      color: var(--color-accent);
    }

    &.meta {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      gap: 0.25rem;
      color: var(--color-text-muted);
    }

    &.count {
      font: var(--font-caption);
      font-family: var(--font-family-mono);
    }
  }

  span.readout {
    font: var(--font-caption);
    color: var(--color-text-muted);
  }
</style>
