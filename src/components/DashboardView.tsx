import React, { useMemo, useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard,
  Plug,
  FolderSearch,
  Share2,
  Activity,
  XCircle,
  CheckCircle,
  Square,
  ArrowRight,
  Wifi,
  WifiOff,
  BarChart3,
  Copy,
  RefreshCw,
  Heart,
  Loader2,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { useTunnelStore } from "../store/useTunnelStore";
import { useInspectorStore } from "../store/useInspectorStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useTunnelHealthStore } from "../store/useTunnelHealthStore";
import { cn } from "../lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Tab =
  | "manual"
  | "presets"
  | "projects"
  | "tunnels"
  | "share"
  | "inspector"
  | "analytics"
  | "settings"
  | "about"
  | "dashboard";

interface Props {
  setActiveTab: (tab: Tab) => void;
}

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Evening";
}

function formatUptime(startedAt?: number, now: number = Date.now()): string {
  if (!startedAt) return "";
  const secs = Math.floor((now - startedAt) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

export function DashboardView({ setActiveTab }: Props) {
  const { activeProcesses, stopTunnel, restartTunnel } = useTunnelStore();
  const { records: healthRecords } = useTunnelHealthStore();
  const { logs } = useInspectorStore();
  const { cloudflaredPath } = useSettingsStore();
  const [username, setUsername] = useState("Developer");
  const [now, setNow] = useState(Date.now());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pingState, setPingState] = useState<
    Record<
      string,
      {
        loading: boolean;
        ok?: boolean;
        status?: number;
        latency?: number;
        error?: string;
      }
    >
  >({});
  const [restartingId, setRestartingId] = useState<string | null>(null);

  const runningTunnels = Object.entries(activeProcesses).filter(
    ([, p]) => p.status === "running" || p.status === "starting",
  );

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if ((window as any).__TAURI_INTERNALS__) {
      import("@tauri-apps/api/core").then(({ invoke }) => {
        invoke<string>("get_username")
          .then((name) => {
            if (name) setUsername(name.charAt(0).toUpperCase() + name.slice(1));
          })
          .catch(() => {});
      });
    }
  }, []);

  const stats = useMemo(() => {
    let total = 0,
      success = 0,
      error = 0;
    const timeSeries: Record<string, number> = {};

    logs.forEach((log) => {
      if (!log.request) return;
      total++;
      if (log.response) {
        if (log.response.status >= 200 && log.response.status < 400) success++;
        if (log.response.status >= 400) error++;
      }
      const date = new Date(log.timestamp);
      const key = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
      timeSeries[key] = (timeSeries[key] || 0) + 1;
    });

    const timeData = Object.entries(timeSeries)
      .map(([time, requests]) => ({ time, requests }))
      .sort((a, b) => a.time.localeCompare(b.time))
      .slice(-20);

    const successRate = total > 0 ? Math.round((success / total) * 100) : 0;
    const errorRate = total > 0 ? Math.round((error / total) * 100) : 0;

    return { total, success, error, successRate, errorRate, timeData };
  }, [logs]);

  const requestsByTunnel = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach((log) => {
      if (log.tunnel_name) {
        map[log.tunnel_name] = (map[log.tunnel_name] || 0) + 1;
      }
    });
    return map;
  }, [logs]);

  const handleCopy = useCallback((id: string, domain: string) => {
    const url = domain.startsWith("http") ? domain : `https://${domain}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1800);
      })
      .catch(() => {});
  }, []);

  const handlePing = useCallback(async (id: string, domain: string) => {
    setPingState((s) => ({ ...s, [id]: { loading: true } }));
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import("@tauri-apps/api/core");
        const url = domain.startsWith("http") ? domain : `https://${domain}`;
        const result: { status: number; ok: boolean; latency_ms: number } =
          await invoke("ping_url", { url });
        setPingState((s) => ({
          ...s,
          [id]: {
            loading: false,
            ok: result.ok,
            status: result.status,
            latency: result.latency_ms,
          },
        }));
      } else {
        setPingState((s) => ({
          ...s,
          [id]: { loading: false, error: "Not in Tauri" },
        }));
      }
    } catch (e: any) {
      setPingState((s) => ({
        ...s,
        [id]: { loading: false, error: String(e).slice(0, 40) },
      }));
    }
  }, []);

  const handleRestart = useCallback(
    async (id: string) => {
      setRestartingId(id);
      try {
        await restartTunnel(id);
      } finally {
        setRestartingId(null);
      }
    },
    [restartTunnel],
  );

  return (
    <div className="flex flex-col h-full w-full bg-[#050505] text-[#e4e4e7] overflow-y-auto overflow-x-hidden relative">
      {/* Background glow */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-orange-500/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="flex flex-col max-w-5xl w-full mx-auto relative z-10">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-[#050505]/80 backdrop-blur-xl h-16 px-8 border-b border-[#27272a]/50 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2 mb-1">
              <LayoutDashboard className="w-4 h-4 text-orange-500" />
              Dashboard
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {runningTunnels.length > 0 ? (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-[10px] font-bold text-green-400">
                  {runningTunnels.length} TUNNEL
                  {runningTunnels.length > 1 ? "S" : ""} ACTIVE
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#27272a]/50 border border-[#27272a]">
                <span className="h-2 w-2 rounded-full bg-[#52525b]"></span>
                <span className="text-[10px] font-bold text-[#52525b]">
                  IDLE
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="px-8 py-8 flex flex-col gap-8">
          {/* Greeting */}
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight mb-1">
              {getGreeting()}, {username} 👋
            </h1>
            <p className="text-sm text-[#52525b]">
              Here's what's happening with your tunnels and traffic today.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => setActiveTab("manual")}
              className="group bg-[#0c0c0e] border border-[#27272a]/50 hover:border-orange-500/40 rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(249,115,22,0.15)] hover:-translate-y-1"
            >
              <div className="w-11 h-11 rounded-xl bg-orange-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plug className="w-5 h-5 text-orange-500" />
              </div>
              <h3 className="font-bold text-[#e4e4e7] text-sm mb-1">
                Manual Tunnel
              </h3>
              <p className="text-xs text-[#52525b] leading-relaxed">
                Expose any local port instantly via URL or domain
              </p>
              <div className="flex items-center gap-1 mt-4 text-orange-500 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                Start <ArrowRight className="w-3 h-3" />
              </div>
            </button>

            <button
              onClick={() => setActiveTab("projects")}
              className="group bg-[#0c0c0e] border border-[#27272a]/50 hover:border-blue-500/40 rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.15)] hover:-translate-y-1"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FolderSearch className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="font-bold text-[#e4e4e7] text-sm mb-1">
                Local Projects
              </h3>
              <p className="text-xs text-[#52525b] leading-relaxed">
                Auto-discover React, Laravel & WordPress projects
              </p>
              <div className="flex items-center gap-1 mt-4 text-blue-500 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                Browse <ArrowRight className="w-3 h-3" />
              </div>
            </button>

            <button
              onClick={() => setActiveTab("share")}
              className="group bg-[#0c0c0e] border border-[#27272a]/50 hover:border-purple-500/40 rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.15)] hover:-translate-y-1"
            >
              <div className="w-11 h-11 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Share2 className="w-5 h-5 text-purple-500" />
              </div>
              <h3 className="font-bold text-[#e4e4e7] text-sm mb-1">
                Quick Share
              </h3>
              <p className="text-xs text-[#52525b] leading-relaxed">
                Share any folder publicly as a static file server
              </p>
              <div className="flex items-center gap-1 mt-4 text-purple-500 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                Share <ArrowRight className="w-3 h-3" />
              </div>
            </button>
          </div>

          {/* Active Tunnels */}
          <div className="bg-[#0c0c0e]/80 border border-[#27272a]/50 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#27272a]/50 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#a1a1aa] flex items-center gap-2">
                <Wifi className="w-4 h-4 text-orange-500" /> Active Tunnels
              </h2>
              <button
                onClick={() => setActiveTab("manual")}
                className="text-[10px] text-[#52525b] hover:text-orange-500 transition-colors font-bold flex items-center gap-1"
              >
                View All <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {runningTunnels.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-4">
                <WifiOff className="w-10 h-10 text-[#27272a]" />
                <div className="text-center">
                  <p className="text-sm text-[#52525b] font-medium">
                    No active tunnels
                  </p>
                  <p className="text-xs text-[#3f3f46] mt-1">
                    Start a tunnel to expose your local environment
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("manual")}
                  className="px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-bold rounded-xl transition-all border border-orange-500/20 hover:border-orange-500/40 cursor-pointer"
                >
                  + Start New Tunnel
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#27272a]/50">
                {runningTunnels.map(([id, proc]) => (
                  <div
                    key={id}
                    className="px-6 py-4 flex flex-col gap-2 hover:bg-[#18181b]/30 transition-colors"
                  >
                    {/* Top row: status dot + name/url + action buttons */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="relative flex h-3 w-3 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-bold text-white truncate">
                              {proc.config.name || id}
                            </div>
                            {/* Request count badge */}
                            {(requestsByTunnel[id] || 0) > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 tabular-nums">
                                {requestsByTunnel[id]} req
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#52525b] font-mono truncate mt-0.5">
                            {proc.config.localUrl ||
                              proc.config.localVhost ||
                              `localhost`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {proc.startedAt && (
                          <div className="flex items-center gap-1.5 text-[10px] font-mono bg-[#18181b] border border-[#27272a] px-2.5 py-1 rounded-lg">
                            <span className="text-[#52525b]">⏱</span>
                            <span className="text-[#a1a1aa] tabular-nums">
                              {formatUptime(proc.startedAt, now)}
                            </span>
                          </div>
                        )}
                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md",
                            proc.status === "running"
                              ? "bg-green-500/10 text-green-400"
                              : "bg-yellow-500/10 text-yellow-400",
                          )}
                        >
                          {proc.status}
                        </span>
                        {/* Health auto-monitor badge */}
                        {(() => {
                          const hr = healthRecords[id];
                          if (!hr || hr.status === "unknown") return null;
                          if (hr.status === "ok")
                            return (
                              <div
                                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 font-mono"
                                title={`Health check OK · HTTP ${hr.httpStatus} · last checked ${hr.lastCheckedAt ? new Date(hr.lastCheckedAt).toLocaleTimeString() : "–"}`}
                              >
                                <ShieldCheck className="w-3 h-3" />
                                {hr.latencyMs}ms
                              </div>
                            );
                          return (
                            <div
                              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 font-bold animate-pulse"
                              title={`Tunnel DOWN · ${hr.consecutiveFailures} consecutive failures · since ${hr.downSince ? new Date(hr.downSince).toLocaleTimeString() : "–"}`}
                            >
                              <ShieldOff className="w-3 h-3" />
                              DOWN
                            </div>
                          );
                        })()}
                        {/* Restart button */}
                        <button
                          onClick={() => handleRestart(id)}
                          disabled={restartingId === id}
                          title="Restart tunnel"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-bold rounded-lg transition-all border border-orange-500/20 hover:border-orange-500/40 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RefreshCw
                            className={cn(
                              "w-3 h-3",
                              restartingId === id && "animate-spin",
                            )}
                          />
                        </button>
                        {/* Stop button */}
                        <button
                          onClick={() => stopTunnel(id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg transition-all border border-red-500/20 hover:border-red-500/40 cursor-pointer"
                        >
                          <Square className="w-3 h-3 fill-current" /> Stop
                        </button>
                      </div>
                    </div>
                    {/* Bottom row: public domain + copy + ping */}
                    {proc.config.publicDomain && (
                      <div className="flex items-center gap-2 pl-7">
                        <span className="text-[10px] font-mono text-green-400/70 bg-green-500/10 px-2 py-1 rounded-md truncate max-w-[240px]">
                          {proc.config.publicDomain}
                        </span>
                        {/* Copy URL button */}
                        <button
                          onClick={() =>
                            handleCopy(id, proc.config.publicDomain)
                          }
                          title="Copy public URL"
                          className="flex items-center gap-1 px-2 py-1 bg-[#18181b] hover:bg-[#27272a] text-[#52525b] hover:text-[#a1a1aa] text-[10px] font-bold rounded-md transition-all border border-[#27272a] cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          {copiedId === id ? (
                            <span className="text-green-400">Copied!</span>
                          ) : (
                            <span>Copy</span>
                          )}
                        </button>
                        {/* Ping button */}
                        <button
                          onClick={() =>
                            handlePing(id, proc.config.publicDomain)
                          }
                          disabled={pingState[id]?.loading}
                          title="Health check"
                          className="flex items-center gap-1 px-2 py-1 bg-[#18181b] hover:bg-[#27272a] text-[#52525b] hover:text-[#a1a1aa] text-[10px] font-bold rounded-md transition-all border border-[#27272a] cursor-pointer disabled:opacity-50"
                        >
                          {pingState[id]?.loading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Heart className="w-3 h-3" />
                          )}
                          <span>Ping</span>
                        </button>
                        {/* Ping result inline */}
                        {pingState[id] && !pingState[id].loading && (
                          <span
                            className={cn(
                              "text-[10px] font-mono px-2 py-1 rounded-md border",
                              pingState[id].error
                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                : pingState[id].ok
                                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                                  : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
                            )}
                          >
                            {pingState[id].error
                              ? `✗ ${pingState[id].error}`
                              : `${pingState[id].ok ? "✓" : "!"} ${pingState[id].status} · ${pingState[id].latency}ms`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Traffic Stats & Chart */}
          <div className="grid grid-cols-3 gap-4">
            {/* Scorecards */}
            <div className="flex flex-col gap-4">
              <div className="bg-[#0c0c0e]/80 border border-[#27272a]/50 rounded-2xl p-5 flex-1">
                <div className="flex items-center gap-2 text-[#52525b] mb-3 text-[10px] font-bold uppercase tracking-wider">
                  <Activity className="w-3.5 h-3.5 text-blue-500" /> Total
                  Requests
                </div>
                <div className="text-4xl font-black font-mono text-white">
                  {stats.total}
                </div>
                <div className="text-xs text-[#52525b] mt-1">
                  via Web Inspector
                </div>
              </div>

              <div className="bg-[#0c0c0e]/80 border border-[#27272a]/50 rounded-2xl p-5 flex-1">
                <div className="flex items-center gap-2 text-[#52525b] mb-3 text-[10px] font-bold uppercase tracking-wider">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Success
                  Rate
                </div>
                <div className="text-4xl font-black font-mono text-green-500">
                  {stats.successRate}%
                </div>
                <div className="text-xs text-[#52525b] mt-1">
                  {stats.success} successful
                </div>
              </div>

              <div className="bg-[#0c0c0e]/80 border border-[#27272a]/50 rounded-2xl p-5 flex-1">
                <div className="flex items-center gap-2 text-[#52525b] mb-3 text-[10px] font-bold uppercase tracking-wider">
                  <XCircle className="w-3.5 h-3.5 text-red-500" /> Error Rate
                </div>
                <div className="text-4xl font-black font-mono text-red-500">
                  {stats.errorRate}%
                </div>
                <div className="text-xs text-[#52525b] mt-1">
                  {stats.error} failed
                </div>
              </div>
            </div>

            {/* Traffic Chart */}
            <div className="col-span-2 bg-[#0c0c0e]/80 border border-[#27272a]/50 rounded-2xl p-6 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#a1a1aa] flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-orange-500" /> Request
                  Traffic
                </h3>
                <button
                  onClick={() => setActiveTab("analytics")}
                  className="text-[10px] text-[#52525b] hover:text-orange-500 transition-colors font-bold flex items-center gap-1"
                >
                  Full Analytics <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1 min-h-0 h-[260px]">
                {stats.timeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={stats.timeData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="dashGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#f97316"
                            stopOpacity={0.3}
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
                          borderRadius: "12px",
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
                        fill="url(#dashGrad)"
                        dot={false}
                        activeDot={{ r: 4, fill: "#f97316" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <BarChart3 className="w-12 h-12 text-[#27272a]" />
                    <div className="text-center">
                      <p className="text-sm text-[#52525b] font-medium">
                        No traffic data yet
                      </p>
                      <p className="text-xs text-[#3f3f46] mt-1">
                        Enable Web Inspector and start a tunnel to see traffic
                        here
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
