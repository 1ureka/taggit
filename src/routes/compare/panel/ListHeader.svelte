<script lang="ts">
  import { getPageDataContext } from "../logic/page-data.svelte";

  const pageData = getPageDataContext();
</script>

<header>
  <h2>圖庫列表</h2>
  <p>共 {pageData.value.total} 張</p>
</header>

<style>
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
