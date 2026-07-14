<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import Combo from "$lib/components/inputs/Combo.svelte";
  import CircularProgress from "$lib/components/display/CircularProgress.svelte";

  const id = $props.id();

  const cities = [
    "Amsterdam",
    "Austin",
    "Bangkok",
    "Barcelona",
    "Berlin",
    "Boston",
    "Chicago",
    "Copenhagen",
    "Dublin",
    "Helsinki",
    "Lisbon",
    "London",
    "Madrid",
    "Melbourne",
    "Nairobi",
    "Osaka",
    "Oslo",
    "Prague",
    "Seattle",
    "Seoul",
    "Singapore",
    "Stockholm",
    "Sydney",
    "Taipei",
    "Tokyo",
    "Toronto",
    "Vancouver",
    "Vienna",
    "Warsaw",
    "Zurich",
  ];

  // --- Basic: composed with TextInput, local synchronous filtering ---
  let basicValue = $state("");
  const basicCandidates = $derived(
    basicValue.trim() ? cities.filter((c) => c.toLowerCase().includes(basicValue.trim().toLowerCase())) : cities,
  );

  // --- Validation: "touched" tracked via the composable onblur, not the native one ---
  const currencyCandidatesAll = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD"];
  let currencyValue = $state("");
  let currencyTouched = $state(false);
  const currencyCandidates = $derived(
    currencyValue.trim()
      ? currencyCandidatesAll.filter((c) => c.toLowerCase().includes(currencyValue.trim().toLowerCase()))
      : currencyCandidatesAll,
  );
  const currencyInvalid = $derived(currencyTouched && !currencyCandidatesAll.includes(currencyValue));
  const handleCurrencyBlur = () => {
    currencyTouched = true;
  };

  // --- Async: candidates arrive after a simulated delay; caller decides the loading-indicator threshold ---
  let asyncValue = $state("");
  let asyncCandidates = $state<string[]>(cities);
  let fetching = $state(false);
  let showSpinner = $state(false);
  let fetchTimer: ReturnType<typeof setTimeout>;
  let spinnerTimer: ReturnType<typeof setTimeout>;

  $effect(() => {
    return () => {
      clearTimeout(fetchTimer);
      clearTimeout(spinnerTimer);
    };
  });

  const handleAsyncInput = () => {
    fetching = true;
    clearTimeout(spinnerTimer);
    // 呼叫端自己決定「查詢超過多久才顯示 loading」，這裡選 200ms
    spinnerTimer = setTimeout(() => {
      if (fetching) showSpinner = true;
    }, 200);

    const query = asyncValue;
    clearTimeout(fetchTimer);
    // 模擬網路延遲
    fetchTimer = setTimeout(() => {
      asyncCandidates = query.trim()
        ? cities.filter((c) => c.toLowerCase().includes(query.trim().toLowerCase()))
        : cities;
      fetching = false;
      showSpinner = false;
    }, 700);
  };

  const asyncListboxExtra = $derived(showSpinner ? loadingRow : undefined);

  // --- No results: proving listboxExtra alone covers this, no dedicated noResultDisplay prop ---
  let noResultsValue = $state("");
  const noResultsCandidates = $derived(
    noResultsValue.trim()
      ? cities.filter((c) => c.toLowerCase().includes(noResultsValue.trim().toLowerCase()))
      : cities,
  );
  const noResultsExtra = $derived(noResultsValue.trim() && noResultsCandidates.length === 0 ? noMatchesRow : undefined);
</script>

<svelte:head>
  <title>Combo</title>
</svelte:head>

{#snippet loadingRow()}
  <span class="loading-spinner"><CircularProgress size="0.875rem" /></span>
  <span>Searching…</span>
{/snippet}

{#snippet noMatchesRow()}
  <span>No matches for “{noResultsValue.trim()}”</span>
{/snippet}

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      <section>
        <h4>Basic</h4>
        <Combo label="City" bind:value={basicValue} candidates={basicCandidates} style="width: 220px">
          {#snippet candidate(key, active)}
            <span class="ellipsis" class:accent={active}>{key}</span>
          {/snippet}
        </Combo>
      </section>

      <section>
        <h4>Validation (touched on blur)</h4>
        <Combo
          label="Currency"
          variant="filled"
          bind:value={currencyValue}
          candidates={currencyCandidates}
          status={currencyInvalid ? "error" : "default"}
          onblur={handleCurrencyBlur}
          aria-describedby={currencyInvalid ? `${id}-currency-error` : undefined}
          style="width: 220px"
        >
          {#snippet candidate(key, active)}
            <span class="ellipsis" class:accent={active}>{key}</span>
          {/snippet}
        </Combo>
        {#if currencyInvalid}
          <span id="{id}-currency-error" class="error">Not a recognized currency code</span>
        {:else}
          <span class="readout">Type a currency code, then blur without picking one</span>
        {/if}
      </section>

      <section>
        <h4>Async candidates</h4>
        <Combo
          label="City (simulated search)"
          bind:value={asyncValue}
          candidates={asyncCandidates}
          oninput={handleAsyncInput}
          listboxExtra={asyncListboxExtra}
          style="width: 220px"
        >
          {#snippet candidate(key, active)}
            <span class="ellipsis" class:accent={active}>{key}</span>
          {/snippet}
        </Combo>
        <span class="readout">Spinner only appears if it's still pending past 200ms</span>
      </section>

      <section>
        <h4>No results hint</h4>
        <Combo
          label="City"
          bind:value={noResultsValue}
          candidates={noResultsCandidates}
          listboxExtra={noResultsExtra}
          style="width: 220px"
        >
          {#snippet candidate(key, active)}
            <span class="ellipsis" class:accent={active}>{key}</span>
          {/snippet}
        </Combo>
        <span class="readout">Type something no city matches, e.g. "xyz"</span>
      </section>
    </div>
  </PreviewCanvas>
{/snippet}

<PreviewLayout
  component="Combo"
  label="Filterable text input"
  guide="Built on `TextInput`, [[↑]]/[[↓]] navigate candidates, [[Enter]] commits the highlighted one, [[Esc]] closes. The `candidates` reacts dynamically to sync filtering or async search. Use `listboxExtra` to custom-render loading or no-results rows."
  {preview}
/>

<style>
  .container {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    width: min(24rem, 100%);
  }

  section {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.375rem;
  }

  h4 {
    font: var(--font-body1);
    color: var(--color-text-muted);
  }

  .readout {
    font: var(--font-caption);
    color: var(--color-text-muted);
  }

  .error {
    font: var(--font-caption);
    color: var(--color-error);
  }

  .accent {
    color: var(--color-accent);
  }

  .loading-spinner {
    display: flex;
    flex-shrink: 0;
  }
</style>
