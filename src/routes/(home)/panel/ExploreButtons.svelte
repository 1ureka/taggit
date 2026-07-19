<script lang="ts">
  import { IconPlayerPlayFilled, IconArrowsShuffle } from "$lib/icons";
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";
  import { getFilterContext } from "../logic/filter.svelte";

  const filter = getFilterContext();

  const query = $derived(filter.query.toSearchParams().toString());
</script>

<footer>
  <ButtonLink variant="primary" padding="md" href={`/player${query ? `?${query}` : ""}`}>
    <IconPlayerPlayFilled size={16} />
    <span>播放</span>
  </ButtonLink>
  <ButtonLink variant="outlined" padding="md" href={`/compare${query ? `?${query}` : ""}`}>
    <IconArrowsShuffle size={16} />
    <span>比較</span>
  </ButtonLink>
</footer>

<style>
  footer {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
    padding: 0.75rem;
    border-top: var(--border-style);
  }
</style>
