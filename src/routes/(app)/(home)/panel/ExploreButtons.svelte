<script lang="ts">
  import { page } from "$app/state";
  import { IconPlayerPlayFilled, IconArrowsShuffle } from "$lib/icons";
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";
</script>

<footer>
  <ButtonLink variant="primary" padding="md" href={`/player${page.url.search}`}>
    <IconPlayerPlayFilled size={16} />
    <span>播放</span>
  </ButtonLink>
  <ButtonLink variant="outlined" padding="md" href={`/compare${page.url.search}`}>
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
