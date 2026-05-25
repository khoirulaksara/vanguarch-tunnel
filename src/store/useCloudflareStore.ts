import { create } from 'zustand';

interface CloudflareTunnel {
  id: string;
  name: string;
  createdAt: string;
  deletedAt: string;
  connections: any[];
}

interface CloudflareStore {
  tunnels: CloudflareTunnel[];
  loading: boolean;
  error: string | null;
  fetchTunnels: (cloudflaredPath: string) => Promise<void>;
  updateTunnelLocally: (tunnelName: string, update: Partial<CloudflareTunnel>) => void;
  deleteTunnel: (cloudflaredPath: string, tunnelName: string) => Promise<void>;
}

export const useCloudflareStore = create<CloudflareStore>((set, get) => ({
  tunnels: [],
  loading: false,
  error: null,
  updateTunnelLocally: (tunnelName, update) => set((state) => ({
    tunnels: state.tunnels.map(t => t.name === tunnelName ? { ...t, ...update } : t)
  })),
  fetchTunnels: async (cloudflaredPath: string) => {
    set({ loading: true, error: null });
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const core = await import('@tauri-apps/api/core');
        const jsonStr = await core.invoke<string>('list_tunnels', { cloudflaredPath });
        const data = JSON.parse(jsonStr);
        set({ tunnels: Array.isArray(data) ? data : [], loading: false });
      } else {
        setTimeout(() => {
          set({
            tunnels: [
              { id: '123', name: 'vanguarch-arts-demo', createdAt: new Date().toISOString(), deletedAt: '', connections: [{}] }
            ],
            loading: false
          });
        }, 1000);
      }
    } catch (err: any) {
      set({ error: err.message || String(err), loading: false });
    }
  },
  deleteTunnel: async (cloudflaredPath: string, tunnelName: string) => {
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const core = await import('@tauri-apps/api/core');
        await core.invoke('delete_tunnel', { cloudflaredPath, tunnelName });
        // Refresh immediately after deleting
        await get().fetchTunnels(cloudflaredPath);
      } else {
        // dummy delay
        await new Promise(r => setTimeout(r, 1000));
        set(state => ({
          tunnels: state.tunnels.filter(t => t.name !== tunnelName)
        }));
      }
    } catch (err: any) {
      throw new Error(err.message || String(err));
    }
  }
}));
