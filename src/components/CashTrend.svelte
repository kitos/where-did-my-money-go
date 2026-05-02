<script>
  import * as d3 from "d3";

  export let transactions = [];
  export let startDate = "";
  export let endDate = "";

  const width = 1120;
  const height = 320;
  const margin = { top: 24, right: 28, bottom: 34, left: 76 };

  let currentCashValue = "";

  $: currentCash = parseCashInput(currentCashValue);
  $: points = buildCashSeries(transactions, startDate, endDate, currentCash);
  $: chart = buildChart(points);
  $: delta = points.length ? points[points.length - 1].balance - points[0].balance : 0;
  $: endingBalance = points.length ? points[points.length - 1].balance : 0;

  function parseDate(date) {
    return date ? new Date(`${date}T00:00:00`) : null;
  }

  function toDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseCashInput(value) {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function buildCashSeries(items, start, end, endingCashValue) {
    const first = parseDate(start);
    const last = parseDate(end);
    if (!first || !last || first > last) return [];

    const dailyNet = new Map();
    for (const transaction of items || []) {
      if (!transaction.date) continue;
      dailyNet.set(transaction.date, (dailyNet.get(transaction.date) || 0) + Number(transaction.amount || 0));
    }

    const rawPoints = [];
    let runningNet = 0;
    const current = new Date(first);
    while (current <= last) {
      const date = toDateInput(current);
      const net = dailyNet.get(date) || 0;
      runningNet += net;
      rawPoints.push({
        date,
        dateValue: new Date(current),
        net,
        runningNet,
      });
      current.setDate(current.getDate() + 1);
    }

    const endingNet = rawPoints[rawPoints.length - 1]?.runningNet || 0;
    const offset = endingCashValue === null ? 0 : endingCashValue - endingNet;
    return rawPoints.map((point) => ({
      ...point,
      balance: offset + point.runningNet,
    }));
  }

  function buildChart(series) {
    if (!series.length) return null;

    const balances = series.map((point) => point.balance);
    const minBalance = Math.min(0, ...balances);
    const maxBalance = Math.max(0, ...balances);
    const yPadding = Math.max((maxBalance - minBalance) * 0.12, 50);

    const x = d3
      .scaleTime()
      .domain(d3.extent(series, (point) => point.dateValue))
      .range([margin.left, width - margin.right]);
    const y = d3
      .scaleLinear()
      .domain([minBalance - yPadding, maxBalance + yPadding])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const line = d3
      .line()
      .x((point) => x(point.dateValue))
      .y((point) => y(point.balance))
      .curve(d3.curveMonotoneX);
    const area = d3
      .area()
      .x((point) => x(point.dateValue))
      .y0(y(0))
      .y1((point) => y(point.balance))
      .curve(d3.curveMonotoneX);

    return {
      path: line(series),
      area: area(series),
      zeroY: y(0),
      xTicks: x.ticks(Math.min(6, series.length)),
      yTicks: y.ticks(5),
      x,
      y,
    };
  }

  function euro(value) {
    return new Intl.NumberFormat("en-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value || 0);
  }

  function compactDate(date) {
    return date.toLocaleDateString("en-DE", { day: "2-digit", month: "short" });
  }
</script>

<div class="flex flex-col gap-5">
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <p class="eyebrow">Cash trend</p>
      <h2 class="mt-1 text-2xl font-bold tracking-[-0.03em] text-ink">Net cash over time</h2>
      <p class="mt-1 text-sm text-muted">
        Cumulative signed cash movement for the selected range.
      </p>
    </div>

    <div class="flex flex-wrap items-end gap-3">
      <label class="grid gap-1">
        <span class="text-xs font-bold uppercase tracking-[0.16em] text-muted">Current cash</span>
        <input
          class="control w-44 bg-white/70 text-right"
          type="number"
          inputmode="decimal"
          placeholder="optional"
          bind:value={currentCashValue}
        />
      </label>

      <div class={`rounded-2xl border px-4 py-3 text-right ${delta >= 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
        <p class="text-xs font-bold uppercase tracking-[0.16em] opacity-70">Range delta</p>
        <p class="text-2xl font-black tracking-[-0.04em]">{delta >= 0 ? "+" : ""}{euro(delta)}</p>
      </div>
    </div>
  </div>

  {#if chart}
    <div class="overflow-hidden rounded-3xl border border-line bg-white/55 p-3">
      <svg class="block h-[320px] w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Cumulative net cash line chart">
        <defs>
          <linearGradient id="cash-trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#36a85b" stop-opacity="0.24" />
            <stop offset="100%" stop-color="#36a85b" stop-opacity="0.02" />
          </linearGradient>
        </defs>

        <line x1={margin.left} x2={width - margin.right} y1={chart.zeroY} y2={chart.zeroY} stroke="#ded4c6" stroke-width="1.5" stroke-dasharray="5 6" />

        {#each chart.yTicks as tick}
          <g>
            <line x1={margin.left} x2={width - margin.right} y1={chart.y(tick)} y2={chart.y(tick)} stroke="#ede4d7" />
            <text x={margin.left - 12} y={chart.y(tick)} dy="0.35em" text-anchor="end" class="fill-muted text-[11px] font-semibold">{euro(tick)}</text>
          </g>
        {/each}

        <path d={chart.area} fill="url(#cash-trend-fill)" />
        <path d={chart.path} fill="none" stroke={delta >= 0 ? "#21824a" : "#bd5b43"} stroke-width="2.25" stroke-linecap="round" />

        {#each points as point, index}
          {#if index === 0 || index === points.length - 1 || Math.abs(point.net) > 0}
            <circle cx={chart.x(point.dateValue)} cy={chart.y(point.balance)} r={Math.abs(point.net) > 0 ? 2.6 : 1.8} fill={point.net >= 0 ? "#21824a" : "#bd5b43"}>
              <title>{point.date}: balance {euro(point.balance)}, daily net {point.net >= 0 ? "+" : ""}{euro(point.net)}</title>
            </circle>
          {/if}
        {/each}

        {#each chart.xTicks as tick}
          <text x={chart.x(tick)} y={height - 8} text-anchor="middle" class="fill-muted text-[11px] font-semibold">{compactDate(tick)}</text>
        {/each}
      </svg>
    </div>
    {#if currentCash === null}
      <p class="text-xs text-muted">Without current cash, the line is relative and starts from the selected range only. Enter current cash to estimate actual balances.</p>
    {:else}
      <p class="text-xs text-muted">Ending balance is anchored at {euro(endingBalance)}; earlier points are calculated backwards from daily net changes.</p>
    {/if}
  {:else}
    <p class="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">No cash trend data for this range.</p>
  {/if}
</div>
