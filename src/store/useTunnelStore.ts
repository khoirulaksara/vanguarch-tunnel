import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TunnelConfig, TunnelLog, TunnelProcess, ProcessStatus, DiscoveredProject } from '../types';

interface TunnelStore {
  presets: TunnelConfig[];
  activeProcess: TunnelProcess | null;
  addPreset: (preset: TunnelConfig) => void;
  removePreset: (id: string) => void;
  updatePreset: (id: string, preset: Partial<TunnelConfig>) => void;
  
  // Process Management
  startTunnel: (config: TunnelConfig) => void;
  stopTunnel: () => void;
  addLog: (log: Omit<TunnelLog, 'id'>) => void;
}

export const useTunnelStore = create<TunnelStore>()(
  persist(
    (set, get) => ({
      presets: [],
      activeProcess: null,
      
      addPreset: (preset) => set((state) => ({ presets: [...state.presets, preset] })),
      removePreset: (id) => set((state) => ({ presets: state.presets.filter(p => p.id !== id) })),
      updatePreset: (id, presetUpdate) => set((state) => ({
        presets: state.presets.map(p => p.id === id ? { ...p, ...presetUpdate } : p)
      })),
      
      startTunnel: (config) => {
        const command = `cloudflared tunnel --url ${config.localUrl} ${config.options.httpHostHeader ? '--http-host-header' : ''} run ${config.tunnelName}`;
        
        set({
          activeProcess: {
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
        });

        // Simulate startup
        setTimeout(() => {
          const { activeProcess } = get();
          if (activeProcess && activeProcess.status === 'starting') {
            set({
              activeProcess: {
                ...activeProcess,
                status: 'running',
                logs: [...activeProcess.logs, {
                  id: Date.now().toString(),
                  timestamp: new Date().toISOString(),
                  message: `Tunnel connected! Traffic routing to ${config.publicDomain}`,
                  type: 'success'
                }]
              }
            });
          }
        }, 1500);
      },
      
      stopTunnel: () => {
        const { activeProcess } = get();
        if (activeProcess) {
          set({
            activeProcess: {
              ...activeProcess,
              status: 'stopped',
              logs: [...activeProcess.logs, {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                message: `Tunnel process stopped cleanly.`,
                type: 'info'
              }]
            }
          });
        }
      },
      
      addLog: (log) => set((state) => {
        if (!state.activeProcess) return state;
        return {
          activeProcess: {
            ...state.activeProcess,
            logs: [...state.activeProcess.logs, { ...log, id: Date.now().toString() }]
          }
        };
      })
    }),
    {
      name: 'vanguarch-storage',
      partialize: (state) => ({ presets: state.presets }), // Only persist presets
    }
  )
);
