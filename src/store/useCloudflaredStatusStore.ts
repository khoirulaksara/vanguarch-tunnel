import { create } from 'zustand';

interface CloudflaredStatusStore {
  isInstalled: boolean | null;
  isDownloading: boolean;
  downloadProgress: number;
  checkStatus: () => Promise<void>;
  downloadCloudflared: () => Promise<void>;
}

export const useCloudflaredStatusStore = create<CloudflaredStatusStore>((set) => ({
  isInstalled: null,
  isDownloading: false,
  downloadProgress: 0,
  
  checkStatus: async () => {
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const core = await import('@tauri-apps/api/core');
        const installed = await core.invoke<boolean>('check_cloudflared_status');
        set({ isInstalled: installed });
      } else {
        // Mock for web preview
        set({ isInstalled: true });
      }
    } catch (error) {
      console.error("Failed to check cloudflared status:", error);
      set({ isInstalled: false });
    }
  },
  
  downloadCloudflared: async () => {
    set({ isDownloading: true, downloadProgress: 0 });
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const core = await import('@tauri-apps/api/core');
        const event = await import('@tauri-apps/api/event');
        
        const unlisten = await event.listen<number>('download_progress', (e) => {
          set({ downloadProgress: e.payload });
        });

        await core.invoke('download_cloudflared');
        
        unlisten();
        
        // After successful download, verify status again
        set({ isInstalled: true, isDownloading: false, downloadProgress: 100 });
      } else {
        // Mock download for web preview
        for (let i = 0; i <= 100; i += 10) {
          await new Promise(r => setTimeout(r, 200));
          set({ downloadProgress: i });
        }
        set({ isInstalled: true, isDownloading: false, downloadProgress: 100 });
      }
    } catch (error) {
      console.error("Failed to download cloudflared:", error);
      set({ isDownloading: false });
      alert(`Download failed: ${error}`);
    }
  }
}));
