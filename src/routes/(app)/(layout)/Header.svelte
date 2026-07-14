<script lang="ts">
  import favicon from "$lib/assets/favicon.svg";

  import { IconListDetails } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { showToasts } from "$lib/components/floating/toast-events";
  import Button from "$lib/components/actions/Button.svelte";
  import ModalTrigger from "./ModalTrigger.svelte";

  let { modalOpen, openModal }: { modalOpen: boolean; openModal: () => void } = $props();

  // TODO: 之後做真正的主題選擇 UI，目前先暫時做 light/dark 切換
  const handleToggleTheme = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
  };
</script>

<header>
  <h1 class="left">
    <img src={favicon} alt="" width="24" height="24" />
    Taggit
  </h1>

  <div class="mid">
    {#if !modalOpen}
      <ModalTrigger onclick={openModal} />
    {/if}
  </div>

  <div class="right">
    <Button variant="ghost" padding="icon" onclick={showToasts} {@attach tooltip({ content: "通知歷史" })}>
      <IconListDetails size={20} />
      <span class="sr-only">通知歷史</span>
    </Button>

    <Button variant="ghost" padding="icon" onclick={handleToggleTheme} {@attach tooltip({ content: "切換主題" })}>
      <span class="theme-preview"></span>
      <span class="sr-only">切換主題</span>
    </Button>
  </div>
</header>

<style>
  header {
    display: grid;
    grid-template-columns: 1fr minmax(200px, 260px) 1fr;
    align-items: center;
    gap: 1rem;
    padding: 0 1rem;
    height: 3rem;
    min-height: 3rem;
    background-color: var(--color-bg-card);
    border-bottom: var(--border-style);
  }

  .left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font: var(--font-title2);
    font-weight: normal;
    letter-spacing: 0.1rem;
  }

  .mid {
    display: flex;
    justify-content: center;
  }

  .right {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.25rem;
  }

  .theme-preview {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border-radius: 999px;
    border: var(--border-style);
    border-color: var(--color-text);
    background-color: var(--color-bg-hover);
  }
</style>
