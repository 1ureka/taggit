<script lang="ts">
  import { IconAlertCircleFilled } from "$lib/icons";
  import TextInput from "$lib/components/inputs/TextInput.svelte";
  import Rating from "$lib/components/inputs/Rating.svelte";
  import TagInput from "$lib/widgets/TagInput.svelte";
  import { stripExt, problemOf, type Draft } from "../logic/draft";

  let { file, draft = $bindable() }: { file: string; draft: Draft } = $props();

  const id = $props.id();
  const problem = $derived(problemOf(draft));
</script>

<div>
  <div class="field-name">
    <TextInput label="名稱" placeholder={stripExt(file)} bind:value={draft.name} aria-describedby="{id}-name-hint" />
    <span id="{id}-name-hint">留空則沿用去除副檔名的檔名</span>
  </div>

  <div class="field-rating">
    <span>評等</span>
    <Rating bind:value={draft.rating} />
  </div>

  <div class="field-tags">
    <TagInput bind:tags={draft.tags} label="標籤" />
  </div>

  {#if problem}
    <span class="problem"><IconAlertCircleFilled size={14} />{problem}</span>
  {/if}
</div>

<style>
  div:has(> .field-name) {
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    gap: 1rem;
  }

  div:has(> .field-name) > div {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .field-name > span {
    font: var(--font-caption);
    color: var(--color-text-muted);
  }

  .field-rating > span {
    font: var(--font-input);
    color: var(--color-text-muted);
  }

  span.problem {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font: var(--font-caption);
    color: var(--color-warning);
  }
</style>
