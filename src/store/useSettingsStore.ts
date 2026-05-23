import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  cloudflaredPath: string;
  setCloudflaredPath: (path: string) => void;
  
  // deprecated, kept for migration
  projectsDirectories?: string[];
  
  workspaceDirectories: string[];
  setWorkspaceDirectories: (paths: string[]) => void;
  
  singleProjectDirectories: string[];
  setSingleProjectDirectories: (paths: string[]) => void;
  
  publicDomain: string;
  setPublicDomain: (domain: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      cloudflaredPath: '',
      setCloudflaredPath: (path) => set({ cloudflaredPath: path }),
      
      workspaceDirectories: ['C:/laragon/www'],
      setWorkspaceDirectories: (paths) => set({ workspaceDirectories: paths }),
      
      singleProjectDirectories: [],
      setSingleProjectDirectories: (paths) => set({ singleProjectDirectories: paths }),
      
      publicDomain: '',
      setPublicDomain: (domain) => set({ publicDomain: domain }),
    }),
    {
      name: 'vanguarch-settings',
      onRehydrateStorage: () => (state) => {
        if (state && state.projectsDirectories && state.projectsDirectories.length > 0) {
          // migrate old projectsDirectories to workspaceDirectories
          const newWorkspaces = new Set([...state.workspaceDirectories, ...state.projectsDirectories]);
          state.workspaceDirectories = Array.from(newWorkspaces);
          // clear old
          state.projectsDirectories = undefined;
        }
      }
    }
  )
);
