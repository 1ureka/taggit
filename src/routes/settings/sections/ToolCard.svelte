<script lang="ts">
  import type { Component } from "svelte";
  import type { Snippet } from "svelte";
  import type { IconProps } from "$lib/types";

  type Props = {
    /** 工具圖示 */
    Icon: Component<IconProps>;
    /** 工具標題 */
    title: string;
    /** 工具說明文字 */
    description: string;
    /** 可選的額外內容（統計數字、進度條等） */
    children?: Snippet;
    /** 工具的操作按鈕列 */
    actions: Snippet;
    /** 資料性結果訊息（需要持續可見、驅動後續按鈕的資訊；操作成功/失敗走 toast） */
    result?: string;
  };

  let { Icon, title, description, children, actions, result }: Props = $props();
</script>

<article>
  <header>
    <Icon size={18} />
    <h3>{title}</h3>
  </header>

  <p>{description}</p>

  {#if children}
    <div class="content">
      {@render children()}
    </div>
  {/if}

  <footer>
    {@render actions()}
  </footer>

  {#if result}
    <output>{result}</output>
  {/if}
</article>

<style>
  article {
    padding: 1rem;
    background-color: var(--color-bg-card);
    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 2);

    &:not(:last-child) {
      margin-bottom: 0.75rem;
    }
  }

  header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    color: var(--color-text);

    & > h3 {
      font: var(--font-title2);
      font-weight: normal;
    }
  }

  article > p {
    color: var(--color-text-muted);
    font: var(--font-body2);
    margin-bottom: 1rem;
  }

  .content {
    margin-bottom: 1rem;
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  output {
    display: block;
    margin-top: 0.75rem;
    font: var(--font-body2);
    color: var(--color-text-muted);
  }
</style>
