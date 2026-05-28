import React, { useEffect, useRef, useState, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import { useInspectorStore } from "../../store/useInspectorStore";
import { ArrowUp, ArrowDown, AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TunnelMetrics {
  tunnel_name: string;
  req_count: number;
  error_count: number;
  bytes_in: number; // client → origin (0 if cloudflared doesn't expose this)
  bytes_out: number; // origin → client (0 if cloudflared doesn't expose this)
}

interface TrafficMonitorProps {
  tunnelName: string;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return "";
  if (bytesPerSec < 1_024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1_048_576)
    return `${(bytesPerSec / 1_024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / 1_048_576).toFixed(1)} MB/s`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const TrafficMonitor: React.FC<TrafficMonitorProps> = ({
  tunnelName,
}) => {
  // Request sparkline data (30 points × 2s interval = 60s window)
  const [dataPoints, setDataPoints] = useState<number[]>(Array(30).fill(0));
  const [totalReqs, setTotalReqs] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  // Bytes from cloudflared metrics (populated only if cloudflared exposes them)
  const [cfBytes, setCfBytes] = useState({ in: 0, out: 0 });
  const [cfSpeed, setCfSpeed] = useState({ in: 0, out: 0 });
  const prevCfBytes = useRef({ in: 0, out: 0 });

  const { logs } = useInspectorStore();

  // ── Inspector-based byte estimation ─────────────────────────────────────────
  // Primary source for HTTP tunnels with Inspector enabled.
  // Uses Content-Length header when available, otherwise counts body length.
  const inspectorBytes = useMemo(() => {
    let bytesIn = 0; // request side (client → origin)
    let bytesOut = 0; // response side (origin → client)

    logs.forEach((log) => {
      if (log.tunnel_name !== tunnelName) return;

      if (log.request) {
        const cl =
          log.request.headers?.["content-length"] ??
          log.request.headers?.["Content-Length"];
        if (cl) {
          bytesIn += parseInt(cl, 10) || 0;
        } else {
          // Body length + rough header overhead (key: value\r\n per header)
          bytesIn += log.request.body?.length ?? 0;
          bytesIn += Object.entries(log.request.headers ?? {}).reduce(
            (s, [k, v]) => s + k.length + v.length + 4,
            0,
          );
        }
      }

      if (log.response) {
        const cl =
          log.response.headers?.["content-length"] ??
          log.response.headers?.["Content-Length"];
        if (cl) {
          bytesOut += parseInt(cl, 10) || 0;
        } else {
          bytesOut += log.response.body?.length ?? 0;
          bytesOut += Object.entries(log.response.headers ?? {}).reduce(
            (s, [k, v]) => s + k.length + v.length + 4,
            0,
          );
        }
      }
    });

    return { in: bytesIn, out: bytesOut };
  }, [logs, tunnelName]);

  // ── tunnel-metrics event listener ───────────────────────────────────────────
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      unlisten = await listen<TunnelMetrics>("tunnel-metrics", (event) => {
        if (event.payload.tunnel_name !== tunnelName) return;

        const {
          req_count,
          error_count = 0,
          bytes_in = 0,
          bytes_out = 0,
        } = event.payload;

        setTotalReqs((prev) => {
          const diff = Math.max(0, req_count - prev);
          setDataPoints((pts) => [...pts.slice(1), diff]);
          return req_count;
        });

        setErrorCount(error_count);

        // Speed calc (interval = 2s)
        if (bytes_in > 0 || bytes_out > 0) {
          const speedIn = Math.max(0, bytes_in - prevCfBytes.current.in) / 2;
          const speedOut = Math.max(0, bytes_out - prevCfBytes.current.out) / 2;
          prevCfBytes.current = { in: bytes_in, out: bytes_out };
          setCfBytes({ in: bytes_in, out: bytes_out });
          setCfSpeed({ in: speedIn, out: speedOut });
        }
      });
    };

    setup();
    return () => {
      if (unlisten) unlisten();
    };
  }, [tunnelName]);

  // ── Derived display values ───────────────────────────────────────────────────
  // Prefer cloudflared metrics (accurate); fall back to inspector estimates
  const hasCfBytes = cfBytes.in > 0 || cfBytes.out > 0;
  const hasInspBytes = inspectorBytes.in > 0 || inspectorBytes.out > 0;

  const displayIn = hasCfBytes ? cfBytes.in : inspectorBytes.in;
  const displayOut = hasCfBytes ? cfBytes.out : inspectorBytes.out;
  const speedIn = hasCfBytes ? cfSpeed.in : 0; // speed only from cloudflared
  const speedOut = hasCfBytes ? cfSpeed.out : 0;
  const source = hasCfBytes ? "cf" : hasInspBytes ? "inspector" : null;
  const hasBytes = source !== null;

  const maxVal = Math.max(...dataPoints, 1);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-2 w-full">
      {/* ── Sparkline row ── */}
      <div className="flex items-center gap-3 w-full">
        <div className="flex-1 h-8 flex items-end gap-[2px]">
          {dataPoints.map((val, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-[1px] transition-all duration-300 min-w-[2px]"
              style={{
                height: `${Math.max(8, (val / maxVal) * 100)}%`,
                backgroundColor: "#f97316",
                opacity: val > 0 ? 0.85 : 0.15,
              }}
              title={`${val} req/2s`}
            />
          ))}
        </div>

        {/* Right column: total + errors */}
        <div className="flex flex-col items-end shrink-0 gap-0.5">
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-[#52525b] uppercase font-bold tracking-widest">
              req
            </span>
            <span className="text-xs font-mono text-orange-500 font-bold tabular-nums">
              {totalReqs}
            </span>
          </div>
          {errorCount > 0 && (
            <div className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-red-500" />
              <span className="text-[10px] font-mono text-red-400 tabular-nums">
                {errorCount} err
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Bandwidth row ── */}
      {hasBytes ? (
        <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
          <div className="flex items-center gap-3">
            {/* Upload: client → origin */}
            <span
              className="flex items-center gap-1 text-blue-400"
              title="Bytes sent (client → origin)"
            >
              <ArrowUp className="w-3 h-3" />
              <span className="tabular-nums">{formatBytes(displayIn)}</span>
              {speedIn > 0 && (
                <span className="text-[#3f3f46]">· {formatSpeed(speedIn)}</span>
              )}
            </span>
            {/* Download: origin → client */}
            <span
              className="flex items-center gap-1 text-green-400"
              title="Bytes received (origin → client)"
            >
              <ArrowDown className="w-3 h-3" />
              <span className="tabular-nums">{formatBytes(displayOut)}</span>
              {speedOut > 0 && (
                <span className="text-[#3f3f46]">
                  · {formatSpeed(speedOut)}
                </span>
              )}
            </span>
          </div>
          {/* Source indicator */}
          <span
            className="text-[8px] text-[#3f3f46] uppercase tracking-wide"
            title={
              source === "inspector"
                ? "Estimated from Web Inspector logs"
                : "From cloudflared metrics"
            }
          >
            {source === "inspector" ? "est." : ""}
          </span>
        </div>
      ) : (
        <p className="text-[9px] text-[#3f3f46] leading-snug">
          Enable Web Inspector for bandwidth tracking
        </p>
      )}
    </div>
  );
};
