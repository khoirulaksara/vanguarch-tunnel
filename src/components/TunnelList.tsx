import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSettingsStore } from "../store/useSettingsStore";
import { useTunnelStore } from "../store/useTunnelStore";
import { useProjectStore } from "../store/useProjectStore";
import { useCloudflareStore } from "../store/useCloudflareStore";
import {
  Cloud,
  Play,
  Search,
  RefreshCw,
  XCircle,
  Copy,
  Check,
  Link,
  Trash2,
  Activity,
} from "lucide-react";
import { cn } from "../lib/utils";
import { QRCodeDisplay } from "./ui/QRCodeDisplay";
import { TrafficMonitor } from "./ui/TrafficMonitor";

import { ConfirmModal } from "./ui/ConfirmModal";

export function TunnelList() {
  const { tunnels, loading, error, fetchTunnels, deleteTunnel } =
    useCloudflareStore();
  const [searchQuery, setSearchQuery] = useState("");

  const { cloudflaredPath, publicDomain } = useSettingsStore();
  const { startTunnel, stopTunnel, stopAllTunnels, activeProcesses } =
    useTunnelStore();
  const { projects } = useProjectStore();
  const [startingTunnelId, setStartingTunnelId] = useState<string | null>(null);
  const [deletingTunnelId, setDeletingTunnelId] = useState<string | null>(null);
  const [tunnelToDelete, setTunnelToDelete] = useState<any>(null);
  const [stopAllConfirmOpen, setStopAllConfirmOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    fetchTunnels(cloudflaredPath);
  }, [cloudflaredPath, fetchTunnels]);

  const handleDeleteTunnel = (tunnel: any) => {
    setTunnelToDelete(tunnel);
  };

  const confirmDelete = async () => {
    if (!tunnelToDelete) return;

    setDeletingTunnelId(tunnelToDelete.id);
    try {
      await deleteTunnel(cloudflaredPath, tunnelToDelete.name);
      toast.success(`Tunnel '${tunnelToDelete.name}' deleted successfully.`);
    } catch (err: any) {
      toast.error(`Failed to delete tunnel: ${err.message || String(err)}`);
    } finally {
      setDeletingTunnelId(null);
      setTunnelToDelete(null);
    }
  };

  const handleStartTunnel = async (
    tunnel: any,
    withInspector: boolean = false,
  ) => {
    setStartingTunnelId(tunnel.id);
    try {
      const sanitizedName = tunnel.name.replace("vanguarch-", "");
      // Match exactly or with -<number> suffix. We find by checking if the sanitized name matches the base project name regex.
      const project = projects.find((p) => {
        const pName = p.name.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase();
        return (
          sanitizedName === pName ||
          sanitizedName.match(new RegExp(`^${pName}-\\d+$`))
        );
      });

      let localUrl = `http://127.0.0.1`;
      let localVhost = `${sanitizedName}.test`;
      let isLocalhost = false;

      if (project) {
        isLocalhost =
          project.suggestedUrl.includes("localhost") ||
          project.suggestedUrl.includes("127.0.0.1");
        localUrl = isLocalhost ? project.suggestedUrl : "http://127.0.0.1";
        localVhost = project.suggestedUrl
          .replace("http://", "")
          .replace("https://", "");
      }

      const config = {
        id: Math.random().toString(36).substring(2, 9),
        name: tunnel.name,
        localUrl,
        localVhost,
        publicDomain: publicDomain
          ? `${sanitizedName}.${publicDomain}`
          : `${tunnel.id}.cfargotunnel.com`,
        tunnelName: tunnel.name,
        options: {
          httpHostHeader: !isLocalhost,
          originServerName: !isLocalhost,
          forceHttp2: false,
          ipv4Only: false,
        },
        protocol: "http" as const,
        enableInspector: withInspector,
      };

      await startTunnel(config);
    } catch (err: any) {
      toast.error(err.message || String(err));
    } finally {
      setStartingTunnelId(null);
    }
  };

  const filteredTunnels = Array.isArray(tunnels)
    ? tunnels.filter((t: any) =>
        (t.name || "").toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : [];

  const anyActiveTunnels = Object.values(activeProcesses).some(
    (p) => p.status === "running" || p.status === "starting",
  );

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] text-[#e4e4e7] overflow-y-auto relative">
      <div className="flex flex-col max-w-5xl w-full mx-auto">
        <div className="sticky top-0 z-10 bg-[#09090b] h-16 px-6 border-b border-[#27272a] flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#52525b] flex items-center gap-2 mb-1">
              <Cloud className="w-4 h-4 text-blue-500" />
              Cloudflare Tunnels
            </h2>
            <p className="text-[10px] text-[#a1a1aa] mt-0.5">
              Manage existing tunnels from your account
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#52525b] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tunnels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#18181b] border border-[#27272a] rounded-lg pl-9 pr-4 py-1.5 text-xs text-[#e4e4e7] w-64 focus:outline-none focus:border-[#52525b] transition-colors placeholder:text-[#52525b]"
              />
            </div>
            {anyActiveTunnels && (
              <button
                onClick={() => setStopAllConfirmOpen(true)}
                className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-900/50 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
              >
                <XCircle className="w-3.5 h-3.5" />
                Stop All
              </button>
            )}
            <button
              onClick={() => fetchTunnels(cloudflaredPath)}
              disabled={loading}
              className="px-3 py-1.5 bg-[#27272a] border border-transparent hover:border-[#52525b] rounded-lg text-[11px] font-bold uppercase tracking-wider text-[#e4e4e7] disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 flex flex-col gap-6">
          {error && (
            <div className="p-4 bg-red-950/30 border border-red-900/50 rounded mb-4">
              <h4 className="text-red-500 text-xs font-bold uppercase tracking-wider mb-1">
                Error Fetching Tunnels
              </h4>
              <p className="text-red-400/80 text-[10px] font-mono">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full text-center py-12">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#52525b] mb-3" />
                <p className="text-[10px] uppercase tracking-wider text-[#52525b] font-bold">
                  Fetching Tunnels...
                </p>
              </div>
            ) : filteredTunnels.length === 0 ? (
              <div className="col-span-full text-center py-12 border border-[#27272a] rounded bg-[#18181b]/50">
                <Cloud className="w-6 h-6 mx-auto text-[#52525b] mb-2 opacity-50" />
                <p className="text-[10px] uppercase tracking-wider text-[#52525b] font-bold">
                  No Tunnels Found
                </p>
              </div>
            ) : (
              filteredTunnels.map((tunnel: any) => {
                const cleanedName = tunnel.name.replace("vanguarch-", "");
                const url = publicDomain
                  ? `https://${cleanedName}.${publicDomain}`
                  : `https://${tunnel.id}.cfargotunnel.com`;

                const p = activeProcesses[tunnel.name];
                const isThisTunnelStarting = p?.status === "starting";
                const isThisTunnelRunning = p?.status === "running";
                const timeSinceStop =
                  p?.status === "stopped" && p?.stoppedAt
                    ? now - p.stoppedAt
                    : Infinity;
                const isRecentlyStopped = timeSinceStop < 60000;
                const hasConnections =
                  tunnel.connections &&
                  tunnel.connections.length > 0 &&
                  !isRecentlyStopped;
                const isOnline = isThisTunnelRunning || hasConnections;
                // Orphaned = online via Cloudflare API but NOT tracked in this app session
                const isOrphanedOnline =
                  hasConnections &&
                  !isThisTunnelRunning &&
                  !isThisTunnelStarting;

                let statusText = isThisTunnelStarting
                  ? "STARTING"
                  : isOnline
                    ? "ONLINE"
                    : "OFFLINE";
                let statusColorClass = isThisTunnelStarting
                  ? "bg-orange-500/10 text-orange-500"
                  : isOnline
                    ? "bg-green-500/10 text-green-500"
                    : "bg-[#27272a] text-[#a1a1aa]";

                if (
                  isRecentlyStopped &&
                  !isThisTunnelStarting &&
                  !isThisTunnelRunning
                ) {
                  const secondsLeft = Math.ceil((60000 - timeSinceStop) / 1000);
                  statusText = `COOLDOWN (${secondsLeft}s)`;
                  statusColorClass = "bg-yellow-500/10 text-yellow-500";
                }

                return (
                  <div
                    key={tunnel.id}
                    className="bg-[#18181b]/50 border border-[#27272a] p-4 flex flex-col justify-between gap-3 rounded-xl hover:border-[#52525b] transition-colors overflow-hidden"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2 overflow-hidden mr-2">
                          <h3
                            className="text-sm font-bold tracking-tight text-[#e4e4e7] truncate"
                            title={tunnel.name}
                          >
                            {tunnel.name}
                          </h3>
                          <button
                            onClick={() => handleDeleteTunnel(tunnel)}
                            disabled={
                              deletingTunnelId === tunnel.id ||
                              isThisTunnelRunning ||
                              isThisTunnelStarting
                            }
                            className="p-1 text-[#52525b] hover:text-red-400 hover:bg-[#27272a] rounded transition-colors shrink-0 disabled:opacity-50"
                            title="Delete Tunnel"
                          >
                            {deletingTunnelId === tunnel.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-400" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${statusColorClass}`}
                        >
                          {statusText}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Link className="w-3.5 h-3.5 text-[#52525b]" />
                        <span
                          className="text-[10px] text-[#a1a1aa] font-mono truncate"
                          title={url}
                        >
                          {url}
                        </span>
                        <button
                          onClick={() => handleCopy(url, tunnel.id)}
                          className="p-1 hover:bg-[#27272a] rounded text-[#52525b] hover:text-[#e4e4e7] transition-colors shrink-0"
                          title="Copy Public URL"
                        >
                          {copiedId === tunnel.id ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <QRCodeDisplay url={url} />
                      </div>
                      <p className="text-[9px] text-[#52525b] font-mono truncate">
                        ID: {tunnel.id}
                      </p>
                    </div>

                    <div className="flex flex-col pt-3 border-t border-[#27272a] gap-2">
                      {isThisTunnelRunning && (
                        <div className="px-1 pb-2">
                          <TrafficMonitor tunnelName={tunnel.name} />
                        </div>
                      )}
                      <div className="flex items-center justify-end">
                        {isThisTunnelRunning || isOrphanedOnline ? (
                          <div className="flex flex-col gap-2 w-full">
                            {isOrphanedOnline && (
                              <p className="text-[9px] text-yellow-500/80 text-center">
                                ⚠ Running externally — not started by this
                                session
                              </p>
                            )}
                            <button
                              onClick={() => {
                                stopTunnel(tunnel.name);
                                setTimeout(
                                  () => fetchTunnels(cloudflaredPath),
                                  2000,
                                );
                              }}
                              className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center w-full gap-1.5"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Stop
                            </button>
                          </div>
                        ) : (
                          <div className="flex w-full gap-2">
                            <button
                              onClick={() => handleStartTunnel(tunnel, false)}
                              disabled={
                                startingTunnelId === tunnel.id ||
                                isThisTunnelStarting ||
                                isRecentlyStopped
                              }
                              className="flex-1 py-1.5 bg-white text-black hover:bg-[#e4e4e7] rounded text-[10px] font-bold uppercase tracking-wider disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                              title={
                                isRecentlyStopped
                                  ? "Cooling down before restart"
                                  : "Start tunnel"
                              }
                            >
                              {startingTunnelId === tunnel.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Play className="w-3.5 h-3.5" />
                              )}
                              Start
                            </button>
                            <button
                              onClick={() => handleStartTunnel(tunnel, true)}
                              disabled={
                                startingTunnelId === tunnel.id ||
                                isThisTunnelStarting ||
                                isRecentlyStopped
                              }
                              className="px-3 py-1.5 bg-[#27272a] text-[#a1a1aa] hover:bg-orange-500 hover:text-black rounded transition-colors disabled:opacity-50"
                              title="Start with Web Inspector"
                            >
                              <Activity className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={!!tunnelToDelete}
        onClose={() => setTunnelToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Tunnel"
        message={`Are you sure you want to delete tunnel '${tunnelToDelete?.name}'? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
      <ConfirmModal
        isOpen={stopAllConfirmOpen}
        onClose={() => setStopAllConfirmOpen(false)}
        onConfirm={() => {
          stopAllTunnels();
          setTimeout(() => fetchTunnels(cloudflaredPath), 1000);
        }}
        title="Stop All Tunnels"
        message={`Stop all ${Object.values(activeProcesses).filter((p) => p.status === "running" || p.status === "starting").length} active tunnel(s)? Traffic will be interrupted immediately.`}
        confirmText="Stop All"
        variant="danger"
      />
    </div>
  );
}
