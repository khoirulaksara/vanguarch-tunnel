import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  cloudflaredPath: string;
  setCloudflaredPath: (path: string) => void;
  projectsDirectories: string[];
  setProjectsDirectories: (paths: string[]) => void;
  publicDomain: string;
  setPublicDomain: (domain: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      cloudflaredPath: '',
      setCloudflaredPath: (path) => set({ cloudflaredPath: path }),
      projectsDirectories: ['C:/laragon/www'],
      setProjectsDirectories: (paths) => set({ projectsDirectories: paths }),
      publicDomain: '',
      setPublicDomain: (domain) => set({ publicDomain: domain }),
    }),
    {
      name: 'vanguarch-settings',
    }
  )
);
