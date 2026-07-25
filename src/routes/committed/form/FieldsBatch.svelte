<script lang="ts">
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";
  import Radio from "$lib/components/inputs/Radio.svelte";
  import Rating from "$lib/components/inputs/Rating.svelte";
  import TagInput from "$lib/components/widgets/TagInput.svelte";

  import { getSelectionDraftContext } from "../logic/selection-draft.svelte";
  import { getQueryContext } from "../logic/query.svelte";

  const selectionDraft = getSelectionDraftContext();
  const query = getQueryContext();

  const revertOn = $derived(selectionDraft.checked.has("revert"));
  const ratingOn = $derived(selectionDraft.checked.has("rating"));
  const addTagsOn = $derived(selectionDraft.checked.has("addTags"));
  const removeTagsOn = $derived(selectionDraft.checked.has("removeTags"));
</script>

<div class="container">
  <p>從下方勾選所需調整的項目，並套用到目前選取的所有圖片。</p>

  <div class="field">
    <Checkbox
      checked={revertOn}
      label="退回標記"
      onchange={(checked) => selectionDraft.handleCheck("revert", checked)}
    />
    <div role="radiogroup" aria-label="退回方向">
      <Radio
        name="revert-direction"
        variant="error"
        label="標記退回"
        checked={selectionDraft.revertDirection === "mark"}
        status={!revertOn ? "disabled" : "default"}
        onchange={(checked) => checked && selectionDraft.handleRevertDirectionChange("mark")}
      />
      <Radio
        name="revert-direction"
        label="取消退回"
        checked={selectionDraft.revertDirection === "unmark"}
        status={!revertOn ? "disabled" : "default"}
        onchange={(checked) => checked && selectionDraft.handleRevertDirectionChange("unmark")}
      />
    </div>
  </div>

  <div class="field">
    <Checkbox
      checked={ratingOn}
      label="覆蓋評等"
      status={selectionDraft.locked ? "disabled" : "default"}
      onchange={(checked) => selectionDraft.handleCheck("rating", checked)}
    />
    <div>
      <Rating
        value={selectionDraft.ratingValue}
        status={selectionDraft.locked || !ratingOn ? "disabled" : "default"}
        onchange={selectionDraft.handleRatingChange}
      />
    </div>
  </div>

  <div class="field">
    <Checkbox
      checked={addTagsOn}
      label="增加標籤"
      status={selectionDraft.locked ? "disabled" : "default"}
      onchange={(checked) => selectionDraft.handleCheck("addTags", checked)}
    />
    <div class:disabled={selectionDraft.locked || !addTagsOn}>
      <TagInput
        tags={selectionDraft.addTagsValue}
        label="增加標籤"
        labelHidden
        placeholder="將標籤加入到選擇的圖片中"
        onchange={selectionDraft.handleAddTagsChange}
      />
    </div>
  </div>

  <div class="field">
    <Checkbox
      checked={removeTagsOn}
      label="去除標籤"
      status={selectionDraft.locked ? "disabled" : "default"}
      onchange={(checked) => selectionDraft.handleCheck("removeTags", checked)}
    />
    <div class:disabled={selectionDraft.locked || !removeTagsOn}>
      <TagInput
        tags={selectionDraft.removeTagsValue}
        label="去除標籤"
        labelHidden
        placeholder="將標籤從選擇的圖片中移除"
        scope={query.facetScope}
        onchange={selectionDraft.handleRemoveTagsChange}
      />
    </div>
  </div>
</div>

<style>
  div.container {
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    gap: 1.5rem;
  }

  div.container > p {
    font: var(--font-body2);
    color: var(--color-text-muted);
  }

  div.container > div.field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  div.container > div.field > div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-left: 1.75rem;
  }

  div.container > div.field > div.disabled {
    opacity: 0.5;
    pointer-events: none;
  }
</style>
