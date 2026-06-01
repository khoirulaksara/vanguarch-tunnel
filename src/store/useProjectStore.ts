import { create } from 'zustand';
import { DiscoveredProject } from '../types';
import { useSettingsStore } from './useSettingsStore';
import { invoke } from '@tauri-apps/api/core';

interface ProjectStore {
  projects: DiscoveredProject[];
  isScanning: boolean;
  scanProjects: () => Promise<void>;
  injectWpHelper: (id: string, path: string) => Promise<string>;
  injectLaravelTrustProxies: (id: string, path: string) => Promise<string>;
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
    laravelProxyInstalled: false,
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
    const workspaces = state.workspaceDirectories || (state.projectsDirectories ? state.projectsDirectories : (state.projectsDirectory ? [state.projectsDirectory] : ['C:/laragon/www']));
    const singles = state.singleProjectDirectories || [];
    
    if (invoke) {
      try {
        let allProjects: any[] = [];
        
        // Scan workspaces
        for (const dir of workspaces) {
          try {
            const foundProjects = await invoke('scan_projects', { dir, isWorkspace: true });
            allProjects = [...allProjects, ...(foundProjects as any[])];
          } catch (err) {
            console.error(`Failed to scan workspace ${dir}:`, err);
          }
        }
        
        // Scan single projects
        for (const dir of singles) {
          try {
            const foundProjects = await invoke('scan_projects', { dir, isWorkspace: false });
            allProjects = [...allProjects, ...(foundProjects as any[])];
          } catch (err) {
            console.error(`Failed to scan single project ${dir}:`, err);
          }
        }
        
        // Sort by path for deterministic deduplication order
        allProjects.sort((a, b) => a.path.localeCompare(b.path));
 
        // Deduplicate names
        const nameCounts: Record<string, number> = {};
        for (const p of allProjects) {
          const originalName = p.name;
          if (nameCounts[originalName] !== undefined) {
            nameCounts[originalName]++;
            p.name = `${originalName}-${nameCounts[originalName]}`;
          } else {
            nameCounts[originalName] = 0;
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
      
      const mockProjects = JSON.parse(JSON.stringify(MOCK_PROJECTS));
      mockProjects.sort((a, b) => a.path.localeCompare(b.path));
      const mockNameCounts: Record<string, number> = {};
      for (const p of mockProjects) {
        const originalName = p.name;
        if (mockNameCounts[originalName] !== undefined) {
          mockNameCounts[originalName]++;
          p.name = `${originalName}-${mockNameCounts[originalName]}`;
        } else {
          mockNameCounts[originalName] = 0;
        }
      }
 
      set({ projects: mockProjects, isScanning: false });
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
  },
  injectLaravelTrustProxies: async (id: string, path: string) => {
    if (invoke) {
      try {
        const msg = await invoke('inject_laravel_trust_proxies', { projectPath: path });
        set(state => ({
          projects: state.projects.map(p => 
            p.id === id ? { ...p, laravelProxyInstalled: true } : p
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
          p.id === id ? { ...p, laravelProxyInstalled: true } : p
        )
      }));
      return "Berhasil mengonfigurasi trust proxies (Mock)";
    }
  }
}));
