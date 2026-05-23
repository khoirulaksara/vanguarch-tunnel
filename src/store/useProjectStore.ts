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
}

const MOCK_PROJECTS: DiscoveredProject[] = [
  {
    id: '1',
    name: 'arts',
    path: 'C:/laragon/www/arts',
    framework: 'WordPress',
    suggestedUrl: 'https://arts.test',
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
    
    const projectsDir = useSettingsStore.getState().projectsDirectory;
    
    if (invoke) {
      try {
        const foundProjects = await invoke('scan_projects', { dir: projectsDir });
        set({ projects: foundProjects, isScanning: false });
      } catch (err) {
        console.error("Failed to scan projects:", err);
        set({ isScanning: false });
      }
    } else {
      // Simulate scan delay
      await new Promise(resolve => setTimeout(resolve, 800));
      set({ projects: MOCK_PROJECTS, isScanning: false });
    }
  }
}));
