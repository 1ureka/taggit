<script lang="ts">
  import type { IconProps } from "$lib/types";
  let { color = "currentColor", size = 24, ...rest }: IconProps = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke={color}
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  {...rest}
>
  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
  <path d="M5 12l14 0" />
  <path d="M13 18l6 -6" />
  <path d="M13 6l6 6" />
</svg>
