import React, { useState, useMemo, useCallback } from "react";
import {
  Search,
  Globe,
  Activity,
  XCircle,
  ArrowDown,
  ArrowUp,
  Play,
  Edit2,
  Copy,
  Check,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Zap,
  Filter,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useTunnelStore } from "../store/useTunnelStore";
import { useInspectorStore, InspectorLog } from "../store/useInspectorStore";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusColor(status: number) {
  if (status >= 200 && status < 300) return "text-green-400";
  if (status >= 300 && status < 400) return "text-yellow-400";
  if (status >= 400 && status < 500) return "text-orange-400";
  if (status >= 500) return "text-red-400";
  return "text-[#a1a1aa]";
}

function getStatusBg(status: number) {
  if (status >= 200 && status < 300)
    return "bg-green-500/10 text-green-400 border-green-500/20";
  if (status >= 300 && status < 400)
    return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  if (status >= 400 && status < 500)
    return "bg-orange-500/10 text-orange-400 border-orange-500/20";
  if (status >= 500) return "bg-red-500/10 text-red-400 border-red-500/20";
  return "bg-[#27272a] text-[#a1a1aa] border-[#3f3f46]";
}

function getMethodColor(method: string) {
  switch (method?.toUpperCase()) {
    case "GET":
      return "text-blue-400";
    case "POST":
      return "text-green-400";
    case "PUT":
      return "text-orange-400";
    case "DELETE":
      return "text-red-400";
    case "PATCH":
      return "text-yellow-400";
    case "HEAD":
      return "text-purple-400";
    case "OPTIONS":
      return "text-gray-400";
    default:
      return "text-[#a1a1aa]";
  }
}

function tryFormatJson(raw: string): { text: string; isJson: boolean } {
  if (!raw?.trim()) return { text: raw || "", isJson: false };
  try {
    return { text: JSON.stringify(JSON.parse(raw), null, 2), isJson: true };
  } catch {
    return { text: raw, isJson: false };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyBtn({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      className={cn(
        "p-1 rounded transition-colors",
        copied
          ? "text-green-400"
          : "text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#27272a]",
        className,
      )}
      title="Copy"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function BodyPanel({
  label,
  content,
  icon,
}: {
  label: string;
  content: string | undefined;
  icon: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const { text, isJson } = useMemo(
    () => tryFormatJson(content || ""),
    [content],
  );
  const isEmpty = !content?.trim();

  return (
    <div className="bg-[#0c0c0e] border border-[#27272a] rounded-xl overflow-hidden">
      <div className="bg-[#18181b] border-b border-[#27272a] px-3 py-1.5 flex items-center justify-between">
        <span className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider flex items-center gap-1.5">
          {icon} {label}
          {isJson && (
            <span className="ml-1 text-[8px] font-bold px-1 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">
              JSON
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {!isEmpty && <CopyBtn text={text} />}
          <button
            onClick={() => setExpanded((e) => !e)}
            className="p-1 rounded text-[#52525b] hover:text-[#a1a1aa] transition-colors"
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
      {expanded && (
        <pre
          className={cn(
            "p-3 text-xs font-mono whitespace-pre-wrap break-all max-h-64 overflow-y-auto leading-relaxed",
            isEmpty ? "text-[#52525b] italic" : "text-[#e4e4e7]",
          )}
        >
          {isEmpty ? "Empty body" : text}
        </pre>
      )}
    </div>
  );
}

function HeadersPanel({
  label,
  headers,
  icon,
}: {
  label: string;
  headers: Record<string, string> | undefined;
  icon: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const entries = Object.entries(headers || {});

  return (
    <div className="bg-[#0c0c0e] border border-[#27272a] rounded-xl overflow-hidden">
      <div className="bg-[#18181b] border-b border-[#27272a] px-3 py-1.5 flex items-center justify-between">
        <span className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider flex items-center gap-1.5">
          {icon} {label}
          <span className="text-[#3f3f46] font-normal">({entries.length})</span>
        </span>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="p-1 rounded text-[#52525b] hover:text-[#a1a1aa] transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
      {expanded && (
        <div className="p-3 font-mono text-[10px] space-y-1.5 max-h-48 overflow-y-auto">
          {entries.length === 0 ? (
            <span className="text-[#52525b] italic">No headers</span>
          ) : (
            entries.map(([key, val]) => (
              <div key={key} className="flex gap-2">
                <span className="text-[#71717a] shrink-0 min-w-0">{key}:</span>
                <span className="text-[#e4e4e7] break-all">{val}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Status filter type ───────────────────────────────────────────────────────
type StatusFilter = "all" | "2xx" | "error" | "pending";

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All",
  "2xx": "2xx",
  error: "Errors",
  pending: "Pending",
};

// ─── Main Component ───────────────────────────────────────────────────────────
export function InspectorView() {
  const { logs, clearLogs } = useInspectorStore();
  const { activeProcesses } = useTunnelStore();

  // Selection & panel state
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Replay form state
  const [replayMethod, setReplayMethod] = useState("GET");
  const [replayPath, setReplayPath] = useState("/");
  const [replayHeaders, setReplayHeaders] = useState("{}");
  const [replayBody, setReplayBody] = useState("");
  const [replaying, setReplaying] = useState(false);

  // Filtered log list
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Status filter
      const status = log.response?.status;
      if (statusFilter === "2xx" && !(status && status >= 200 && status < 300))
        return false;
      if (statusFilter === "error" && !(status && status >= 400)) return false;
      if (statusFilter === "pending" && log.response != null) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inPath = (log.request?.path || "").toLowerCase().includes(q);
        const inMethod = (log.request?.method || "").toLowerCase().includes(q);
        const inTunnel = (log.tunnel_name || "").toLowerCase().includes(q);
        const inStatus = status?.toString().includes(q);
        if (!inPath && !inMethod && !inTunnel && !inStatus) return false;
      }

      return true;
    });
  }, [logs, searchQuery, statusFilter]);

  const selectedLog = logs.find((l) => l.log_id === selectedLogId) ?? null;

  // Open replay panel populated with selected log's data
  const openReplay = useCallback((log: InspectorLog) => {
    setSelectedLogId(log.log_id);
    setReplayMethod(log.request?.method || "GET");
    const fullPath =
      (log.request?.path || "/") +
      (log.request?.query ? `?${log.request.query}` : "");
    setReplayPath(fullPath);
    setReplayHeaders(JSON.stringify(log.request?.headers || {}, null, 2));
    setReplayBody(log.request?.body || "");
    setIsReplaying(true);
  }, []);

  // Quick replay — one-click, no editing
  const quickReplay = useCallback(
    async (log: InspectorLog, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!(window as any).__TAURI_INTERNALS__) {
        toast.error("Replay requires Tauri runtime.");
        return;
      }
      const process = activeProcesses[log.tunnel_name];
      if (!process?.config?.localUrl) {
        toast.error("Tunnel is not running — cannot replay.");
        return;
      }
      const base = process.config.localUrl.replace(/\/$/, "");
      const fullPath =
        (log.request?.path || "/") +
        (log.request?.query ? `?${log.request.query}` : "");
      const fullUrl = `${base}${fullPath}`;

      try {
        await invoke("replay_request", {
          tunnelName: log.tunnel_name,
          method: log.request?.method || "GET",
          url: fullUrl,
          headers: log.request?.headers || {},
          body: log.request?.body || "",
        });
        toast.success("Replayed! New entry added to the top.");
        setTimeout(() => {
          const newest = useInspectorStore.getState().logs[0];
          if (newest) setSelectedLogId(newest.log_id);
        }, 200);
      } catch (err: any) {
        toast.error(`Replay failed: ${err}`);
      }
    },
    [activeProcesses],
  );

  // Submit edited replay
  const submitReplay = useCallback(async () => {
    if (!selectedLog) return;
    if (!(window as any).__TAURI_INTERNALS__) {
      toast.error("Replay requires Tauri runtime.");
      return;
    }
    const process = activeProcesses[selectedLog.tunnel_name];
    if (!process?.config?.localUrl) {
      toast.error("Tunnel is not running — cannot replay.");
      return;
    }

    let parsedHeaders: Record<string, string> = {};
    try {
      parsedHeaders = JSON.parse(replayHeaders || "{}");
    } catch {
      toast.error("Headers must be valid JSON.");
      return;
    }

    const base = process.config.localUrl.replace(/\/$/, "");
    const fullUrl = `${base}${replayPath.startsWith("/") ? replayPath : "/" + replayPath}`;

    setReplaying(true);
    try {
      await invoke("replay_request", {
        tunnelName: selectedLog.tunnel_name,
        method: replayMethod,
        url: fullUrl,
        headers: parsedHeaders,
        body: replayBody,
      });
      toast.success("Request sent! Auto-selecting new log…");
      setIsReplaying(false);
      // Auto-select the newest log entry (the replayed one)
      setTimeout(() => {
        const newest = useInspectorStore.getState().logs[0];
        if (newest) setSelectedLogId(newest.log_id);
      }, 200);
    } catch (err: any) {
      toast.error(`Replay failed: ${err}`);
    } finally {
      setReplaying(false);
    }
  }, [
    selectedLog,
    activeProcesses,
    replayMethod,
    replayPath,
    replayHeaders,
    replayBody,
  ]);

  // Status filter badge counts
  const counts = useMemo(() => {
    let twoxx = 0,
      errors = 0,
      pending = 0;
    logs.forEach((l) => {
      const s = l.response?.status;
      if (!s) {
        pending++;
        return;
      }
      if (s >= 200 && s < 300) twoxx++;
      if (s >= 400) errors++;
    });
    return { twoxx, errors, pending };
  }, [logs]);

  return (
    <div className="flex h-full w-full bg-[#09090b] text-[#e4e4e7] overflow-hidden">
      {/* ── Left: Request List ─────────────────────────────────────────── */}
      <div className="w-[300px] shrink-0 border-r border-[#27272a] flex flex-col h-full bg-[#0c0c0e]">
        {/* Header */}
        <div className="p-3 border-b border-[#27272a] shrink-0 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#52525b] flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-500" />
              Web Inspector
            </h2>
            <button
              onClick={clearLogs}
              className="text-[10px] text-[#52525b] hover:text-red-400 uppercase font-bold tracking-wider transition-colors flex items-center gap-1"
            >
              <XCircle className="w-3 h-3" /> Clear
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#52525b]" />
            <input
              type="text"
              placeholder="Filter path, method, status…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-1.5 pl-8 text-xs focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-[#3f3f46]"
            />
          </div>

          {/* Status filter tabs */}
          <div className="flex items-center gap-1">
            {(["all", "2xx", "error", "pending"] as StatusFilter[]).map((f) => {
              const badge =
                f === "2xx"
                  ? counts.twoxx
                  : f === "error"
                    ? counts.errors
                    : f === "pending"
                      ? counts.pending
                      : logs.length;
              return (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={cn(
                    "flex-1 py-1 rounded-md text-[9px] font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-1",
                    statusFilter === f
                      ? f === "error"
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : f === "2xx"
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : f === "pending"
                            ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                            : "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                      : "text-[#3f3f46] hover:text-[#71717a] hover:bg-[#18181b]",
                  )}
                >
                  {FILTER_LABELS[f]}
                  {badge > 0 && <span className="tabular-nums">{badge}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#52525b] p-6 text-center gap-3">
              <Globe className="w-8 h-8 opacity-20" />
              <p className="text-xs">
                {logs.length === 0
                  ? "No intercepted traffic yet."
                  : "No results match your filter."}
              </p>
              {logs.length === 0 && (
                <p className="text-[10px] opacity-60">
                  Enable Web Inspector on a running tunnel to capture requests.
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[#27272a]/60">
              {filteredLogs.map((log) => (
                <div
                  key={log.log_id}
                  className={cn(
                    "group relative w-full text-left px-3 py-2.5 hover:bg-[#18181b] transition-colors border-l-2 cursor-pointer",
                    selectedLogId === log.log_id
                      ? "bg-[#18181b] border-orange-500"
                      : "border-transparent",
                  )}
                  onClick={() => {
                    setSelectedLogId(log.log_id);
                    setIsReplaying(false);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-mono text-xs min-w-0">
                      <span
                        className={cn(
                          "font-bold shrink-0 w-[42px] text-[10px]",
                          getMethodColor(log.request?.method || ""),
                        )}
                      >
                        {log.request?.method}
                      </span>
                      <span
                        className="truncate text-[#a1a1aa]"
                        title={log.request?.path}
                      >
                        {log.request?.path}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Quick replay button (shows on hover) */}
                      <button
                        onClick={(e) => quickReplay(log, e)}
                        title="Quick replay (one-click, no edit)"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-orange-500/20 text-[#52525b] hover:text-orange-400 transition-all"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      <span
                        className={cn(
                          "text-[10px] font-bold font-mono",
                          log.response
                            ? getStatusColor(log.response.status)
                            : "text-[#52525b] animate-pulse",
                        )}
                      >
                        {log.response ? log.response.status : "…"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[9px] text-[#3f3f46] font-mono">
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className="truncate max-w-[100px]">
                      {log.tunnel_name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer count */}
        {logs.length > 0 && (
          <div className="px-3 py-2 border-t border-[#27272a] text-[9px] text-[#3f3f46] flex items-center gap-1">
            <Filter className="w-3 h-3" />
            {filteredLogs.length} / {logs.length} requests
          </div>
        )}
      </div>

      {/* ── Right: Detail or Replay ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {!selectedLog ? (
          <div className="flex flex-col items-center justify-center h-full text-[#52525b] gap-3">
            <Activity className="w-10 h-10 opacity-20" />
            <p className="text-sm">Select a request to inspect</p>
            <p className="text-[10px] opacity-60">
              or hover a row and click ↺ to quick-replay
            </p>
          </div>
        ) : isReplaying ? (
          /* ── Replay Editor ── */
          <div className="flex flex-col h-full overflow-y-auto">
            {/* Replay header */}
            <div className="shrink-0 px-6 py-4 border-b border-[#27272a] flex items-center justify-between bg-[#0c0c0e]">
              <h2 className="text-sm font-bold flex items-center gap-2 text-orange-400">
                <Edit2 className="w-4 h-4" /> Edit & Replay
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsReplaying(false)}
                  className="px-3 py-1.5 text-xs text-[#a1a1aa] hover:text-white bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitReplay}
                  disabled={replaying}
                  className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2"
                >
                  {replaying ? (
                    <>
                      <Activity className="w-3.5 h-3.5 animate-spin" /> Sending…
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" /> Send Request
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
              {/* Method + URL */}
              <div className="flex gap-2">
                <select
                  value={replayMethod}
                  onChange={(e) => setReplayMethod(e.target.value)}
                  className="bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-xs font-mono text-[#e4e4e7] focus:border-orange-500/50 outline-none w-28 shrink-0"
                >
                  {[
                    "GET",
                    "POST",
                    "PUT",
                    "PATCH",
                    "DELETE",
                    "OPTIONS",
                    "HEAD",
                  ].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={replayPath}
                  onChange={(e) => setReplayPath(e.target.value)}
                  placeholder="/api/endpoint?query=value"
                  className="flex-1 bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-xs font-mono text-[#e4e4e7] focus:border-orange-500/50 outline-none"
                />
              </div>

              {/* Tunnel target info */}
              {activeProcesses[selectedLog.tunnel_name]?.config?.localUrl && (
                <div className="text-[10px] text-[#52525b] font-mono bg-[#0c0c0e] border border-[#27272a] rounded-lg px-3 py-2">
                  Target:{" "}
                  <span className="text-[#a1a1aa]">
                    {activeProcesses[selectedLog.tunnel_name].config.localUrl}
                  </span>
                  <span className="text-orange-500">{replayPath}</span>
                </div>
              )}

              {/* Headers */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-bold text-[#52525b] tracking-wider">
                    Headers (JSON)
                  </label>
                  <button
                    onClick={() => {
                      try {
                        setReplayHeaders(
                          JSON.stringify(JSON.parse(replayHeaders), null, 2),
                        );
                      } catch {
                        toast.error("Invalid JSON");
                      }
                    }}
                    className="text-[9px] text-[#52525b] hover:text-orange-400 font-bold transition-colors"
                  >
                    Format JSON
                  </button>
                </div>
                <textarea
                  value={replayHeaders}
                  onChange={(e) => setReplayHeaders(e.target.value)}
                  rows={6}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-3 text-xs font-mono text-[#e4e4e7] focus:border-orange-500/50 outline-none resize-y min-h-[80px]"
                />
              </div>

              {/* Body */}
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-bold text-[#52525b] tracking-wider">
                    Body
                  </label>
                  <button
                    onClick={() => {
                      try {
                        setReplayBody(
                          JSON.stringify(JSON.parse(replayBody), null, 2),
                        );
                      } catch {
                        toast.error("Invalid JSON");
                      }
                    }}
                    className="text-[9px] text-[#52525b] hover:text-orange-400 font-bold transition-colors"
                  >
                    Format JSON
                  </button>
                </div>
                <textarea
                  value={replayBody}
                  onChange={(e) => setReplayBody(e.target.value)}
                  rows={10}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg p-3 text-xs font-mono text-[#e4e4e7] focus:border-orange-500/50 outline-none resize-y min-h-[120px]"
                />
              </div>
            </div>
          </div>
        ) : (
          /* ── Request/Response Detail ── */
          <div className="flex flex-col h-full overflow-y-auto">
            {/* Detail header */}
            <div className="shrink-0 px-6 py-4 border-b border-[#27272a] flex items-center justify-between gap-4 bg-[#0c0c0e]">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={cn(
                    "text-base font-bold font-mono shrink-0",
                    getMethodColor(selectedLog.request?.method || ""),
                  )}
                >
                  {selectedLog.request?.method}
                </span>
                <span
                  className="text-sm font-mono text-[#a1a1aa] truncate"
                  title={selectedLog.request?.path}
                >
                  {selectedLog.request?.path}
                  {selectedLog.request?.query && (
                    <span className="text-[#52525b]">
                      ?{selectedLog.request.query}
                    </span>
                  )}
                </span>
                {selectedLog.response && (
                  <span
                    className={cn(
                      "text-[11px] font-bold px-2 py-0.5 rounded-md border shrink-0",
                      getStatusBg(selectedLog.response.status),
                    )}
                  >
                    {selectedLog.response.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Quick replay (one-click) */}
                <button
                  onClick={(e) => quickReplay(selectedLog, e)}
                  title="Quick replay — send with same data, no edit"
                  className="px-3 py-1.5 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-[#a1a1aa] hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Replay
                </button>
                {/* Edit & Replay */}
                <button
                  onClick={() => openReplay(selectedLog)}
                  className="px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500 text-orange-400 hover:text-white border border-orange-500/20 hover:border-orange-500 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit & Replay
                </button>
              </div>
            </div>

            {/* Metadata row */}
            <div className="shrink-0 px-6 py-2 border-b border-[#27272a]/50 flex items-center gap-4 text-[10px] text-[#52525b] font-mono bg-[#09090b]">
              <span>{new Date(selectedLog.timestamp).toLocaleString()}</span>
              <span className="text-[#27272a]">|</span>
              <span>
                tunnel:{" "}
                <span className="text-[#a1a1aa]">
                  {selectedLog.tunnel_name}
                </span>
              </span>
              <span className="text-[#27272a]">|</span>
              <span>
                id:{" "}
                <span className="text-[#3f3f46]">
                  {selectedLog.log_id.slice(0, 8)}…
                </span>
              </span>
            </div>

            {/* Request + Response panels */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Request */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#52525b] flex items-center gap-2">
                    <ArrowUp className="w-3.5 h-3.5 text-blue-500" /> Request
                  </h3>
                  <HeadersPanel
                    label="Request Headers"
                    headers={selectedLog.request?.headers}
                    icon={<ArrowUp className="w-3 h-3" />}
                  />
                  <BodyPanel
                    label="Request Body"
                    content={selectedLog.request?.body}
                    icon={<ArrowUp className="w-3 h-3" />}
                  />
                </div>

                {/* Response */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#52525b] flex items-center gap-2">
                    <ArrowDown className="w-3.5 h-3.5 text-green-500" />{" "}
                    Response
                    {selectedLog.response && (
                      <span
                        className={cn(
                          "text-[10px] font-bold font-mono",
                          getStatusColor(selectedLog.response.status),
                        )}
                      >
                        {selectedLog.response.status}
                      </span>
                    )}
                  </h3>
                  {!selectedLog.response ? (
                    <div className="flex flex-col items-center justify-center h-48 border border-[#27272a] border-dashed rounded-xl text-[#52525b] gap-2">
                      <Zap className="w-6 h-6 animate-pulse" />
                      <p className="text-xs">Waiting for response…</p>
                    </div>
                  ) : (
                    <>
                      <HeadersPanel
                        label="Response Headers"
                        headers={selectedLog.response.headers}
                        icon={<ArrowDown className="w-3 h-3" />}
                      />
                      <BodyPanel
                        label="Response Body"
                        content={selectedLog.response.body}
                        icon={<ArrowDown className="w-3 h-3" />}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
