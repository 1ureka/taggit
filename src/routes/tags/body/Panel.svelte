<script lang="ts">
  import { getZonesContext } from "../logic/zones.svelte";

  import ZoneContainer from "./ZoneContainer.svelte";
  import ZoneHeader from "./ZoneHeader.svelte";
  import ZoneBodyCreate from "./ZoneBodyCreate.svelte";
  import ZoneBodyGroup from "./ZoneBodyGroup.svelte";
  import ZoneBodyDelete from "./ZoneBodyDelete.svelte";
  import ZoneBodyHidden from "./ZoneBodyHidden.svelte";

  const zones = getZonesContext();
</script>

<aside>
  <ZoneContainer
    target={{ kind: "new-group" }}
    aria-label="新合併區"
    style="align-items: center; padding: 1rem 0.75rem;"
  >
    <ZoneBodyCreate />
  </ZoneContainer>

  {#each zones.groups as group (group.id)}
    {@const target = { kind: "group", id: group.id } as const}
    <ZoneContainer {target} aria-label={`合併區 ${group.canonical.trim()}`}>
      <ZoneHeader {target} tags={group.tags} label="合併或重新命名" />
      <ZoneBodyGroup {group} />
    </ZoneContainer>
  {/each}

  <ZoneContainer target={{ kind: "delete" }} aria-label="刪除區">
    <ZoneHeader target={{ kind: "delete" }} tags={zones.delete.tags} label="刪除區" />
    <ZoneBodyDelete />
  </ZoneContainer>

  <ZoneContainer target={{ kind: "hidden" }} aria-label="切換隱藏區">
    <ZoneHeader target={{ kind: "hidden" }} tags={zones.hidden.tags} label="切換隱藏區" />
    <ZoneBodyHidden />
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
