<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import Select from "$lib/components/inputs/Select.svelte";
  import Chip from "$lib/components/display/Chip.svelte";
  import { IconCheck, IconUserFilled, IconAlertTriangleFilled } from "$lib/icons";

  // --- Account switcher ---
  type Org = { name: string; plan: string; color: string };
  const orgOptions = ["acme", "beta-labs", "personal"] as const;
  const orgs: Record<(typeof orgOptions)[number], Org> = {
    acme: { name: "Acme Inc.", plan: "Enterprise", color: "#6366f1" },
    "beta-labs": { name: "Beta Labs", plan: "Pro", color: "#f97316" },
    personal: { name: "Alex Chen", plan: "Free", color: "#22c55e" },
  };
  let orgValue = $state<string>();

  // --- Model picker ---
  type Model = { label: string; description: string };
  const modelOptions = ["gpt-4o", "o1-pro", "gpt-4o-mini"] as const;
  const models: Record<(typeof modelOptions)[number], Model> = {
    "gpt-4o": { label: "GPT-4o", description: "Great for everyday conversation" },
    "o1-pro": { label: "o1 Pro", description: "Deep reasoning for hard problems" },
    "gpt-4o-mini": { label: "GPT-4o mini", description: "Fastest response, lower cost" },
  };
  let modelValue = $state<string>(modelOptions[0]);
  let modelStatus = $state<"default" | "pending">("default");
  let modelTimer: ReturnType<typeof setTimeout>;
  $effect(() => () => clearTimeout(modelTimer));
  const handleModelChange = () => {
    modelStatus = "pending";
    clearTimeout(modelTimer);
    modelTimer = setTimeout(() => (modelStatus = "default"), 800);
  };

  // --- Region select (empty state) ---
  let regionValue = $state<string>();

  // --- Filter bar ---
  const dateRangeOptions = ["today", "7d", "30d", "custom"] as const;
  const dateRangeLabels: Record<(typeof dateRangeOptions)[number], string> = {
    today: "Today",
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    custom: "Custom range",
  };
  let dateRangeValue = $state<string>("7d");

  const transactionTypeOptions = ["all", "payment", "refund", "payout"] as const;
  const transactionTypeLabels: Record<(typeof transactionTypeOptions)[number], string> = {
    all: "All types",
    payment: "Payment",
    refund: "Refund",
    payout: "Payout",
  };
  let transactionTypeValue = $state<string>("all");

  const currencyOptions = ["usd", "eur", "gbp", "jpy"] as const;
  const currencyLabels: Record<(typeof currencyOptions)[number], string> = {
    usd: "USD",
    eur: "EUR",
    gbp: "GBP",
    jpy: "JPY",
  };
  let currencyValue = $state<string>("usd");
</script>

<svelte:head>
  <title>Select</title>
</svelte:head>

{#snippet orgAvatar(org: Org)}
  <span class="avatar" style="background-color: {org.color};">{org.name.charAt(0)}</span>
{/snippet}

{#snippet orgPlaceholder()}
  <span class="avatar avatar-placeholder"><IconUserFilled size={12} /></span>
  <span>Select account</span>
{/snippet}

{#snippet regionNoOptions()}
  <span class="no-options">
    <span class="no-options-title">
      <IconAlertTriangleFilled size={14} style="color: var(--color-warning);" />
      No regions available
    </span>
    <span class="no-options-desc">Contact your admin for access</span>
  </span>
{/snippet}

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      <div class="pair-grid">
        <div class="field">
          <Select
            label="Account"
            bind:value={orgValue}
            options={orgOptions}
            matchWidth={false}
            placeholder={orgPlaceholder}
          >
            {#snippet option(key, selected)}
              {@const org = orgs[key as (typeof orgOptions)[number]]}
              {@render orgAvatar(org)}
              <span class="ellipsis" style="flex: 1;">{org.name}</span>
              <Chip variant="outlined" style="flex-shrink: 0;">{org.plan}</Chip>
              {#if selected}
                <IconCheck size={16} style="color: var(--color-accent); flex-shrink: 0;" />
              {/if}
            {/snippet}
            {#snippet triggerOption(key)}
              {@const org = orgs[key as (typeof orgOptions)[number]]}
              {@render orgAvatar(org)}
              <span class="ellipsis">{org.name}</span>
            {/snippet}
          </Select>
        </div>

        <div class="field">
          <Select
            label="Model"
            bind:value={modelValue}
            options={modelOptions}
            status={modelStatus}
            onchange={handleModelChange}
            matchWidth={false}
          >
            {#snippet option(key)}
              {@const model = models[key as (typeof modelOptions)[number]]}
              <span class="model-row">
                <span class="model-label">{model.label}</span>
                <span class="model-description">{model.description}</span>
              </span>
            {/snippet}
            {#snippet triggerOption(key)}
              {models[key as (typeof modelOptions)[number]].label}
            {/snippet}
          </Select>
        </div>
      </div>

      <div class="field">
        <Select label="Region" bind:value={regionValue} options={[]} noOptionsDisplay={regionNoOptions}>
          {#snippet option(key)}{key}{/snippet}
        </Select>
      </div>

      <div class="filter-grid">
        <Select label="Date range" bind:value={dateRangeValue} options={dateRangeOptions}>
          {#snippet option(key)}
            <span class="ellipsis">{dateRangeLabels[key as (typeof dateRangeOptions)[number]]}</span>
          {/snippet}
        </Select>
        <Select label="Transaction type" bind:value={transactionTypeValue} options={transactionTypeOptions}>
          {#snippet option(key)}
            <span class="ellipsis">{transactionTypeLabels[key as (typeof transactionTypeOptions)[number]]}</span>
          {/snippet}
        </Select>
        <Select label="Currency" bind:value={currencyValue} options={currencyOptions} status="disabled">
          {#snippet option(key)}
            <span class="ellipsis">{currencyLabels[key as (typeof currencyOptions)[number]]}</span>
          {/snippet}
        </Select>
      </div>
    </div>
  </PreviewCanvas>
{/snippet}

<PreviewLayout
  component="Select"
  label="Closed options"
  guide="Real compositions built on the same `Select`."
  {preview}
/>

<style>
  .container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: min(46rem, 100%);
  }

  /* --- */

  .pair-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.375rem;
  }

  /* --- */

  .avatar {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    font: var(--font-caption);
    color: #fff;
    text-transform: uppercase;
    border-radius: 50%;
    margin-right: 0.25rem;
  }

  .avatar-placeholder {
    color: var(--color-text-muted);
    background: transparent;
    border: 2px dashed var(--color-border);
  }

  /* --- */

  .model-row {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    width: 100%;
    text-align: left;
  }

  .model-label {
    font: var(--font-body2);
    color: var(--color-text);
  }

  .model-description {
    font: var(--font-caption);
    color: var(--color-text-muted);
  }

  /* --- */

  .no-options {
    display: inline-flex;
    flex-direction: column;
    gap: 0.125rem;
    text-align: left;
    padding: 0.25rem 0px;
  }

  .no-options-title {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font: var(--font-body2);
    color: var(--color-text);
  }

  .no-options-desc {
    font: var(--font-caption);
    color: var(--color-text-muted);
  }

  /* --- */

  .filter-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    justify-items: stretch;
  }
</style>
