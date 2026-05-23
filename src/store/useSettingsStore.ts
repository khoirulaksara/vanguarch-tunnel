import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  cloudflaredPath: string;
  setCloudflaredPath: (path: string) => void;
  projectsDirectory: string;
  setProjectsDirectory: (path: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      cloudflaredPath: '',
      setCloudflaredPath: (path) => set({ cloudflaredPath: path }),
      projectsDirectory: 'C:/laragon/www',
      setProjectsDirectory: (path) => set({ projectsDirectory: path }),
    }),
    {
      name: 'vanguarch-settings',
    }
  )
);
