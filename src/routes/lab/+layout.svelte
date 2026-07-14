<script lang="ts">
  import "$lib/assets/app.css";
  import favicon from "$lib/assets/favicon.svg";

  import { IconChevronDown, IconBook, IconGithub } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import Tooltip from "$lib/components/floating/Tooltip.svelte";
  import ToastStage from "$lib/components/floating/ToastStage.svelte";
  import ToastList from "$lib/components/floating/ToastList.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";
  import NavigationIndicator from "$lib/components/display/NavigationIndicator.svelte";

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<header>
  <ButtonLink variant="ghost" padding="icon" href="/lab">
    <IconBook size={32} />
    <span class="sr-only">Playground home</span>
  </ButtonLink>

  <ButtonLink
    variant="ghost"
    padding="icon"
    href="https://github.com/1ureka"
    target="_blank"
    rel="noopener noreferrer"
    style="margin-left: auto;"
    {@attach tooltip({ content: "My GitHub profile", placement: "left" })}
  >
    <IconGithub size={20} />
    <span class="sr-only">My GitHub profile</span>
  </ButtonLink>

  <div aria-hidden="true"></div>

  <Button
    variant="ghost"
    padding="icon"
    aria-label="Customize appearance"
    {@attach tooltip({ content: "Customize appearance" })}
    // TODO: Implement real theme select ui and logic，目前先暫時做 light/dark 切換
    onclick={() => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("theme", next);
    }}
  >
    <div class="theme-preview"></div>
    <IconChevronDown size={14} />
  </Button>
</header>

{@render children()}
<Tooltip />
<ToastStage />
<ToastList />
<NavigationIndicator />

<style>
  header {
    position: sticky;
    top: 0;
    display: flex;
    align-items: center;
    width: 100%;
    min-height: var(--height-header);
    height: var(--height-header);
    max-height: var(--height-header);
    padding: 0 1.5rem;
    gap: 0.75rem;
    z-index: 1;
  }

  header > div[aria-hidden="true"] {
    border-left: var(--border-style);
    height: 1rem;
  }

  header .theme-preview {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border-radius: 999px;
    border: var(--border-style);
    border-color: var(--color-text);
    background-color: var(--color-bg-hover);
  }

  /* --- */

  header::before {
    content: "";
    position: absolute;
    inset: 0;
    background-color: var(--color-bg);
    z-index: -1;
    pointer-events: none;
  }

  @supports (mask-image: linear-gradient(to bottom, black calc(100% - 2.5rem), transparent 100%)) {
    header::before {
      bottom: -1.5rem;
      mask-image: linear-gradient(to bottom, black calc(100% - 2.5rem), transparent 100%);
    }
  }

  @supports (animation-timeline: scroll()) {
    @keyframes header-before {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    header::before {
      animation: header-before step-end both;
      animation-timeline: scroll();
      animation-range: 0px 10px;
    }
  }
</style>
