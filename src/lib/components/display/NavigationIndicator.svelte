<script lang="ts">
  import { untrack } from "svelte";
  import { navigating } from "$app/state";

  type Phase = "idle" | "loading" | "completing";
  let phase: Phase = $state("idle");

  $effect(() => {
    const inProgress = navigating.type !== null;
    untrack(() => {
      if (inProgress) {
        phase = "loading";
      } else if (phase === "loading") {
        phase = "completing";
      }
    });
  });

  function onanimationend() {
    if (phase === "completing") {
      phase = "idle";
    }
  }
</script>

<div
  class="navigation-indicator"
  class:loading={phase === "loading"}
  class:completing={phase === "completing"}
  {onanimationend}
>
  <div class="bar"></div>
</div>

<style>
  .navigation-indicator {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    pointer-events: none;
    z-index: 1;
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .navigation-indicator.loading,
  .navigation-indicator.completing {
    opacity: 1;
  }

  .navigation-indicator.completing {
    animation: nav-fade-out 450ms ease 200ms forwards;
  }

  .bar {
    width: 100%;
    height: 100%;
    position: relative;
    background: var(--color-accent);
    transform-origin: left;
    transform: scaleX(0);
    overflow: hidden;
    --color-glow: hsl(from var(--color-accent) h s l / 0.5);
    box-shadow: 0 0 8px var(--color-glow);
  }

  .loading > .bar {
    animation: nav-loading 10s cubic-bezier(0.08, 0.82, 0.17, 1) forwards;
  }

  .completing > .bar {
    transform: scaleX(1);
  }

  .loading > .bar::after,
  .completing > .bar::after {
    content: "";
    position: absolute;
    inset: 0;
    --color-shimmer: hsl(from var(--color-bg) h s l / 0.7);
    background: linear-gradient(90deg, transparent 0%, var(--color-shimmer) 50%, transparent 100%);
    animation: nav-shimmer 1.5s ease-in-out infinite;
  }

  @keyframes nav-loading {
    from {
      transform: scaleX(0);
    }
    to {
      transform: scaleX(0.9);
    }
  }

  @keyframes nav-fade-out {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  @keyframes nav-shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
</style>
