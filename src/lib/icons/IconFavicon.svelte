<script lang="ts">
  import type { IconProps } from "$lib/types";

  type Props = Omit<IconProps, "color">;

  let { size = 24, ...rest }: Props = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 32 32" fill="none" {...rest}>
  <path
    class="path1"
    d="M2.53367 13.1206C1.68665 10.4923 3.13067 7.67498 5.75898 6.82796L19.0841 2.53368C21.7124 1.68665 24.5297 3.13067 25.3768 5.75898L29.671 19.0841C30.5181 21.7124 29.074 24.5297 26.4457 25.3768L13.1206 29.671C10.4923 30.5181 7.67498 29.074 6.82796 26.4457L2.53367 13.1206Z"
  />
  <g clip-path="url(#clip0_58_36)">
    <path
      class="path2"
      d="M16 7C23.2 7 25 8.8 25 16C25 23.2 23.2 25 16 25C8.8 25 7 23.2 7 16C7 8.8 8.8 7 16 7Z"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      class="path3"
      d="M16 17C16.7956 17 17.5587 16.6839 18.1213 16.1213C18.6839 15.5587 19 14.7956 19 14C19 13.2044 18.6839 12.4413 18.1213 11.8787C17.5587 11.3161 16.7956 11 16 11C15.2044 11 14.4413 11.3161 13.8787 11.8787C13.3161 12.4413 13 13.2044 13 14C13 14.7956 13.3161 15.5587 13.8787 16.1213C14.4413 16.6839 15.2044 17 16 17Z"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      class="path4"
      d="M10 24.05V24C10 22.9391 10.4214 21.9217 11.1716 21.1716C11.9217 20.4214 12.9391 20 14 20H18C19.0609 20 20.0783 20.4214 20.8284 21.1716C21.5786 21.9217 22 22.9391 22 24V24.05"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </g>
  <defs>
    <clipPath id="clip0_58_36">
      <rect width="24" height="24" transform="translate(4 4)" />
    </clipPath>
  </defs>
</svg>

<style>
  :global([data-theme="light"]) {
    & .path1 {
      fill: black;
      stroke: none;
    }
    & .path2 {
      fill: white;
      stroke: black;
    }
    & .path3,
    & .path4 {
      fill: none;
      stroke: black;
    }
    & rect {
      fill: white;
      stroke: none;
    }
  }

  :global([data-theme="dark"]) {
    & .path1 {
      fill: white;
      stroke: none;
    }
    & .path2 {
      fill: black;
      stroke: white;
    }
    & .path3,
    & .path4 {
      fill: none;
      stroke: white;
    }
    & rect {
      fill: black;
      stroke: none;
    }
  }
</style>
