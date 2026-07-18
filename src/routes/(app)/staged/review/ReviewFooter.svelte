<script lang="ts">
  import { IconCheck } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import ReviewImpact from "./ReviewImpact.svelte";

  type Props = {
    checkedCount: number;
    newTags: string[];
    pending: boolean;
    oncancel: () => void;
    onsubmit: () => void;
  };

  let { checkedCount, newTags, pending, oncancel, onsubmit }: Props = $props();

  const cancelStatus = $derived(pending ? "disabled" : undefined);
  const submitStatus = $derived(pending ? "pending" : checkedCount === 0 ? "disabled" : undefined);
</script>

<footer>
  <ReviewImpact {checkedCount} tags={newTags} />
  <div>
    <Button variant="ghost" status={cancelStatus} onclick={oncancel}>取消</Button>
    <Button variant="primary" status={submitStatus} onclick={onsubmit}>
      <IconCheck size={16} />
      <span>提交 {checkedCount} 張</span>
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
