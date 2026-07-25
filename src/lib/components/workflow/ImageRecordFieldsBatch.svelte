<script lang="ts">
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";
  import Radio from "$lib/components/inputs/Radio.svelte";
  import Rating from "$lib/components/inputs/Rating.svelte";
  import TagInput from "$lib/components/widgets/TagInput.svelte";

  type Field = "revert" | "rating" | "addTags" | "removeTags";

  type Props = {
    /** 目前的欄位勾選狀態 */
    checked: Set<Field>;
    /** 退回標記欄位 */
    revert: "mark" | "unmark";
    /** 是否鎖定除了標記退回以外的其他欄位 */
    locked: boolean;
    /** 評等覆蓋欄位 */
    rating: number;
    /** 新增標籤欄位 */
    addTags: string[];
    /** 移除標籤欄位 */
    removeTags: string[];
    /** 當前篩選結果的切片條件 */
    facetScope: string;
    /** 欄位勾選事件 */
    oncheck: (field: Field, checked: boolean) => void;
    /** 標記退回改變事件 */
    onmark: (type: "mark" | "unmark") => void;
    /** 評等欄位改變事件 */
    onrating: (v: number) => void;
    /** 標籤改變事件 */
    onchangetags: (type: "add" | "remove", tags: string[]) => void;
  };

  const {
    checked,
    revert,
    locked,
    rating,
    addTags,
    removeTags,
    facetScope,
    oncheck,
    onmark,
    onrating,
    onchangetags,
  }: Props = $props();

  const disabledBy = (v: boolean) => (v ? "disabled" : "default");
</script>

<div class="container">
  <p>從下方勾選所需調整的項目，並套用到目前選取的所有圖片。</p>

  <div class="field">
    <Checkbox checked={checked.has("revert")} label="退回標記" onchange={(checked) => oncheck("revert", checked)} />
    <div role="radiogroup" aria-label="退回方向">
      <Radio
        name="revert-direction"
        variant="error"
        label="標記退回"
        checked={revert === "mark"}
        status={disabledBy(!checked.has("revert"))}
        onchange={(checked) => checked && onmark("mark")}
      />
      <Radio
        name="revert-direction"
        label="取消退回"
        checked={revert === "unmark"}
        status={disabledBy(!checked.has("revert"))}
        onchange={(checked) => checked && onmark("unmark")}
      />
    </div>
  </div>

  <div class="field">
    <Checkbox
      checked={checked.has("rating")}
      label="覆蓋評等"
      status={disabledBy(locked)}
      onchange={(checked) => oncheck("rating", checked)}
    />
    <div>
      <Rating value={rating} status={disabledBy(locked || !checked.has("rating"))} onchange={onrating} />
    </div>
  </div>

  <div class="field">
    <Checkbox
      checked={checked.has("addTags")}
      label="增加標籤"
      status={disabledBy(locked)}
      onchange={(checked) => oncheck("addTags", checked)}
    />
    <div class:disabled={locked || !checked.has("addTags")}>
      <TagInput
        tags={addTags}
        label="增加標籤"
        labelHidden
        placeholder="將標籤加入到選擇的圖片中"
        onchange={(tags) => onchangetags("add", tags)}
      />
    </div>
  </div>

  <div class="field">
    <Checkbox
      checked={checked.has("removeTags")}
      label="去除標籤"
      status={disabledBy(locked)}
      onchange={(checked) => oncheck("removeTags", checked)}
    />
    <div class:disabled={locked || !checked.has("removeTags")}>
      <TagInput
        tags={removeTags}
        label="去除標籤"
        labelHidden
        placeholder="將標籤從選擇的圖片中移除"
        scope={facetScope}
        onchange={(tags) => onchangetags("remove", tags)}
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

  div.field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  div.field > div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-left: 1.75rem;
  }

  div.field > div.disabled {
    opacity: 0.5;
    pointer-events: none;
  }
</style>
