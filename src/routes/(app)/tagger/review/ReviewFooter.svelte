<script lang="ts">
  import { IconCheck } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import ReviewImpact from "./ReviewImpact.svelte";

  type Props = {
    total: number;
    checked: number;
    newTags: string[];
    pending: boolean;
    oncancel: () => void;
    onsubmit: () => void;
  };

  let { total, checked, newTags, pending, oncancel, onsubmit }: Props = $props();
</script>

<footer>
  {#if total > 0}
    <ReviewImpact {checked} tags={newTags} />
  {/if}

  <div>
    <Button variant="ghost" status={pending ? "disabled" : undefined} onclick={oncancel}>取消</Button>
    <Button variant="primary" status={pending ? "pending" : checked === 0 ? "disabled" : undefined} onclick={onsubmit}>
      <IconCheck size={16} />
      <span>提交 {checked} 張</span>
    </Button>
  </div>
</footer>

<style>
  footer {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    border-top: var(--border-style);
  }

  div {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
