import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TunnelConfig, TunnelLog, TunnelProcess, ProcessStatus } from '../types';
import { useSettingsStore } from './useSettingsStore';
import { useCloudflareStore } from './useCloudflareStore';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface TunnelStore {
  presets: TunnelConfig[];
  activeProcesses: Record<string, TunnelProcess>;
  selectedLogTunnel: string | null;
  addPreset: (preset: TunnelConfig) => void;
  removePreset: (id: string) => void;
  updatePreset: (id: string, preset: Partial<TunnelConfig>) => void;
  selectLogTunnel: (tunnelName: string | null) => void;
  
  // Process Management
  startTunnel: (config: TunnelConfig) => Promise<void>;
  stopTunnel: (tunnelName: string) => Promise<void>;
  stopAllTunnels: () => Promise<void>;
  addLog: (tunnelName: string, log: Omit<TunnelLog, 'id'>) => void;
  clearLogs: (tunnelName: string) => void;
  removeProcess: (tunnelName: string) => void;
  setupUnlisten: null | (() => void);
}

export const useTunnelStore = create<TunnelStore>()(
  persist(
    (set, get) => ({
      presets: [],
      activeProcesses: {},
      selectedLogTunnel: null,
      setupUnlisten: null,
      
      addPreset: (preset) => set((state) => ({ presets: [...state.presets, preset] })),
      removePreset: (id) => set((state) => ({ presets: state.presets.filter(p => p.id !== id) })),
      updatePreset: (id, presetUpdate) => set((state) => ({
        presets: state.presets.map(p => p.id === id ? { ...p, ...presetUpdate } : p)
      })),
      selectLogTunnel: (tunnelName) => set({ selectedLogTunnel: tunnelName }),
      
      startTunnel: async (config) => {
        const tunnelName = config.tunnelName;
        const command = `cloudflared tunnel --url ${config.localUrl} ${config.options.httpHostHeader && config.localVhost ? '--http-host-header ' + config.localVhost : ''} ${config.options.originServerName && config.localVhost ? '--origin-server-name ' + config.localVhost : ''} run ${config.tunnelName}`.replace(/\s+/g, ' ').trim();
        
        set((state) => ({
          activeProcesses: {
            ...state.activeProcesses,
            [tunnelName]: {
              config,
              status: 'starting',
              command,
              logs: [{
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                message: `Starting cloudflared process...`,
                type: 'info'
              }, {
                id: (Date.now() + 1).toString(),
                timestamp: new Date().toISOString(),
                message: command,
                type: 'info'
              }]
            }
          },
          selectedLogTunnel: tunnelName
        }));

        if (invoke && listen) {
          try {
            // Unlisten previous if exists. We only need one global listener for all tunnnels since our Rust event now sends `tunnel_name`
            const prevUnlisten = get().setupUnlisten;
            if (!prevUnlisten) {
              const unlisten = await listen('tunnel-log', (event: any) => {
                const { tunnel_name, message, log_type } = event.payload;
                
                // Add log
                get().addLog(tunnel_name, {
                  timestamp: new Date().toISOString(),
                  message,
                  type: log_type === 'error' ? 'error' : log_type === 'success' ? 'success' : 'info'
                });

                // Check starting -> running
                if (log_type === 'success' || message.includes('Registered tunnel connection')) {
                  const p = get().activeProcesses[tunnel_name];
                  if (p && p.status === 'starting') {
                    set((state) => ({
                      activeProcesses: {
                        ...state.activeProcesses,
                        [tunnel_name]: { ...p, status: 'running' }
                      }
                    }));
                  }
                }
              });
              set({ setupUnlisten: unlisten });
            }

            const cloudflaredPath = useSettingsStore.getState().cloudflaredPath;

            await invoke('start_tunnel', {
              cloudflaredPath,
              localUrl: config.localUrl,
              publicDomain: config.localVhost || config.publicDomain,
              tunnelName: config.tunnelName,
              httpHostHeader: config.options.httpHostHeader,
              originServerName: config.options.originServerName,
              forceHttp2: config.options.forceHttp2,
              ipv4Only: config.options.ipv4Only
            });
            
          } catch (e: any) {
            get().addLog(tunnelName, {
              timestamp: new Date().toISOString(),
              message: `Failed to start process: ${e}`,
              type: 'error'
            });
            const p = get().activeProcesses[tunnelName];
            if (p) {
              set((state) => ({
                activeProcesses: {
                  ...state.activeProcesses,
                  [tunnelName]: { ...p, status: 'error' }
                }
              }));
            }
          }
        } else {
          // Simulate startup in dev mode outside Tauri
          setTimeout(() => {
            const p = get().activeProcesses[tunnelName];
            if (p && p.status === 'starting') {
              set((state) => ({
                activeProcesses: {
                  ...state.activeProcesses,
                  [tunnelName]: {
                    ...p,
                    status: 'running',
                    logs: [...p.logs, {
                      id: Date.now().toString(),
                      timestamp: new Date().toISOString(),
                      message: `[Simulated] Tunnel connected! Traffic routing to ${config.publicDomain}`,
                      type: 'success'
                    }]
                  }
                }
              }));
            }
          }, 1500);
        }
      },
      
      stopTunnel: async (tunnelName) => {
        const { activeProcesses } = get();
        const activeProcess = activeProcesses[tunnelName];
        if (activeProcess) {
          if (invoke) {
            try {
             await invoke('stop_tunnel', { tunnelName });
            } catch (e) {
              console.error(e);
            }
          }
          
          useCloudflareStore.getState().updateTunnelLocally(tunnelName, { connections: [] });

          set((state) => ({
            activeProcesses: {
              ...state.activeProcesses,
              [tunnelName]: {
                ...activeProcess,
                status: 'stopped',
                stoppedAt: Date.now(),
                logs: [...activeProcess.logs, {
                  id: Date.now().toString(),
                  timestamp: new Date().toISOString(),
                  message: `Tunnel process stopped cleanly.`,
                  type: 'info'
                }]
              }
            }
          }));
        }
      },

      stopAllTunnels: async () => {
        const { activeProcesses, stopTunnel } = get();
        for (const [tunnelName, activeProcess] of Object.entries(activeProcesses)) {
          if (activeProcess.status === 'running' || activeProcess.status === 'starting') {
            await stopTunnel(tunnelName);
          }
        }
      },
      
      addLog: (tunnelName, log) => set((state) => {
        const p = state.activeProcesses[tunnelName];
        if (!p) return state;
        return {
          activeProcesses: {
            ...state.activeProcesses,
            [tunnelName]: {
              ...p,
              logs: [...p.logs, { ...log, id: Date.now().toString() }]
            }
          }
        };
      }),
      
      clearLogs: (tunnelName) => set((state) => {
        const p = state.activeProcesses[tunnelName];
        if (!p) return state;
        return {
          activeProcesses: {
            ...state.activeProcesses,
            [tunnelName]: { ...p, logs: [] }
          }
        };
      }),

      removeProcess: (tunnelName) => set((state) => {
        const p = state.activeProcesses[tunnelName];
        if (!p || p.status !== 'stopped') return state; // Only allow removing stopped processes
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
      })
    }),
    {
      name: 'vanguarch-storage',
      partialize: (state) => ({ presets: state.presets }), // Only persist presets
    }
  )
);

