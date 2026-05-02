<script>
  import FlowChart from "./components/FlowChart.svelte";
  import DailyHeatmap from "./components/DailyHeatmap.svelte";
  import CashTrend from "./components/CashTrend.svelte";
  import { parseTransactionCsv } from "./dataPrep";
  import { buildFlowGraph } from "./flow/buildFlowGraph";
  import {
    filteredTransactions,
    selectedDateRange,
    transactionDataset,
    transactionDateRange,
  } from "./stores/transactionStore";

  let startDate = "";
  let endDate = "";
  let loadError = "";
  let uploadStatus = "";
  let isDragging = false;
  let isParsing = false;

  $: dataset = $transactionDataset;
  $: dateRange = $transactionDateRange;
  $: visibleTransactions = $filteredTransactions;
  $: hasTransactions = dataset.transactions.length > 0;
  $: flowGraph = buildFlowGraph(visibleTransactions, dataset.categories, `${startDate} to ${endDate}`);

  async function updateRange(nextStart = startDate, nextEnd = endDate) {
    if (!hasTransactions || !nextStart || !nextEnd) return;
    startDate = nextStart;
    endDate = nextEnd;
    selectedDateRange.set({ startDate, endDate });
  }

  function monthBounds(date) {
    const value = new Date(`${date}T00:00:00`);
    const start = new Date(value.getFullYear(), value.getMonth(), 1);
    const end = new Date(value.getFullYear(), value.getMonth() + 1, 0);
    return [toDateInput(start), toDateInput(end)];
  }

  function toDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function applyShortcut(shortcut) {
    if (!hasTransactions) return;
    if (shortcut === "all") {
      updateRange(dateRange.minDate, dateRange.maxDate);
      return;
    }

    const baseDate = shortcut === "last-month"
      ? new Date(new Date(`${dateRange.maxDate}T00:00:00`).getFullYear(), new Date(`${dateRange.maxDate}T00:00:00`).getMonth() - 1, 1)
      : new Date(`${dateRange.maxDate}T00:00:00`);
    const [start, end] = monthBounds(toDateInput(baseDate));
    updateRange(start < dateRange.minDate ? dateRange.minDate : start, end > dateRange.maxDate ? dateRange.maxDate : end);
  }

  async function applyPayload(nextPayload, sourceLabel) {
    transactionDataset.set({
      transactions: nextPayload.transactions,
      categories: nextPayload.categories,
      sourceName: sourceLabel || "",
      notes: nextPayload.notes,
    });
    const dates = nextPayload.transactions.map((transaction) => transaction.date).filter(Boolean).sort();
    const minDate = dates[0] || "";
    const maxDate = dates[dates.length - 1] || "";
    if (maxDate) {
      const [start, end] = monthBounds(maxDate);
      startDate = start < minDate ? minDate : start;
      endDate = end > maxDate ? maxDate : end;
      selectedDateRange.set({ startDate, endDate });
    } else {
      startDate = "";
      endDate = "";
      selectedDateRange.set({ startDate: "", endDate: "" });
    }
    loadError = nextPayload.transactions.length ? "" : "No transactions found in the CSV";
    uploadStatus = sourceLabel ? `Loaded ${sourceLabel}` : "";
  }

  async function parseCsvFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      loadError = "Please drop a CSV file.";
      return;
    }
    isParsing = true;
    loadError = "";
    uploadStatus = `Parsing ${file.name} locally...`;
    try {
      const nextPayload = await parseTransactionCsv(file);
      await applyPayload(nextPayload, file.name);
    } catch (error) {
      loadError = error.message || String(error);
      uploadStatus = "";
    } finally {
      isParsing = false;
      isDragging = false;
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    isDragging = false;
    parseCsvFile(event.dataTransfer?.files?.[0]);
  }
</script>

<main class="mx-auto flex max-w-[1480px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
  <header class="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
    <div>
      <p class="eyebrow mb-3">Personal cash map</p>
      <h1 class="font-display text-5xl tracking-[-0.05em] text-ink sm:text-6xl">Where Did My Money Go?</h1>
      <p class="mt-3 max-w-2xl text-lg text-muted">
        Drop a transaction CSV to get local, browser-only insights into your financial behavior, spending rhythm, and cash flow.
      </p>
    </div>

    <div class="panel-card flex flex-wrap items-center gap-3 p-3">
      <label class="eyebrow" for="start-date">Range</label>
      <input
        id="start-date"
        class="control min-w-36 disabled:cursor-not-allowed disabled:opacity-50"
        type="date"
        bind:value={startDate}
        min={dateRange.minDate || undefined}
        max={endDate || dateRange.maxDate || undefined}
        disabled={!hasTransactions}
        onchange={(event) => updateRange(event.target.value, endDate)}
      />
      <span class="text-sm font-semibold text-muted">to</span>
      <input
        class="control min-w-36 disabled:cursor-not-allowed disabled:opacity-50"
        type="date"
        bind:value={endDate}
        min={startDate || dateRange.minDate || undefined}
        max={dateRange.maxDate || undefined}
        disabled={!hasTransactions}
        onchange={(event) => updateRange(startDate, event.target.value)}
      />

      <div class="flex flex-wrap gap-2">
        <button class="rounded-2xl border border-line bg-white/70 px-3 py-2 text-sm font-bold text-ink disabled:opacity-40" disabled={!hasTransactions} onclick={() => applyShortcut("this-month")}>This month</button>
        <button class="rounded-2xl border border-line bg-white/70 px-3 py-2 text-sm font-bold text-ink disabled:opacity-40" disabled={!hasTransactions} onclick={() => applyShortcut("last-month")}>Last month</button>
        <button class="rounded-2xl border border-line bg-white/70 px-3 py-2 text-sm font-bold text-ink disabled:opacity-40" disabled={!hasTransactions} onclick={() => applyShortcut("all")}>All data</button>
      </div>
    </div>
  </header>

  <section
    class={`panel-card border-dashed p-4 transition ${isDragging ? "border-clay bg-clay/10" : ""}`}
    role="button"
    tabindex="0"
    ondragover={(event) => {
      event.preventDefault();
      isDragging = true;
    }}
    ondragleave={() => {
      isDragging = false;
    }}
    ondrop={handleDrop}
  >
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="eyebrow">Local CSV import</p>
        <p class="mt-1 text-sm text-muted">
          Drag and drop a transaction export CSV here. It stays in this browser and is not uploaded to a server.
        </p>
        {#if uploadStatus}
          <p class="mt-2 text-sm font-semibold text-ink">{uploadStatus}</p>
        {/if}
      </div>
      <label class="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-ink px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-clay">
        {isParsing ? "Parsing..." : "Choose CSV"}
        <input
          class="hidden"
          type="file"
          accept=".csv,text/csv"
          onchange={(event) => parseCsvFile(event.target.files?.[0])}
        />
      </label>
    </div>
  </section>

  {#if loadError}
    <section class="panel-card p-8 text-clay">{loadError}</section>
  {:else if hasTransactions}
    <section class="panel-card p-4 sm:p-5">
      <CashTrend transactions={visibleTransactions} {startDate} {endDate} />
    </section>

    <section class="panel-card p-4 sm:p-5">
      <FlowChart graph={flowGraph} />
    </section>

    <section class="panel-card p-4 sm:p-5">
      <DailyHeatmap transactions={visibleTransactions} {startDate} {endDate} />
    </section>
  {:else}
    <section class="panel-card p-10 text-center">
      <p class="eyebrow">Clean start</p>
      <h2 class="mt-3 font-display text-3xl tracking-[-0.04em] text-ink">No transaction data loaded</h2>
      <p class="mx-auto mt-3 max-w-2xl text-muted">
        Choose or drop a CSV export above. The file is parsed locally in your browser, then the month selector and money-flow chart appear.
      </p>
    </section>
  {/if}
</main>
