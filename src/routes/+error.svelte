<script lang="ts">
  import { page } from "$app/state";
  import { IconArrowLeft, IconAlertTriangleFilled } from "$lib/icons";
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";
</script>

<svelte:head>
  <title>{page.status} · Taggit</title>
</svelte:head>

<main>
  <div>
    <IconAlertTriangleFilled size={48} />
  </div>

  <h2>{page.status}</h2>
  <p>{page.error?.message ?? "發生未知錯誤"}</p>

  <ButtonLink href="/" variant="outlined">
    <IconArrowLeft size={16} />
    <span>返回首頁</span>
  </ButtonLink>
</main>

<style>
  main {
    max-width: 480px;
    margin: 0 auto;
    padding: 4rem 1.5rem;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 0.75rem;
  }

  main > div {
    color: var(--color-text-muted);
    margin-bottom: 0.5rem;
  }

  main > h2 {
    font-size: 3rem;
    font-weight: normal;
    letter-spacing: -0.03em;
    line-height: 1;
    color: var(--color-text);
  }

  main > p {
    font: var(--font-body1);
    color: var(--color-text-muted);
    max-width: 320px;
    margin-bottom: 1rem;
  }
</style>
