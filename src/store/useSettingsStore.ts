import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  cloudflaredPath: string;
  setCloudflaredPath: (path: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      cloudflaredPath: '',
      setCloudflaredPath: (path) => set({ cloudflaredPath: path }),
    }),
    {
      name: 'vanguarch-settings',
    }
  )
);
