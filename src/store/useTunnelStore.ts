import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TunnelConfig, TunnelLog, TunnelProcess, ProcessStatus } from '../types';

// Optional Tauri imports (only available when running in Tauri context)
let invoke: any = null;
let listen: any = null;
(async () => {
  try {
    if ((window as any).__TAURI_INTERNALS__) {
      const core = await import('@tauri-apps/api/core');
      const event = await import('@tauri-apps/api/event');
      invoke = core.invoke;
      listen = event.listen;
    }
  } catch (e) {
    console.error("Not running in Tauri environment");
  }
})();

interface TunnelStore {
  presets: TunnelConfig[];
  activeProcess: TunnelProcess | null;
  addPreset: (preset: TunnelConfig) => void;
  removePreset: (id: string) => void;
  updatePreset: (id: string, preset: Partial<TunnelConfig>) => void;
  
  // Process Management
  startTunnel: (config: TunnelConfig) => Promise<void>;
  stopTunnel: () => Promise<void>;
  addLog: (log: Omit<TunnelLog, 'id'>) => void;
  setupUnlisten: null | (() => void);
}

export const useTunnelStore = create<TunnelStore>()(
  persist(
    (set, get) => ({
      presets: [],
      activeProcess: null,
      setupUnlisten: null,
      
      addPreset: (preset) => set((state) => ({ presets: [...state.presets, preset] })),
      removePreset: (id) => set((state) => ({ presets: state.presets.filter(p => p.id !== id) })),
      updatePreset: (id, presetUpdate) => set((state) => ({
        presets: state.presets.map(p => p.id === id ? { ...p, ...presetUpdate } : p)
      })),
      
      startTunnel: async (config) => {
        const command = `cloudflared tunnel --url ${config.localUrl} ${config.options.httpHostHeader ? '--http-host-header ' + config.publicDomain : ''} run ${config.tunnelName}`;
        
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

        if (invoke && listen) {
          try {
            // Unlisten previous if exists
            const prevUnlisten = get().setupUnlisten;
            if (prevUnlisten) prevUnlisten();

            // Set up log listener
            const unlisten = await listen('tunnel-log', (event: any) => {
              const { message, log_type } = event.payload;
              get().addLog({
                timestamp: new Date().toISOString(),
                message,
                type: log_type === 'error' ? 'error' : log_type === 'success' ? 'success' : 'info'
              });

              // If we see connection established, mark it as running. 
              // Some success strings might be in info logs too
              if (log_type === 'success' || message.includes('Registered tunnel connection')) {
                const p = get().activeProcess;
                if (p && p.status === 'starting') {
                   set({ activeProcess: { ...p, status: 'running' } });
                }
              }
            });
            set({ setupUnlisten: unlisten });

            await invoke('start_tunnel', {
              localUrl: config.localUrl,
              publicDomain: config.publicDomain,
              tunnelName: config.tunnelName,
              httpHostHeader: config.options.httpHostHeader,
              originServerName: config.options.originServerName,
              forceHttp2: config.options.forceHttp2,
              ipv4Only: config.options.ipv4Only
            });
            
          } catch (e: any) {
            get().addLog({
              timestamp: new Date().toISOString(),
              message: `Failed to start process: ${e}`,
              type: 'error'
            });
            const p = get().activeProcess;
            if (p) set({ activeProcess: { ...p, status: 'error' } });
          }
        } else {
          // Simulate startup in dev mode outside Tauri
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
                    message: `[Simulated] Tunnel connected! Traffic routing to ${config.publicDomain}`,
                    type: 'success'
                  }]
                }
              });
            }
          }, 1500);
        }
      },
      
      stopTunnel: async () => {
        const { activeProcess } = get();
        if (activeProcess) {
          if (invoke) {
            try {
             await invoke('stop_tunnel');
            } catch (e) {
              console.error(e);
            }
          }
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

