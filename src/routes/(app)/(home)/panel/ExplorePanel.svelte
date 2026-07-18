<script lang="ts">
  import ExploreButtons from "./ExploreButtons.svelte";
  import ColumnSelect from "./ColumnSelect.svelte";
  import ExploreFields from "./ExploreFields.svelte";

  type Props = {
    /** 篩選結果總數 */
    total: number;
    /** 圖片牆欄數 */
    columns: number;
  };

  let { total, columns = $bindable() }: Props = $props();
</script>

<div>
  <header>
    <h2>探索與靈感</h2>
    <p>共 {total} 張</p>
  </header>

  <ExploreFields />
  <ColumnSelect bind:columns />
  <ExploreButtons />
</div>

<style>
  div {
    position: relative;
    overflow-y: auto;
    overflow-x: hidden;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0px 0.75rem;
    height: 2.5rem;
    min-height: 2.5rem;
    border-bottom: var(--border-style);
    border-right: var(--border-style);
    border-bottom-right-radius: 16px;
    background: var(--color-bg);
  }

  h2 {
    font: var(--font-body1);
    font-weight: normal;
  }

  p {
    font: var(--font-caption);
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
  }
</style>
