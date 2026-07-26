<script lang="ts">
  import { IconAlertCircleFilled } from "$lib/icons";
  import TextInput from "$lib/components/inputs/TextInput.svelte";
  import Rating from "$lib/components/inputs/Rating.svelte";
  import TagInput from "$lib/components/widgets/TagInput.svelte";

  type Props = {
    /** 名稱欄位值 */
    name: string;
    /** 評等欄位值 */
    rating: number;
    /** 標籤欄位值 */
    tags: string[];
    /** 整體表單內容是否有問題 */
    problem: string | null;
    /** 名稱改變事件 */
    onchangename: (v: string) => void;
    /** 評等改變事件 */
    onchangerating: (v: number) => void;
    /** 標籤改變事件 */
    onchangetags: (v: string[]) => void;
  };

  const { name, rating, tags, problem, onchangename, onchangerating, onchangetags }: Props = $props();

  const id = $props.id();
</script>

<div class="container">
  <div>
    <TextInput
      label="名稱"
      value={name}
      oninput={(e) => onchangename(e.currentTarget.value)}
      aria-describedby="{id}-name-hint"
    />
    <span id="{id}-name-hint">名稱不可留空</span>
  </div>

  <div>
    <span>評等</span>
    <Rating value={rating} onchange={onchangerating} />
  </div>

  <div>
    <TagInput {tags} label="標籤" onchange={onchangetags} />
  </div>

  {#if problem}
    <p><IconAlertCircleFilled size={14} />{problem}</p>
  {/if}
</div>

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
