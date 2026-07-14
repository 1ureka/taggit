<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  type Props = HTMLAttributes<SVGSVGElement> & {
    size?: number | string;
    color?: string;
    thickness?: number;
    track?: boolean;
  };

  const viewBoxSize = 48;
  const center = viewBoxSize / 2;
  const radius = 18;
  const circumference = 2 * Math.PI * radius;

  let { size = 18, color = "currentColor", thickness = 4, track = false, style, ...rest }: Props = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
  fill="none"
  role="progressbar"
  aria-busy="true"
  {color}
  {...rest}
>
  {#if track}
    <circle
      class="track"
      cx={center}
      cy={center}
      r={radius}
      stroke="currentColor"
      stroke-width={thickness}
      stroke-linecap="round"
    />
  {/if}

  <g class="spinner-rotator">
    <circle
      class="spinner-arc"
      cx={center}
      cy={center}
      r={radius}
      stroke="currentColor"
      stroke-width={thickness}
      stroke-linecap="round"
      pathLength={circumference}
      stroke-dasharray={`${circumference * 0.08} ${circumference * 0.92}`}
      stroke-dashoffset={circumference * 0.03}
    />
  </g>
</svg>

<style>
  svg {
    display: inline-block;
    vertical-align: middle;
  }

  .track {
    opacity: 0.2;
  }

  .spinner-rotator {
    transform-origin: center;
    animation: circular-progress-rotate 1.6s cubic-bezier(0.55, 0.15, 0.45, 0.85) infinite;
  }

  .spinner-arc {
    transform-origin: center;
    animation: circular-progress-dash 1.6s ease-in-out infinite;
  }

  @keyframes circular-progress-rotate {
    0% {
      transform: rotate(-90deg);
    }
    100% {
      transform: rotate(270deg);
    }
  }

  @keyframes circular-progress-dash {
    0% {
      stroke-dasharray: 12 101;
      stroke-dashoffset: 0;
    }
    50% {
      stroke-dasharray: 68 45;
      stroke-dashoffset: -18;
    }
    100% {
      stroke-dasharray: 12 101;
      stroke-dashoffset: -113;
    }
  }
</style>
