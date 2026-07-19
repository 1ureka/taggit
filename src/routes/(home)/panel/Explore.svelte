<script lang="ts">
  import ExploreHeader from "./ExploreHeader.svelte";
  import ExploreFields from "./ExploreFields.svelte";
  import ColumnSelect from "./ColumnSelect.svelte";
  import ExploreButtons from "./ExploreButtons.svelte";
</script>

<div>
  <ExploreHeader />
  <ExploreFields />
  <ColumnSelect />
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
</style>
