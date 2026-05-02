<script>
  export let transactions = [];
  export let startDate = "";
  export let endDate = "";

  let metric = "spent";

  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  $: days = buildDays(startDate, endDate);
  $: valueByDate = aggregateByDate(transactions, metric);
  $: maxValue = Math.max(0, ...days.map((day) => valueByDate.get(day.date) || 0));
  $: months = groupDaysByMonth(days);
  $: totalValue = days.reduce((total, day) => total + (valueByDate.get(day.date) || 0), 0);

  function toDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDate(date) {
    return date ? new Date(`${date}T00:00:00`) : null;
  }

  function buildDays(start, end) {
    const first = parseDate(start);
    const last = parseDate(end);
    if (!first || !last || first > last) return [];

    const result = [];
    const current = new Date(first);
    while (current <= last) {
      result.push({
        date: toDateInput(current),
        day: current.getDate(),
        weekday: (current.getDay() + 6) % 7,
        monthKey: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`,
        monthLabel: current.toLocaleDateString("en-DE", { month: "long", year: "numeric" }),
      });
      current.setDate(current.getDate() + 1);
    }
    return result;
  }

  function aggregateByDate(items, selectedMetric) {
    const grouped = new Map();
    for (const transaction of items || []) {
      if (!transaction.date) continue;
      const value = selectedMetric === "count" ? 1 : Math.max(0, -Number(transaction.amount || 0));
      if (value <= 0) continue;
      grouped.set(transaction.date, (grouped.get(transaction.date) || 0) + value);
    }
    return grouped;
  }

  function groupDaysByMonth(dayItems) {
    const grouped = [];
    for (const day of dayItems) {
      let month = grouped[grouped.length - 1];
      if (!month || month.key !== day.monthKey) {
        month = {
          key: day.monthKey,
          label: day.monthLabel,
          leadingSlots: Array.from({ length: day.weekday }),
          days: [],
        };
        grouped.push(month);
      }
      month.days.push(day);
    }
    return grouped;
  }

  function intensity(value) {
    if (!value || !maxValue) return 0;
    const ratio = value / maxValue;
    if (ratio <= 0.2) return 1;
    if (ratio <= 0.45) return 2;
    if (ratio <= 0.7) return 3;
    return 4;
  }

  function cellClass(value) {
    return [
      "h-4 w-4 rounded-[4px] border border-emerald-950/5 transition hover:scale-110",
      ["bg-[#edf4ed]", "bg-[#bfe6c8]", "bg-[#7ccd8f]", "bg-[#36a85b]", "bg-[#166c35]"][intensity(value)],
    ].join(" ");
  }

  function valueLabel(value) {
    if (metric === "count") return `${value || 0} transaction${value === 1 ? "" : "s"}`;
    return new Intl.NumberFormat("en-DE", { style: "currency", currency: "EUR" }).format(value || 0);
  }
</script>

<div class="flex flex-col gap-5">
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <p class="eyebrow">Daily rhythm</p>
      <h2 class="mt-1 text-2xl font-bold tracking-[-0.03em] text-ink">Calendar heatmap</h2>
      <p class="mt-1 text-sm text-muted">
        {valueLabel(totalValue)} across {days.length} day{days.length === 1 ? "" : "s"} in the selected range.
      </p>
    </div>

    <div class="inline-flex rounded-2xl border border-line bg-white/70 p-1">
      <button
        class={`rounded-xl px-3 py-2 text-sm font-bold transition ${metric === "spent" ? "bg-ink text-white shadow-sm" : "text-muted hover:text-ink"}`}
        onclick={() => (metric = "spent")}
      >
        Spent volume
      </button>
      <button
        class={`rounded-xl px-3 py-2 text-sm font-bold transition ${metric === "count" ? "bg-ink text-white shadow-sm" : "text-muted hover:text-ink"}`}
        onclick={() => (metric = "count")}
      >
        Transactions
      </button>
    </div>
  </div>

  {#if months.length}
    <div class="overflow-x-auto pb-2">
      <div class="flex min-w-max gap-6">
        {#each months as month}
          <section class="rounded-2xl border border-line bg-white/55 p-3">
            <h3 class="mb-3 text-sm font-bold text-ink">{month.label}</h3>
            <div class="grid gap-1">
              <div class="grid grid-cols-7 gap-1 text-center text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted">
                {#each weekdayLabels as label}
                  <span>{label.slice(0, 1)}</span>
                {/each}
              </div>
              <div class="grid grid-cols-7 gap-1">
                {#each month.leadingSlots as _}
                  <span class="h-4 w-4" aria-hidden="true"></span>
                {/each}
                {#each month.days as day}
                  {@const value = valueByDate.get(day.date) || 0}
                  <span class={cellClass(value)} title={`${day.date}: ${valueLabel(value)}`} aria-label={`${day.date}: ${valueLabel(value)}`}></span>
                {/each}
              </div>
            </div>
          </section>
        {/each}
      </div>
    </div>

    <div class="flex items-center justify-end gap-2 text-xs font-semibold text-muted">
      <span>Less</span>
      {#each [0, 1, 2, 3, 4] as level}
        <span class={["h-3 w-3 rounded-[3px] border border-emerald-950/5", ["bg-[#edf4ed]", "bg-[#bfe6c8]", "bg-[#7ccd8f]", "bg-[#36a85b]", "bg-[#166c35]"][level]].join(" ")}></span>
      {/each}
      <span>More</span>
    </div>
  {:else}
    <p class="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">No days in the selected range.</p>
  {/if}
</div>
