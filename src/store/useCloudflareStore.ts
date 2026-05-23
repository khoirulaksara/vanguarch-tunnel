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
}

export const useCloudflareStore = create<CloudflareStore>((set) => ({
  tunnels: [],
  loading: false,
  error: null,
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
  }
}));
