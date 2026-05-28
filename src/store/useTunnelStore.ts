import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import {
  TunnelConfig,
  TunnelLog,
  TunnelProcess,
  ProcessStatus,
  SessionRecord,
} from "../types";
import { useSettingsStore } from "./useSettingsStore";
import { useCloudflareStore } from "./useCloudflareStore";

// Optional Tauri imports (only available when running in Tauri context)
let invoke: any = null;
let listen: any = null;
(async () => {
  try {
    if ((window as any).__TAURI_INTERNALS__) {
      const core = await import("@tauri-apps/api/core");
      const event = await import("@tauri-apps/api/event");
      invoke = core.invoke;
      listen = event.listen;
    }
  } catch (e) {
    console.error("Not running in Tauri environment");
  }
})();

interface TunnelStore {
  presets: TunnelConfig[];
  activeProcesses: Record<string, TunnelProcess>;
  selectedLogTunnel: string | null;
  addPreset: (config: Omit<TunnelConfig, "id">) => void;
  removePreset: (id: string) => Promise<void>;
  updatePreset: (id: string, preset: TunnelConfig) => void;
  selectLogTunnel: (tunnelName: string | null) => void;

  // Process Management
  startTunnel: (config: TunnelConfig) => Promise<void>;
  stopTunnel: (tunnelName: string) => Promise<void>;
  stopAllTunnels: () => Promise<void>;
  addLog: (tunnelName: string, log: Omit<TunnelLog, "id">) => void;
  clearLogs: (tunnelName: string) => void;
  removeProcess: (tunnelName: string) => void;
  setupUnlisten: null | (() => void);
  history: SessionRecord[];
  clearHistory: () => void;
  restartTunnel: (tunnelName: string) => Promise<void>;
}

export const useTunnelStore = create<TunnelStore>()(
  persist(
    (set, get) => ({
      presets: [],
      activeProcesses: {},
      selectedLogTunnel: null,
      setupUnlisten: null,
      history: [],

      addPreset: (config) =>
        set((state) => ({
          presets: [
            ...state.presets,
            { ...config, id: Math.random().toString(36).substring(2, 9) },
          ],
        })),
      removePreset: async (id) => {
        const preset = get().presets.find((p) => p.id === id);
        if (preset) {
          if (invoke) {
            try {
              const cloudflaredPath =
                useSettingsStore.getState().cloudflaredPath;
              await invoke("delete_tunnel", {
                cloudflaredPath,
                tunnelName: preset.tunnelName,
              });
            } catch (err) {
              console.warn("Failed to delete tunnel from cloudflare:", err);
            }
            useCloudflareStore
              .getState()
              .fetchTunnels(useSettingsStore.getState().cloudflaredPath);
          }
          set((state) => ({
            presets: state.presets.filter((p) => p.id !== id),
          }));
        }
      },
      updatePreset: (id, config) =>
        set((state) => ({
          presets: state.presets.map((p) =>
            p.id === id ? { ...p, ...config } : p,
          ),
        })),
      selectLogTunnel: (tunnelName) => set({ selectedLogTunnel: tunnelName }),

      startTunnel: async (config) => {
        const tunnelName = config.tunnelName;

        if (invoke) {
          try {
            const { online } = await invoke("check_internet") as { online: boolean; latency_ms: number };
            if (!online) {
              toast.error("No internet connection", {
                description: "Cannot start tunnel — please check your network connection and try again.",
              });
              return;
            }
          } catch {
            // if check fails, proceed anyway (don't block)
          }
        }

        let formattedLocalUrl = config.localUrl;
        if (config.protocol && config.protocol !== "http") {
          // ensure correct prefix for non-http protocols
          const cleanUrl = config.localUrl
            .replace(/^https?:\/\//i, "")
            .replace(/^tcp:\/\//i, "")
            .replace(/^ssh:\/\//i, "")
            .replace(/^rdp:\/\//i, "");
          formattedLocalUrl = `${config.protocol}://${cleanUrl}`;
        }

        const command =
          `cloudflared tunnel --url ${formattedLocalUrl} ${config.options.httpHostHeader && config.localVhost ? "--http-host-header " + config.localVhost : ""} ${config.options.originServerName && config.localVhost ? "--origin-server-name " + config.localVhost : ""} run ${config.tunnelName}`
            .replace(/\s+/g, " ")
            .trim();

        set((state) => ({
          activeProcesses: {
            ...state.activeProcesses,
            [tunnelName]: {
              config,
              status: "starting",
              command,
              logs: [
                {
                  id: Date.now().toString(),
                  timestamp: new Date().toISOString(),
                  message: `Starting cloudflared process...`,
                  type: "info",
                },
                {
                  id: (Date.now() + 1).toString(),
                  timestamp: new Date().toISOString(),
                  message: command,
                  type: "info",
                },
              ],
            },
          },
          selectedLogTunnel: tunnelName,
        }));

        if (invoke && listen) {
          try {
            // Unlisten previous if exists. We only need one global listener for all tunnnels since our Rust event now sends `tunnel_name`
            const prevUnlisten = get().setupUnlisten;
            if (!prevUnlisten) {
              const unlisten = await listen("tunnel-log", (event: any) => {
                const { tunnel_name, message, log_type } = event.payload;

                // Add log
                get().addLog(tunnel_name, {
                  timestamp: new Date().toISOString(),
                  message,
                  type:
                    log_type === "error"
                      ? "error"
                      : log_type === "success"
                        ? "success"
                        : "info",
                });

                // Check starting -> running
                if (
                  log_type === "success" ||
                  message.includes("Registered tunnel connection")
                ) {
                  const p = get().activeProcesses[tunnel_name];
                  if (p && p.status === "starting") {
                    set((state) => ({
                      activeProcesses: {
                        ...state.activeProcesses,
                        [tunnel_name]: {
                          ...p,
                          status: "running",
                          startedAt: Date.now(),
                        },
                      },
                    }));
                    // OS notification
                    if (
                      typeof window !== "undefined" &&
                      "Notification" in window &&
                      Notification.permission === "granted"
                    ) {
                      new Notification("Tunnel Connected 🚀", {
                        body: `${p.config.name || tunnel_name} → ${p.config.publicDomain}`,
                        icon: "/logo.png",
                        silent: false,
                      });
                    }
                  }
                }
              });
              set({ setupUnlisten: unlisten });
            }

            const cloudflaredPath = useSettingsStore.getState().cloudflaredPath;

            try {
              const rootDomain = useSettingsStore.getState().publicDomain;
              const subdomain = config.publicDomain.replace(
                `.${rootDomain}`,
                "",
              );
              await invoke("auto_tunnel_setup", {
                cloudflaredPath,
                tunnelName: config.tunnelName,
                subdomain,
              });
            } catch (err: any) {
              const errStr = String(err).toLowerCase();
              if (!errStr.includes("already exists")) {
                get().addLog(tunnelName, {
                  timestamp: new Date().toISOString(),
                  message: `[Warning] Tunnel setup error (may affect routing): ${err}`,
                  type: "error",
                });
              }
            }

            // If Inspector is enabled, start inspector server and override localUrl
            let finalLocalUrl = formattedLocalUrl;
            if (config.protocol === "http" && config.enableInspector) {
              try {
                const proxyPort: number = await invoke("start_inspector", {
                  targetUrl: formattedLocalUrl,
                  tunnelName: config.tunnelName,
                });
                finalLocalUrl = `http://127.0.0.1:${proxyPort}`;
                get().addLog(tunnelName, {
                  timestamp: new Date().toISOString(),
                  message: `Web Inspector enabled. Traffic routed through proxy on port ${proxyPort}`,
                  type: "info",
                });
              } catch (e) {
                get().addLog(tunnelName, {
                  timestamp: new Date().toISOString(),
                  message: `Failed to start Web Inspector: ${e}`,
                  type: "error",
                });
              }
            }

            await invoke("start_tunnel", {
              cloudflaredPath,
              localUrl: finalLocalUrl,
              publicDomain: config.localVhost || config.publicDomain,
              tunnelName: config.tunnelName,
              httpHostHeader: config.options.httpHostHeader,
              originServerName: config.options.originServerName,
              forceHttp2: config.options.forceHttp2,
              ipv4Only: config.options.ipv4Only,
            });
          } catch (e: any) {
            get().addLog(tunnelName, {
              timestamp: new Date().toISOString(),
              message: `Failed to start process: ${e}`,
              type: "error",
            });
            const p = get().activeProcesses[tunnelName];
            if (p) {
              set((state) => ({
                activeProcesses: {
                  ...state.activeProcesses,
                  [tunnelName]: { ...p, status: "error" },
                },
              }));
            }
          }
        } else {
          // Simulate startup in dev mode outside Tauri
          setTimeout(() => {
            const p = get().activeProcesses[tunnelName];
            if (p && p.status === "starting") {
              set((state) => ({
                activeProcesses: {
                  ...state.activeProcesses,
                  [tunnelName]: {
                    ...p,
                    status: "running",
                    logs: [
                      ...p.logs,
                      {
                        id: Date.now().toString(),
                        timestamp: new Date().toISOString(),
                        message: `[Simulated] Tunnel connected! Traffic routing to ${config.publicDomain}`,
                        type: "success",
                      },
                    ],
                  },
                },
              }));
            }
          }, 1500);
        }
      },

      stopTunnel: async (tunnelName) => {
        const { activeProcesses } = get();
        const activeProcess = activeProcesses[tunnelName];

        // Always attempt to stop — handles both tracked processes and orphaned ones
        // (e.g. after Windows logoff/logon when cloudflared kept running externally).
        if (invoke) {
          try {
            await invoke("stop_tunnel", { tunnelName });
            // Stop inspector only if we know it was enabled for this tunnel
            if (activeProcess?.config?.enableInspector) {
              await invoke("stop_inspector_for_tunnel", {
                tunnelName: activeProcess.config.tunnelName,
              }).catch(() => {});
            }
          } catch (e) {
            console.error(e);
          }
        }

        // Always clear the Cloudflare API connection state locally
        useCloudflareStore
          .getState()
          .updateTunnelLocally(tunnelName, { connections: [] });

        // Only update activeProcesses entry and save history when we had a tracked process
        if (activeProcess) {
          const stoppedAt = Date.now();
          const sessionRecord: SessionRecord = {
            id: Math.random().toString(36).substring(2, 9),
            name: activeProcess.config.name || tunnelName,
            localUrl: activeProcess.config.localUrl,
            publicDomain: activeProcess.config.publicDomain,
            startedAt: activeProcess.startedAt || stoppedAt,
            stoppedAt,
            durationMs: activeProcess.startedAt
              ? stoppedAt - activeProcess.startedAt
              : 0,
          };

          set((state) => ({
            activeProcesses: {
              ...state.activeProcesses,
              [tunnelName]: {
                ...activeProcess,
                status: "stopped",
                stoppedAt,
                logs: [
                  ...activeProcess.logs,
                  {
                    id: Date.now().toString(),
                    timestamp: new Date().toISOString(),
                    message: `Tunnel process stopped cleanly.`,
                    type: "info",
                  },
                ],
              },
            },
            history: [sessionRecord, ...state.history].slice(0, 200),
          }));
        }
      },

      stopAllTunnels: async () => {
        const { activeProcesses, stopTunnel } = get();
        for (const [tunnelName, activeProcess] of Object.entries(
          activeProcesses,
        )) {
          if (
            activeProcess.status === "running" ||
            activeProcess.status === "starting"
          ) {
            await stopTunnel(tunnelName);
          }
        }
      },

      addLog: (tunnelName, log) =>
        set((state) => {
          const p = state.activeProcesses[tunnelName];
          if (!p) return state;
          return {
            activeProcesses: {
              ...state.activeProcesses,
              [tunnelName]: {
                ...p,
                logs: [...p.logs, { ...log, id: Date.now().toString() }],
              },
            },
          };
        }),

      clearLogs: (tunnelName) =>
        set((state) => {
          const p = state.activeProcesses[tunnelName];
          if (!p) return state;
          return {
            activeProcesses: {
              ...state.activeProcesses,
              [tunnelName]: { ...p, logs: [] },
            },
          };
        }),

      clearHistory: () => set({ history: [] }),

      restartTunnel: async (tunnelName) => {
        const { activeProcesses, stopTunnel, startTunnel } = get();
        const p = activeProcesses[tunnelName];
        if (!p) return;
        const config = p.config;
        await stopTunnel(tunnelName);
        // brief delay so the process is fully stopped
        await new Promise((res) => setTimeout(res, 800));
        await startTunnel(config);
      },

      removeProcess: (tunnelName) =>
        set((state) => {
          const p = state.activeProcesses[tunnelName];
          if (!p || p.status !== "stopped") return state; // Only allow removing stopped processes
          const { [tunnelName]: _, ...rest } = state.activeProcesses;

          // If we're removing the selected process, we should probably clear the selection
          let newSelected = state.selectedLogTunnel;
          if (newSelected === tunnelName) {
            const remainingKeys = Object.keys(rest);
            newSelected = remainingKeys.length > 0 ? remainingKeys[0] : null;
          }

          return {
            activeProcesses: rest,
            selectedLogTunnel: newSelected,
          };
        }),
    }),
    {
      name: "vanguarch-storage",
      partialize: (state) => ({
        presets: state.presets,
        history: state.history,
      }),
    },
  ),
);
