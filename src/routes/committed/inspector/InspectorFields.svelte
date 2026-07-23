<script lang="ts">
  import { IconAlertCircleFilled } from "$lib/icons";
  import TextInput from "$lib/components/inputs/TextInput.svelte";
  import Rating from "$lib/components/inputs/Rating.svelte";
  import TagInput from "$lib/components/widgets/TagInput.svelte";
  import InspectorFieldsReadonly from "./InspectorFieldsReadonly.svelte";

  import { getPointersContext } from "../logic/pointers.svelte";
  import { getDraftsContext } from "../logic/drafts.svelte";
  import { getRevertMarkContext } from "../logic/reverts.svelte";

  const id = $props.id();

  const pointers = getPointersContext();
  const drafts = getDraftsContext();
  const reverts = getRevertMarkContext();

  const file = $derived(pointers.editing?.id ?? null);
  const revertSnapshot = $derived(file !== null ? reverts.draftOf(file) : undefined);
</script>

{#if file !== null}
  {#if revertSnapshot !== undefined}
    <InspectorFieldsReadonly {...revertSnapshot} />
  {:else}
    {@const view = drafts.viewOf(file)}
    {@const problem = drafts.problemOf(file)}
    <div class="container">
      <div>
        <TextInput
          label="名稱"
          value={view.name}
          oninput={(e: Event & { currentTarget: HTMLInputElement }) =>
            drafts.handleSetName([file], e.currentTarget.value)}
          aria-describedby="{id}-name-hint"
        />
        <span id="{id}-name-hint">名稱不可留空</span>
      </div>

      <div>
        <span>評等</span>
        <Rating value={view.rating} onchange={(v) => drafts.handleSetRating([file], v)} />
      </div>

      <div>
        <TagInput tags={view.tags} label="標籤" onchange={(tags) => drafts.handleSetTags([file], tags)} />
      </div>

      {#if problem}
        <p><IconAlertCircleFilled size={14} />{problem}</p>
      {/if}
    </div>
  {/if}
{/if}

<style>
  div.container {
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    gap: 1rem;
  }

  div.container > div {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  div.container > div > span[id] {
    font: var(--font-caption);
    color: var(--color-text-muted);
  }

  div.container > div > span:not([id]) {
    font: var(--font-input);
    color: var(--color-text-muted);
  }

  div.container > p {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font: var(--font-caption);
    color: var(--color-warning);
  }
</style>
