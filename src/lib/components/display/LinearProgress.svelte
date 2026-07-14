<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    /** 0–100，未給則為 indeterminate */
    value?: number;
    /** 軌道粗細，預設 'md' */
    size?: "sm" | "md";
    /** 填充色，預設 currentColor，軌道底色由同一顏色降低不透明度推導 */
    color?: string;
  }

  let { value, size = "md", color = "currentColor", ...rest }: Props = $props();
</script>

<div
  class={{ "linear-progress": true, sm: size === "sm" }}
  role="progressbar"
  aria-valuemin={value !== undefined ? 0 : undefined}
  aria-valuemax={value !== undefined ? 100 : undefined}
  aria-valuenow={value}
  aria-busy={value === undefined ? true : undefined}
  style:color
  {...rest}
>
  {#if value !== undefined}
    <div class="fill" style:width="{value}%"></div>
  {:else}
    <div class="fill indeterminate"></div>
  {/if}
</div>

<style>
  .linear-progress {
    position: relative;
    overflow: hidden;
    height: 6px;
    border-radius: 9999px;
  }

  .linear-progress.sm {
    height: 4px;
  }

  .linear-progress::before {
    content: "";
    position: absolute;
    inset: 0;
    background: currentColor;
    opacity: 0.18;
  }

  .fill {
    position: absolute;
    inset: 0;
    width: 0;
    border-radius: 9999px;
    background: currentColor;
    transition: width 0.2s ease-out;
  }

  .fill.indeterminate {
    width: 40%;
    transition: none;
    animation: linear-progress-slide 1.6s ease-in-out infinite;
    will-change: transform;
  }

  @keyframes linear-progress-slide {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(350%);
    }
  }
</style>
