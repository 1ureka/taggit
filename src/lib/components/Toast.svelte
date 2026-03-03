<script lang="ts">
  import { toasts } from "$lib/client/toast.js";
  import type { ToastItem } from "$lib/client/toast.js";

  let items: ToastItem[] = $state([]);
  let fading = $state(new Set<number>());

  toasts.subscribe((v) => {
    // detect removals to trigger fade-out
    const currentIds = new Set(v.map((t) => t.id));
    for (const item of items) {
      if (!currentIds.has(item.id) && !fading.has(item.id)) {
        fading.add(item.id);
        fading = new Set(fading);
        setTimeout(() => {
          items = items.filter((t) => t.id !== item.id);
          fading.delete(item.id);
          fading = new Set(fading);
        }, 200);
      }
    }
    // add new ones
    for (const t of v) {
      if (!items.find((i) => i.id === t.id)) {
        items = [...items, t];
      }
    }
  });
</script>

{#if items.length > 0}
  <div class="toast-container">
    {#each items as toast (toast.id)}
      <div
        class="toast toast-{toast.type}"
        style={fading.has(toast.id)
          ? "opacity:0;transform:translateY(-8px);transition:opacity 0.2s,transform 0.2s;"
          : ""}
      >
        {toast.message}
      </div>
    {/each}
  </div>
{/if}

<style>
  @import "../styles/Toast.css";
</style>
