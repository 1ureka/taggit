<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  let rest: HTMLInputAttributes = $props();
</script>

<input type="range" {...rest} />

<style>
  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
    height: 1.25rem;
  }

  input[type="range"]::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 2px;
    background-color: hsl(from var(--color-accent) h s l / 0.2);
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background-color: var(--color-accent);
    margin-top: -5px;
    border: none;
    box-shadow: 0px 0px 0px 0px hsl(from var(--color-accent) h s l / 0.25);
    transition: box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  input[type="range"]:hover::-webkit-slider-thumb {
    box-shadow: 0px 0px 0px 8px hsl(from var(--color-accent) h s l / 0.25);
  }

  input[type="range"]::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background-color: hsl(from var(--color-accent) h s l / 0.2);
    border: none;
  }

  input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background-color: var(--color-accent);
    border: none;
  }
</style>
