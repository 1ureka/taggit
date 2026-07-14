<script lang="ts">
  import type { IconProps } from "$lib/types";
  let { color = "currentColor", size = 24, ...rest }: IconProps = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill={color} {...rest}>
  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
  <path d="M12 4a1 1 0 0 1 1 1v6h6a1 1 0 0 1 0 2h-6v6a1 1 0 0 1 -2 0v-6h-6a1 1 0 0 1 0 -2h6v-6a1 1 0 0 1 1 -1" />
</svg>
