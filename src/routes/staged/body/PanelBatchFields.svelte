<script lang="ts">
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";
  import Rating from "$lib/components/inputs/Rating.svelte";
  import TagInput from "$lib/components/widgets/TagInput.svelte";

  type Field = "rating" | "addTags" | "removeTags";

  type Props = {
    /** 目前的欄位勾選狀態 */
    checked: Set<Field>;
    /** 評等覆蓋欄位 */
    rating: number;
    /** 新增標籤欄位 */
    addTags: string[];
    /** 移除標籤欄位 */
    removeTags: string[];
    /** 欄位勾選事件 */
    oncheck: (field: Field, checked: boolean) => void;
    /** 評等欄位改變事件 */
    onrating: (v: number) => void;
    /** 標籤改變事件 */
    onchangetags: (type: "add" | "remove", tags: string[]) => void;
  };

  const { checked, rating, addTags, removeTags, oncheck, onrating, onchangetags }: Props = $props();

  const disabledBy = (v: boolean) => (v ? "disabled" : "default");
</script>

<div class="container">
  <p>從下方勾選所需調整的項目，並套用到目前選取的所有圖片。</p>

  <div class="field">
    <Checkbox checked={checked.has("rating")} label="覆蓋評等" onchange={(checked) => oncheck("rating", checked)} />
    <div>
      <Rating value={rating} status={disabledBy(!checked.has("rating"))} onchange={onrating} />
    </div>
  </div>

  <div class="field">
    <Checkbox checked={checked.has("addTags")} label="增加標籤" onchange={(checked) => oncheck("addTags", checked)} />
    <div class:disabled={!checked.has("addTags")}>
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
      onchange={(checked) => oncheck("removeTags", checked)}
    />
    <div class:disabled={!checked.has("removeTags")}>
      <TagInput
        tags={removeTags}
        label="去除標籤"
        labelHidden
        placeholder="將標籤從選擇的圖片中移除"
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
