import { create } from 'zustand';
import { DiscoveredProject } from '../types';
import { useSettingsStore } from './useSettingsStore';

// Optional Tauri imports
let invoke: any = null;
(async () => {
  try {
    if ((window as any).__TAURI_INTERNALS__) {
      const core = await import('@tauri-apps/api/core');
      invoke = core.invoke;
    }
  } catch (e) {
    console.error("Not running in Tauri environment");
  }
})();

interface ProjectStore {
  projects: DiscoveredProject[];
  isScanning: boolean;
  scanProjects: () => Promise<void>;
  injectWpHelper: (id: string, path: string) => Promise<string>;
}

const MOCK_PROJECTS: DiscoveredProject[] = [
  {
    id: '1',
    name: 'arts',
    path: 'C:/laragon/www/arts',
    framework: 'WordPress',
    suggestedUrl: 'https://arts.test',
    wpHelperInstalled: false,
  },
  {
    id: '2',
    name: 'api-gateway',
    path: 'C:/laragon/www/api-gateway',
    framework: 'Laravel',
    suggestedUrl: 'http://localhost:8000',
  },
  {
    id: '3',
    name: 'frontend-dash',
    path: 'C:/laragon/www/frontend-dash',
    framework: 'Next.js',
    suggestedUrl: 'http://localhost:3000',
  },
  {
    id: '4',
    name: 'admin-panel',
    path: 'C:/laragon/www/admin-panel',
    framework: 'Vite',
    suggestedUrl: 'http://localhost:5173',
  }
];

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  isScanning: false,
  scanProjects: async () => {
    set({ isScanning: true });
    
    // We get the directories state. Note we fallback to old projectsDirectory if migration is incomplete
    const state = useSettingsStore.getState() as any;
    const dirs = state.projectsDirectories || (state.projectsDirectory ? [state.projectsDirectory] : ['C:/laragon/www']);
    
    if (invoke) {
      try {
        let allProjects: any[] = [];
        for (const dir of dirs) {
          try {
            const foundProjects = await invoke('scan_projects', { dir });
            allProjects = [...allProjects, ...(foundProjects as any[])];
          } catch (err) {
            console.error(`Failed to scan ${dir}:`, err);
          }
        }
        set({ projects: allProjects, isScanning: false });
      } catch (err) {
        console.error("Failed to scan projects:", err);
        set({ isScanning: false });
      }
    } else {
      // Simulate scan delay
      await new Promise(resolve => setTimeout(resolve, 800));
      set({ projects: MOCK_PROJECTS, isScanning: false });
    }
  },
  injectWpHelper: async (id: string, path: string) => {
    if (invoke) {
      try {
        const msg = await invoke('inject_wp_helper', { path });
        set(state => ({
          projects: state.projects.map(p => 
            p.id === id ? { ...p, wpHelperInstalled: true } : p
          )
        }));
        return msg as string;
      } catch (err) {
        throw new Error(String(err));
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, 500));
      set(state => ({
        projects: state.projects.map(p => 
          p.id === id ? { ...p, wpHelperInstalled: true } : p
        )
      }));
      return "Berhasil memasang WordPress helper (Mock)";
    }
  }
}));
