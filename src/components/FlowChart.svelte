<script>
  import * as d3 from "d3";
  import { sankey, sankeyLinkHorizontal } from "d3-sankey";

  export let graph = { nodes: [], edges: [], roots: [], totals: { incoming: 0, outflow: 0, retained: 0 } };
  export let showPercentages = false;

  let chartEl;
  let expandedNodes = new Set();
  let activeNodeId = null;
  let panel = {
    title: "Flow details",
    value: 0,
    transactions: [],
  };

  $: if (graph && chartEl) {
    graph;
    showPercentages;
    expandedNodes;
    renderChart();
  }

  function euro(value) {
    return new Intl.NumberFormat("en-DE", { style: "currency", currency: "EUR" }).format(value || 0);
  }

  function percentage(value, total) {
    if (!total) return "0.0%";
    return new Intl.NumberFormat("en-DE", {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format((value || 0) / total);
  }

  function flowValue(value) {
    return showPercentages ? percentage(value, graph?.totals?.incoming || 0) : euro(value);
  }

  function linkSourceId(link) {
    return typeof link.source === "string" ? link.source : link.source.id;
  }

  function linkTargetId(link) {
    return typeof link.target === "string" ? link.target : link.target.id;
  }

  function nodeColumn(id) {
    return graph.nodes.find((node) => node.id === id)?.layoutColumn ?? 9;
  }

  function nodeOrder(id) {
    return graph.nodes.find((node) => node.id === id)?.sortOrder || 999_000;
  }

  function orderedNodeCompare(a, b) {
    return (
      d3.ascending(nodeColumn(a.id), nodeColumn(b.id)) ||
      d3.ascending(nodeOrder(a.id), nodeOrder(b.id)) ||
      d3.ascending(a.label, b.label)
    );
  }

  function orderedLinkCompare(a, b) {
    return orderedNodeCompare(a.target, b.target) || orderedNodeCompare(a.source, b.source);
  }

  function buildVisibleGraph(sourceGraph) {
    const nodeById = new Map(sourceGraph.nodes.map((node) => [node.id, node]));
    const outgoingBySource = new Map();
    const incomingByTarget = new Map();
    const visibleNodeIds = new Set();
    const visibleEdgeKeys = new Set();
    const visibleEdges = [];

    for (const edge of sourceGraph.edges) {
      const sourceId = linkSourceId(edge);
      const targetId = linkTargetId(edge);
      if (!outgoingBySource.has(sourceId)) outgoingBySource.set(sourceId, []);
      outgoingBySource.get(sourceId).push(edge);
      if (!incomingByTarget.has(targetId)) incomingByTarget.set(targetId, []);
      incomingByTarget.get(targetId).push(edge);
    }

    function addEdge(edge) {
      const key = `${linkSourceId(edge)}->${linkTargetId(edge)}`;
      if (visibleEdgeKeys.has(key)) return;
      visibleEdgeKeys.add(key);
      visibleEdges.push({ ...edge });
    }

    function shouldAutoExpand(node) {
      return node?.expandable !== false && Boolean(node?.autoExpand);
    }

    function expansionEdges(nodeId) {
      const node = nodeById.get(nodeId);
      if (node?.expansionDirection === "incoming") return incomingByTarget.get(nodeId) || [];
      return outgoingBySource.get(nodeId) || [];
    }

    function allocationEdges(nodeId) {
      const edges = outgoingBySource.get(nodeId) || [];
      const node = nodeById.get(nodeId);
      if (!sourceGraph.roots.includes(nodeId)) return [];
      if (node?.expansionDirection !== "incoming") return edges;
      return edges;
    }

    function visit(nodeId) {
      const node = nodeById.get(nodeId);
      if (!node || visibleNodeIds.has(nodeId)) return;
      visibleNodeIds.add(nodeId);

      for (const edge of allocationEdges(nodeId)) {
        addEdge(edge);
        visit(linkTargetId(edge));
      }

      if (node.expandable === false || (!shouldAutoExpand(node) && !expandedNodes.has(nodeId))) return;

      for (const edge of expansionEdges(nodeId)) {
        addEdge(edge);
        const nextId = node.expansionDirection === "incoming" ? linkSourceId(edge) : linkTargetId(edge);
        visit(nextId);
      }
    }

    const roots = sourceGraph.roots.length ? sourceGraph.roots : sourceGraph.nodes.map((node) => node.id);
    roots.forEach(visit);

    return {
      nodes: [...visibleNodeIds]
        .map((id) => {
          const node = nodeById.get(id);
          return {
            ...node,
            name: node.label,
            expanded: expandedNodes.has(id),
            expandable: node.expandable !== false && expansionEdges(id).length > 0,
          };
        })
        .sort(orderedNodeCompare),
      links: visibleEdges.map((edge) => ({
        ...edge,
        tx: edge.transactions || [],
      })),
    };
  }

  function setPanel(title, value, transactions) {
    panel = { title, value, transactions: transactions || [] };
  }

  function renderChart() {
    if (!graph || !chartEl) return;

    chartEl.innerHTML = "";
    const width = Math.max(chartEl.clientWidth || 900, 720);
    const height = 560;
    const visibleGraph = buildVisibleGraph(graph);

    if (!visibleGraph.nodes.length || !visibleGraph.links.length) {
      chartEl.innerHTML = '<div class="p-6 text-sm text-muted">No flow data for this range.</div>';
      panel = { title: "Flow details", value: 0, transactions: [] };
      return;
    }

    const compactColumnByLayoutColumn = new Map(
      [...new Set(visibleGraph.nodes.map((node) => node.layoutColumn ?? 0))]
        .sort((a, b) => a - b)
        .map((column, index) => [column, index]),
    );

    const layout = sankey()
      .nodeId((d) => d.id)
      .nodeWidth(20)
      .nodePadding(16)
      .nodeAlign((node, n) => Math.min(compactColumnByLayoutColumn.get(node.layoutColumn ?? 0) ?? 0, n - 1))
      .extent([
        [16, 18],
        [width - 16, height - 20],
      ])
      .nodeSort(orderedNodeCompare)
      .linkSort(orderedLinkCompare)
      .iterations(64);

    const { nodes, links } = layout({
      nodes: visibleGraph.nodes.map((node) => ({ ...node })),
      links: visibleGraph.links.map((link) => ({ ...link })),
    });

    const svg = d3.select(chartEl).append("svg").attr("viewBox", [0, 0, width, height]);

    svg
      .append("g")
      .attr("fill", "none")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("stroke", (d) => d.target.color || d.source.color || "#8a8178")
      .attr("stroke-opacity", 0.36)
      .attr("stroke-width", (d) => Math.max(1, d.width))
      .on("mouseenter click", (_, d) => setPanel(`${d.source.label} -> ${d.target.label}`, d.value, d.tx || []))
      .append("title")
      .text((d) => `${d.source.label} -> ${d.target.label}\n${flowValue(d.value)}`);

    const node = svg
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", (d) => (d.expandable && !d.autoExpand ? "pointer" : "default"))
      .on("mouseenter", (_, d) => setPanel(d.label, d.value, d.transactions || []))
      .on("click", (_, d) => {
        activeNodeId = d.id;
        if (!d.expandable || d.autoExpand) {
          setPanel(d.label, d.value, d.transactions || []);
          return;
        }
        expandedNodes = new Set(expandedNodes);
        if (expandedNodes.has(d.id)) expandedNodes.delete(d.id);
        else expandedNodes.add(d.id);
      });

    node
      .append("rect")
      .attr("x", (d) => d.x0)
      .attr("y", (d) => d.y0)
      .attr("height", (d) => Math.max(1, d.y1 - d.y0))
      .attr("width", (d) => d.x1 - d.x0)
      .attr("rx", 5)
      .attr("fill", (d) => d.color || "#8a8178")
      .attr("stroke", "#3b332c")
      .attr("stroke-opacity", 0.18);

    node
      .append("text")
      .attr("x", (d) => (d.x0 < width / 2 ? d.x1 + 10 : d.x0 - 10))
      .attr("y", (d) => (d.y0 + d.y1) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (d) => (d.x0 < width / 2 ? "start" : "end"))
      .attr("font-family", '"Avenir Next", "Helvetica Neue", sans-serif')
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .attr("fill", "#1f1a17")
      .text((d) => `${d.expandable && !d.autoExpand ? (d.expanded ? "- " : "+ ") : ""}${d.label} · ${flowValue(d.value)}`);

    const activeNode = activeNodeId ? nodes.find((node) => node.id === activeNodeId) : null;
    const firstNode = nodes.find((node) => node.id === "outflow") || nodes[0];
    const panelNode = activeNode || firstNode;
    if (panelNode) setPanel(panelNode.label, panelNode.value, panelNode.transactions || []);
  }
</script>

<div class="grid min-h-[580px] gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.75fr)]">
  <div class="overflow-hidden rounded-3xl border border-line bg-white/50 p-2">
    <div bind:this={chartEl} class="min-h-[560px] [&_svg]:block [&_svg]:h-[560px] [&_svg]:w-full"></div>
  </div>

  <aside class="rounded-3xl border border-line bg-[#fffaf1]/80 p-4">
    <p class="eyebrow mb-2">Details</p>
    <h2 class="text-xl font-bold text-ink">{panel.title}</h2>
    <p class="mt-1 text-sm text-muted">
      {#if showPercentages}
        {flowValue(panel.value)} of incoming cash
      {:else}
        {flowValue(panel.value)}
      {/if}
      · {panel.transactions.length} transaction{panel.transactions.length === 1 ? "" : "s"}
    </p>

    {#if panel.transactions.length}
      <div class="mt-4 max-h-[480px] overflow-auto rounded-2xl border border-line bg-white/70">
        <table class="transaction-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Counterparty</th>
              <th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            {#each [...panel.transactions].sort((a, b) => String(a.date).localeCompare(String(b.date))) as tx}
              <tr>
                <td>{tx.date || ""}</td>
                <td>
                  {tx.merchant || "Unknown"}
                  {#if tx.note}
                    <div class="mt-1 text-xs text-muted">{tx.note}</div>
                  {/if}
                </td>
                <td class="amount">{euro(tx.amount || 0)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="mt-4 rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
        No direct transactions. This node is calculated from linked categories.
      </p>
    {/if}
  </aside>
</div>
