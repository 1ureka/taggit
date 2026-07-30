<script lang="ts">
  import { getBoardContext } from "../logic/board.svelte";

  import ZoneContainer from "./ZoneContainer.svelte";
  import ZoneHeader from "./ZoneHeader.svelte";
  import ZoneBodyCreate from "./ZoneBodyCreate.svelte";
  import ZoneBodyGroup from "./ZoneBodyGroup.svelte";
  import ZoneBodyDelete from "./ZoneBodyDelete.svelte";
  import ZoneBodyHidden from "./ZoneBodyHidden.svelte";

  const board = getBoardContext();

  // 每個區的成員在這裡取一次後往下傳，避免子元件各自回頭去 board 撈同一份清單
  // TODO: 沒必要吧，撈清單又沒計算
  const deleteTags = $derived(board.deleteZone.tags);
  const hiddenTags = $derived(board.hiddenZone.tags);
</script>

<aside>
  <ZoneContainer
    target={{ kind: "new-group" }}
    aria-label="新合併區"
    style="align-items: center; padding: 1rem 0.75rem;"
  >
    <ZoneBodyCreate />
  </ZoneContainer>

  {#each board.groupZones as group (group.id)}
    {@const target = { kind: "group", id: group.id } as const}
    <ZoneContainer {target} aria-label={`合併區 ${group.canonical.trim()}`}>
      <ZoneHeader {target} tags={group.tags} label="合併或重新命名" />
      <ZoneBodyGroup {group} />
    </ZoneContainer>
  {/each}

  <ZoneContainer target={{ kind: "delete" }} aria-label="刪除區">
    <ZoneHeader target={{ kind: "delete" }} tags={deleteTags} label="刪除區" />
    <ZoneBodyDelete tags={deleteTags} />
  </ZoneContainer>

  <ZoneContainer target={{ kind: "hidden" }} aria-label="切換隱藏區">
    <ZoneHeader target={{ kind: "hidden" }} tags={hiddenTags} label="切換隱藏區" />
    <ZoneBodyHidden tags={hiddenTags} />
  </ZoneContainer>
</aside>

<style>
  aside {
    width: 23rem;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    min-height: 0;
    overflow-y: auto;
    padding: 0.75rem;
    border-left: var(--border-style);
    background: var(--color-bg-card);

    @media (max-width: 600px) {
      width: 16rem;
    }
  }
</style>
