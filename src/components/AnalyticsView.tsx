import React, { useMemo, useState } from "react";
import { useInspectorStore } from "../store/useInspectorStore";
import {
  Activity,
  CheckCircle,
  XCircle,
  BarChart3,
  PieChart,
  Zap,
  Globe,
  Trash2,
  TrendingUp,
  AlertTriangle,
  Monitor,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import { cn } from "../lib/utils";

type TimeRange = "30m" | "1h" | "6h" | "all";

const TIME_LABELS: Record<TimeRange, string> = {
  "30m": "30m",
  "1h": "1h",
  "6h": "6h",
  all: "All",
};
const TIME_MS: Record<TimeRange, number> = {
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  all: Infinity,
};

const METHOD_COLORS: Record<string, string> = {
  GET: "#22c55e",
  POST: "#3b82f6",
  PUT: "#eab308",
  PATCH: "#a855f7",
  DELETE: "#ef4444",
  HEAD: "#52525b",
  OPTIONS: "#52525b",
};
const STATUS_COLORS: Record<string, string> = {
  "200": "#22c55e",
  "201": "#22c55e",
  "204": "#22c55e",
  "301": "#3b82f6",
  "302": "#3b82f6",
  "304": "#3b82f6",
  "400": "#eab308",
  "401": "#f97316",
  "403": "#f97316",
  "404": "#f97316",
  "422": "#eab308",
  "500": "#ef4444",
  "502": "#ef4444",
  "503": "#ef4444",
};
const TUNNEL_COLORS = [
  "#f97316",
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#eab308",
  "#ec4899",
];

// ─── Helper Components ────────────────────────────────────────────────────────

function EmptyChart({
  label = "Enable Web Inspector and start a tunnel to collect data.",
}: {
  label?: string;
}) {
  return (
    <div className="flex items-center justify-center h-full text-[#52525b] text-xs text-center px-4">
      {label}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  valueClass = "text-white",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-[#0c0c0e] border border-[#27272a] rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[#52525b] text-[10px] font-bold uppercase tracking-wider">
        {icon} {label}
      </div>
      <div
        className={cn("text-3xl font-black font-mono leading-none", valueClass)}
      >
        {value}
      </div>
      <div className="text-[10px] text-[#3f3f46]">{sub}</div>
    </div>
  );
}

function EndpointBar({
  rank,
  path,
  count,
  total,
  color,
}: {
  rank: number;
  path: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-mono text-[#3f3f46] w-4 text-right shrink-0">
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-mono text-[#e4e4e7] truncate max-w-[75%]">
            {path}
          </span>
          <span
            className="text-[10px] font-bold font-mono ml-2 shrink-0"
            style={{ color }}
          >
            {count}
          </span>
        </div>
        <div className="h-1 bg-[#27272a] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.75 }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AnalyticsView() {
  const { logs, clearLogs } = useInspectorStore();
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [confirmClear, setConfirmClear] = useState(false);

  // Filter logs by selected time range
  const filteredLogs = useMemo(() => {
    if (timeRange === "all") return logs;
    const cutoff = Date.now() - TIME_MS[timeRange];
    return logs.filter((l) => new Date(l.timestamp).getTime() >= cutoff);
  }, [logs, timeRange]);

  // Aggregate all stats from filtered logs
  const stats = useMemo(() => {
    let total = 0,
      success = 0,
      error = 0,
      recentRequests = 0;
    const methodCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};
    const endpointCounts: Record<string, number> = {};
    const errorEndpointCounts: Record<string, number> = {};
    const timeSeries: Record<string, number> = {};
    const tunnelCounts: Record<string, number> = {};
    const agentCounts: Record<string, number> = {};
    const now = Date.now();

    filteredLogs.forEach((log) => {
      if (!log.request) return;
      total++;

      // Req/min — count requests in the last 60s
      if (now - new Date(log.timestamp).getTime() < 60_000) recentRequests++;

      // HTTP method
      const method = log.request.method.toUpperCase();
      methodCounts[method] = (methodCounts[method] || 0) + 1;

      // Per-tunnel
      if (log.tunnel_name) {
        tunnelCounts[log.tunnel_name] =
          (tunnelCounts[log.tunnel_name] || 0) + 1;
      }

      // User-agent — bucket into known clients
      const rawUa = (
        log.request.headers?.["user-agent"] ||
        log.request.headers?.["User-Agent"] ||
        ""
      ).toLowerCase();
      let agent = "Other";
      if (rawUa.includes("postman")) agent = "Postman";
      else if (rawUa.includes("insomnia")) agent = "Insomnia";
      else if (rawUa.includes("curl")) agent = "cURL";
      else if (
        rawUa.includes("python-httpx") ||
        rawUa.includes("python-requests")
      )
        agent = "Python";
      else if (
        rawUa.includes("axios") ||
        rawUa.includes("node-fetch") ||
        rawUa.includes("got")
      )
        agent = "Node.js";
      else if (rawUa.includes("edg/")) agent = "Edge";
      else if (rawUa.includes("firefox/")) agent = "Firefox";
      else if (rawUa.includes("chrome/")) agent = "Chrome";
      else if (rawUa.includes("safari/")) agent = "Safari";
      if (rawUa) agentCounts[agent] = (agentCounts[agent] || 0) + 1;

      // Base path (first 2 segments, strip query)
      const rawPath = log.request.path.split("?")[0];
      const parts = rawPath.split("/").filter(Boolean);
      const basePath =
        parts.length === 0 ? "/" : "/" + parts.slice(0, 2).join("/");
      endpointCounts[basePath] = (endpointCounts[basePath] || 0) + 1;

      // Response-level aggregation
      if (log.response) {
        const status = log.response.status;
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        if (status >= 200 && status < 400) success++;
        if (status >= 400) {
          error++;
          errorEndpointCounts[basePath] =
            (errorEndpointCounts[basePath] || 0) + 1;
        }
      }

      // Time series — group by HH:MM
      const d = new Date(log.timestamp);
      const key = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
      timeSeries[key] = (timeSeries[key] || 0) + 1;
    });

    return {
      total,
      success,
      error,
      recentRequests,
      uniqueEndpoints: Object.keys(endpointCounts).length,

      timeData: Object.entries(timeSeries)
        .map(([time, requests]) => ({ time, requests }))
        .sort((a, b) => a.time.localeCompare(b.time)),

      methodData: Object.entries(methodCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value })),

      statusData: Object.entries(statusCounts)
        .map(([name, value]) => ({ name: String(name), value }))
        .sort((a, b) => Number(a.name) - Number(b.name)),

      tunnelData: Object.entries(tunnelCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),

      topEndpoints: Object.entries(endpointCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([path, count]) => ({ path, count })),

      topErrors: Object.entries(errorEndpointCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([path, count]) => ({ path, count })),

      agentData: Object.entries(agentCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value })),
    };
  }, [filteredLogs]);

  const successRate =
    stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0;
  const errorRate =
    stats.total > 0 ? Math.round((stats.error / stats.total) * 100) : 0;

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] text-[#e4e4e7] overflow-y-auto">
      <div className="flex flex-col max-w-5xl w-full mx-auto">
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 bg-[#09090b]/95 backdrop-blur-md h-16 px-6 border-b border-[#27272a] flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#52525b] flex items-center gap-2 mb-0.5">
              <BarChart3 className="w-4 h-4 text-orange-500" /> Traffic
              Analytics
            </h2>
            <p className="text-[#3f3f46] text-[10px]">
              {stats.total > 0
                ? `${stats.total} requests captured · ${filteredLogs.length} in selected range`
                : "Real-time dashboard for local tunnel requests"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Time-range pill */}
            <div className="flex items-center gap-0.5 bg-[#18181b] border border-[#27272a] rounded-lg p-1">
              {(["30m", "1h", "6h", "all"] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={cn(
                    "px-3 py-1 rounded-md text-[10px] font-bold transition-all",
                    timeRange === r
                      ? "bg-orange-500 text-white shadow-sm"
                      : "text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#27272a]",
                  )}
                >
                  {TIME_LABELS[r]}
                </button>
              ))}
            </div>

            {/* Clear button */}
            {logs.length > 0 && (
              <button
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1.5 text-[10px] text-[#52525b] hover:text-red-400 font-bold transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Clear confirmation */}
        {confirmClear && (
          <div className="mx-6 mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between gap-4">
            <span className="text-sm text-red-400">
              Clear all <strong>{logs.length}</strong> inspector logs? This
              cannot be undone.
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmClear(false)}
                className="px-3 py-1.5 text-xs font-bold bg-[#27272a] text-[#a1a1aa] rounded-lg hover:bg-[#3f3f46] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearLogs();
                  setConfirmClear(false);
                }}
                className="px-3 py-1.5 text-xs font-bold bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 border border-red-500/20 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        <div className="p-6 flex flex-col gap-6">
          {/* ── Row 1: KPI Scorecards ── */}
          <div className="grid grid-cols-5 gap-3">
            <StatCard
              icon={<Activity className="w-4 h-4 text-blue-500" />}
              label="Total Req"
              value={stats.total.toLocaleString()}
              sub="captured"
              valueClass="text-white"
            />
            <StatCard
              icon={<CheckCircle className="w-4 h-4 text-green-500" />}
              label="Success"
              value={`${successRate}%`}
              sub={`${stats.success} req`}
              valueClass="text-green-500"
            />
            <StatCard
              icon={<XCircle className="w-4 h-4 text-red-500" />}
              label="Errors"
              value={`${errorRate}%`}
              sub={`${stats.error} req`}
              valueClass={errorRate > 0 ? "text-red-500" : "text-white"}
            />
            <StatCard
              icon={<Zap className="w-4 h-4 text-yellow-500" />}
              label="Req / Min"
              value={stats.recentRequests.toString()}
              sub="last 60s"
              valueClass={
                stats.recentRequests > 0 ? "text-yellow-400" : "text-white"
              }
            />
            <StatCard
              icon={<Globe className="w-4 h-4 text-purple-500" />}
              label="Endpoints"
              value={stats.uniqueEndpoints.toString()}
              sub="unique paths"
              valueClass="text-white"
            />
          </div>

          {/* ── Row 2: Requests Over Time + HTTP Methods ── */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 bg-[#0c0c0e] border border-[#27272a] rounded-xl p-5 flex flex-col">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1aa] mb-4 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-orange-500" /> Requests
                Over Time
              </h3>
              <div className="flex-1 w-full h-[220px]">
                {stats.timeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={stats.timeData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="5%"
                            stopColor="#f97316"
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="95%"
                            stopColor="#f97316"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="time"
                        stroke="#3f3f46"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#3f3f46"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          borderColor: "#27272a",
                          borderRadius: "10px",
                          fontSize: "12px",
                        }}
                        itemStyle={{ color: "#f97316" }}
                        labelStyle={{ color: "#a1a1aa" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="requests"
                        stroke="#f97316"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#aGrad)"
                        dot={false}
                        activeDot={{ r: 4, fill: "#f97316" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </div>

            {/* HTTP Methods — horizontal progress bars */}
            <div className="bg-[#0c0c0e] border border-[#27272a] rounded-xl p-5 flex flex-col">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1aa] mb-5">
                HTTP Methods
              </h3>
              {stats.methodData.length > 0 ? (
                <div className="flex flex-col gap-3 justify-center flex-1">
                  {stats.methodData.map(({ name, value }) => {
                    const color = METHOD_COLORS[name] || "#a1a1aa";
                    const pct =
                      stats.total > 0 ? (value / stats.total) * 100 : 0;
                    return (
                      <div key={name} className="flex items-center gap-2.5">
                        <span
                          className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded w-16 text-center shrink-0"
                          style={{ backgroundColor: `${color}1a`, color }}
                        >
                          {name}
                        </span>
                        <div className="flex-1 h-1.5 bg-[#27272a] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-[#71717a] w-8 text-right tabular-nums shrink-0">
                          {value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyChart />
              )}
            </div>
          </div>

          {/* ── Row 3: Status Codes + Requests per Tunnel ── */}
          <div className="grid grid-cols-3 gap-4">
            {/* Status codes donut */}
            <div className="bg-[#0c0c0e] border border-[#27272a] rounded-xl p-5 flex flex-col">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1aa] mb-3 flex items-center gap-2">
                <PieChart className="w-3.5 h-3.5" /> Status Codes
              </h3>
              <div className="flex-1 w-full h-[220px]">
                {stats.statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={stats.statusData}
                        cx="50%"
                        cy="45%"
                        innerRadius={48}
                        outerRadius={68}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {stats.statusData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={STATUS_COLORS[entry.name] || "#71717a"}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          borderColor: "#27272a",
                          borderRadius: "10px",
                          fontSize: "12px",
                        }}
                        formatter={(v: any, n: any) => [v, `HTTP ${n}`]}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        wrapperStyle={{ fontSize: "10px", color: "#71717a" }}
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </div>

            {/* Requests per Tunnel — horizontal bar chart */}
            <div className="col-span-2 bg-[#0c0c0e] border border-[#27272a] rounded-xl p-5 flex flex-col">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1aa] mb-3">
                Requests per Tunnel
              </h3>
              <div className="flex-1 w-full h-[220px]">
                {stats.tunnelData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.tunnelData}
                      layout="vertical"
                      margin={{ top: 5, right: 16, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#27272a"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        stroke="#3f3f46"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="#3f3f46"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        width={110}
                        tick={{ fill: "#a1a1aa" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          borderColor: "#27272a",
                          borderRadius: "10px",
                          fontSize: "12px",
                        }}
                        itemStyle={{ color: "#f97316" }}
                        labelStyle={{ color: "#a1a1aa" }}
                        cursor={{ fill: "#27272a40" }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {stats.tunnelData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={TUNNEL_COLORS[i % TUNNEL_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </div>
          </div>

          {/* ── Row 4: Top Endpoints + Top Error Endpoints ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0c0c0e] border border-[#27272a] rounded-xl p-5">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1aa] mb-4 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-green-500" /> Top
                Endpoints
              </h3>
              <div className="flex flex-col gap-3">
                {stats.topEndpoints.length > 0 ? (
                  stats.topEndpoints.map(({ path, count }, i) => (
                    <React.Fragment key={i}>
                      <EndpointBar
                        rank={i + 1}
                        path={path}
                        count={count}
                        total={stats.total}
                        color="#f97316"
                      />
                    </React.Fragment>
                  ))
                ) : (
                  <div className="text-center py-8 text-[#52525b] text-xs">
                    No data yet.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#0c0c0e] border border-[#27272a] rounded-xl p-5">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1aa] mb-4 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Error
                Endpoints
              </h3>
              <div className="flex flex-col gap-3">
                {stats.topErrors.length > 0 ? (
                  stats.topErrors.map(({ path, count }, i) => (
                    <React.Fragment key={i}>
                      <EndpointBar
                        rank={i + 1}
                        path={path}
                        count={count}
                        total={stats.error}
                        color="#ef4444"
                      />
                    </React.Fragment>
                  ))
                ) : (
                  <div className="text-center py-8 text-[#52525b] text-xs">
                    {stats.total === 0
                      ? "No data yet."
                      : "✓ No errors recorded"}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Row 5: User Agent / Client breakdown ── */}
          {stats.agentData.length > 0 && (
            <div className="bg-[#0c0c0e] border border-[#27272a] rounded-xl p-5">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1aa] mb-4 flex items-center gap-2">
                <Monitor className="w-3.5 h-3.5 text-blue-500" /> Client / User
                Agent
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {stats.agentData.map(({ name, value }) => {
                  const pct =
                    stats.total > 0
                      ? Math.round((value / stats.total) * 100)
                      : 0;
                  return (
                    <div
                      key={name}
                      className="flex flex-col items-center gap-1.5 p-4 bg-[#18181b] rounded-xl border border-[#27272a] text-center"
                    >
                      <div className="text-2xl font-black font-mono text-white tabular-nums">
                        {value}
                      </div>
                      <div className="text-[11px] font-bold text-[#a1a1aa]">
                        {name}
                      </div>
                      <div className="text-[10px] text-[#3f3f46]">{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
