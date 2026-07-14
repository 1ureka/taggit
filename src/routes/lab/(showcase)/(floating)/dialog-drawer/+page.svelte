<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import Drawer from "$lib/components/floating/Drawer.svelte";
  import { IconLayoutSidebarLeftExpand, IconX } from "$lib/icons";

  type Side = "top" | "bottom" | "left" | "right";

  let activeSide = $state<Side | null>(null);
  const close = () => (activeSide = null);
</script>

<svelte:head>
  <title>Dialog — Drawer</title>
</svelte:head>

{#snippet preview()}
  <PreviewCanvas>
    <div class="cross">
      <div class="cell top">
        <Button onclick={() => (activeSide = "top")} style="gap: 0.3rem; flex-direction: column;">
          <IconLayoutSidebarLeftExpand size={18} style="transform: rotate(90deg)" />
          <span>Top</span>
        </Button>
      </div>

      <div class="cell left">
        <Button onclick={() => (activeSide = "left")} style="gap: 0.3rem;">
          <IconLayoutSidebarLeftExpand size={18} />
          <span>Left</span>
        </Button>
      </div>

      <div class="cell right">
        <Button onclick={() => (activeSide = "right")} style="gap: 0.3rem;">
          <span>Right</span>
          <IconLayoutSidebarLeftExpand size={18} style="transform: rotate(180deg)" />
        </Button>
      </div>

      <div class="cell bottom">
        <Button onclick={() => (activeSide = "bottom")} style="gap: 0.3rem; flex-direction: column;">
          <span>Bottom</span>
          <IconLayoutSidebarLeftExpand size={18} style="transform: rotate(270deg)" />
        </Button>
      </div>
    </div>
  </PreviewCanvas>

  {#each ["right", "left", "bottom", "top"] as Side[] as side}
    <Drawer open={activeSide === side} {side} onclose={close} maxWidth={side === "top" ? "960px" : undefined}>
      {#if side === "right"}
        <div class="body right">
          <header class="profile-header">
            <div class="skel avatar"></div>
            <div class="profile-info">
              <div class="skel line lg" style="width: 62%"></div>
              <div class="skel line sm" style="width: 42%"></div>
            </div>
          </header>
          <hr />
          <div class="list">
            {#each [80, 58, 92, 48, 74] as w}
              <div class="list-row">
                <div class="skel icon-sq"></div>
                <div class="skel line" style="width: {w}%"></div>
              </div>
            {/each}
          </div>
          <footer>
            <Button variant="ghost" onclick={close}>
              <IconX size={16} />
              <span>Close</span>
            </Button>
          </footer>
        </div>
      {:else if side === "left"}
        <div class="body left">
          <div class="nav-header">
            <div class="skel line md" style="width: 5rem"></div>
            <Button variant="ghost" padding="icon" onclick={close}><IconX size={16} /></Button>
          </div>
          <nav>
            {#each [100, 70, 88, 54, 82, 62] as w}
              <div class="nav-row">
                <div class="skel icon-sq sm"></div>
                <div class="skel line" style="width: {w}%"></div>
              </div>
            {/each}
          </nav>
        </div>
      {:else if side === "top"}
        <div class="body top">
          <div class="skel line sm" style="width: 4.5rem; flex-shrink: 0"></div>
          <div class="chips">
            {#each [4.5, 6, 3.5, 5.5, 7, 4] as rem}
              <div class="skel chip" style="width: {rem}rem"></div>
            {/each}
          </div>
          <Button variant="ghost" padding="icon" onclick={close}><IconX size={16} /></Button>
        </div>
      {:else if side === "bottom"}
        <div class="body bottom">
          <div class="skel banner"></div>
          <div class="sheet-text">
            <div class="skel line xl" style="width: 72%"></div>
            <div class="skel line" style="width: 60%"></div>
            <div class="skel line sm" style="width: 46%"></div>
          </div>
          <div class="sheet-footer">
            <Button onclick={close}>
              <IconX size={16} />
              <span>Dismiss</span>
            </Button>
          </div>
        </div>
      {/if}
    </Drawer>
  {/each}
{/snippet}

<PreviewLayout component="Dialog" label="Drawer" guide="A pull-out from the margin." {preview} />

<style>
  .cross {
    display: grid;
    grid-template-columns: repeat(3, 5rem);
    grid-template-rows: repeat(3, 3.5rem);
    gap: 0.5rem;
  }

  .cell {
    display: grid;
  }

  .cell.top {
    grid-column: 2;
    grid-row: 1;
  }
  .cell.left {
    grid-column: 1;
    grid-row: 2;
  }
  .cell.right {
    grid-column: 3;
    grid-row: 2;
  }
  .cell.bottom {
    grid-column: 2;
    grid-row: 3;
  }

  /* --- */

  .skel {
    border-radius: var(--border-radius);
    background: linear-gradient(
      90deg,
      var(--color-bg-hover) 25%,
      var(--color-bg-active) 50%,
      var(--color-bg-hover) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 2s linear infinite;
  }

  @keyframes shimmer {
    from {
      background-position: 200% 0;
    }
    to {
      background-position: -200% 0;
    }
  }

  .skel.avatar {
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .skel.icon-sq {
    width: 1.5rem;
    height: 1.5rem;
    flex-shrink: 0;
  }

  .skel.icon-sq.sm {
    width: 1.125rem;
    height: 1.125rem;
  }

  .skel.line {
    height: 0.75rem;
    border-radius: 9999px;
  }

  .skel.line.sm {
    height: 0.5rem;
  }
  .skel.line.lg {
    height: 1rem;
  }
  .skel.line.xl {
    height: 1.125rem;
  }

  .skel.chip {
    height: 1.75rem;
    border-radius: 9999px;
    flex-shrink: 0;
  }

  .skel.banner {
    width: 100%;
    height: 7.5rem;
    border-radius: calc(var(--border-radius) * 1.5);
    flex-shrink: 0;
  }

  /* --- */

  .body {
    display: flex;
    padding: 1.25rem 1.5rem;
    gap: 1rem;
  }

  /* --- */

  .body.right {
    flex-direction: column;
    height: 100%;
    min-width: 15rem;
  }

  .profile-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .profile-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  hr {
    border: none;
    border-top: var(--border-style);
    margin: 0;
  }

  .list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .list-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .body.right footer {
    display: flex;
    justify-content: flex-end;
    margin-top: auto;
  }

  /* --- */

  .body.left {
    flex-direction: column;
    height: 100%;
    min-width: 13rem;
  }

  .nav-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  nav {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .nav-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-block: 0.375rem;
  }

  /* --- */

  .body.top {
    flex-direction: row;
    align-items: center;
    width: 100%;
    padding-block: 1rem;
  }

  .chips {
    display: flex;
    gap: 0.5rem;
    flex: 1;
    flex-wrap: wrap;
    align-items: center;
  }

  /* --- */

  .body.bottom {
    flex-direction: column;
    width: 100%;
  }

  .sheet-text {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .sheet-footer {
    display: flex;
    justify-content: flex-end;
  }
</style>
