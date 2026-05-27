/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { ConfirmModal } from './components/ui/ConfirmModal';
import { ManualTunnel } from './components/ManualTunnel';
import { ProjectList } from './components/ProjectList';
import { PresetList } from './components/PresetList';
import { TunnelList } from './components/TunnelList';
import { LogsView } from './components/LogsView';
import { SettingsView } from './components/SettingsView';
import { AboutView } from './components/AboutView';
import { ServiceStatus } from './components/ServiceStatus';
import { Titlebar } from './components/Titlebar';
import { CloudflaredBanner } from './components/CloudflaredBanner';
import { QuickShareView } from './components/QuickShareView';
import { InspectorView } from './components/InspectorView';
import { Shield, TerminalSquare, Plug, FolderSearch, Bookmark, Settings, Activity, Cloud, Info, Share2, MousePointerClick } from 'lucide-react';
import { cn } from './lib/utils';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { listen as listenLog } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useCloudflareStore } from './store/useCloudflareStore';
import { useSettingsStore } from './store/useSettingsStore';
import { useTunnelStore } from './store/useTunnelStore';
import { useInspectorStore } from './store/useInspectorStore';

type Tab = 'manual' | 'presets' | 'projects' | 'tunnels' | 'share' | 'inspector' | 'settings' | 'about';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('manual');
  const [isLogsMinimized, setIsLogsMinimized] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const { activeProcesses } = useTunnelStore();
  const { tunnels, fetchTunnels } = useCloudflareStore();
  const { cloudflaredPath } = useSettingsStore();

  const [now, setNow] = useState(Date.now());
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);

  useEffect(() => {
    fetchTunnels(cloudflaredPath);
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [cloudflaredPath, fetchTunnels]);

  useEffect(() => {
    // Reveal main app after splash
    const timer = setTimeout(async () => {
      setShowSplash(false);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let unlisten: any;
    let isMounted = true;
    
    async function setupTray() {
      if (!(window as any).__TAURI_INTERNALS__) return;
      try {
        const unlistenFn = await listen('tray-quit-requested', async () => {
          const tunnelState = useTunnelStore.getState();
          const p = tunnelState.activeProcesses;
          const hasActive = Object.values(p).some(x => x.status === 'running' || x.status === 'starting');
          
          if (hasActive) {
            const win = getCurrentWindow();
            await win.show();
            await win.setFocus();
            setExitConfirmOpen(true);
          } else {
            await invoke('force_exit');
          }
        });
        
        if (isMounted) {
          unlisten = unlistenFn;
        } else {
          unlistenFn();
        }

        // Global Inspector Listener
        const unlistenInspector = await listen<any>('inspector-log', (event) => {
          const payload = event.payload;
          if (payload.response) {
            useInspectorStore.getState().updateResponse(payload.log_id, payload.response);
          } else {
            useInspectorStore.getState().addLog(payload);
          }
        });

        if (isMounted) {
          const oldUnlisten = unlisten;
          unlisten = () => {
            if (oldUnlisten) oldUnlisten();
            unlistenInspector();
          };
        } else {
          unlistenInspector();
        }
      } catch (err) {
        console.error("Tray setup error:", err);
      }
    }
    
    setupTray();
    
    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, []);

  const isRunning = Object.values(activeProcesses).some(p => p.status === 'running');
  const isStarting = Object.values(activeProcesses).some(p => p.status === 'starting');

  // Count online tunnels. We map over the ones that have connections > 0, 
  // and we make sure not to double count our own if it has connections in the api response.
  let apiOnlineTunnels = Array.isArray(tunnels) ? tunnels.filter(t => t.connections && t.connections.length > 0).map(t => t.name) : [];
  
  // Exclude tunnels we recently stopped (within the last 60 seconds) to prevent stale Cloudflare API data 
  // from showing them as online immediately after stopping.
  apiOnlineTunnels = apiOnlineTunnels.filter(tunnelName => {
    const p = activeProcesses[tunnelName];
    if (p && p.status === 'stopped' && p.stoppedAt && (now - p.stoppedAt < 60000)) {
      return false; // Ignore connections, we just stopped it
    }
    return true;
  });

  Object.values(activeProcesses).forEach(p => {
    if (p.status === 'running' && p.config?.tunnelName && !apiOnlineTunnels.includes(p.config.tunnelName)) {
      apiOnlineTunnels.push(p.config.tunnelName);
    }
  });
  
  const onlineCount = apiOnlineTunnels.length;
  const statusColor = isRunning ? "text-green-500" : isStarting ? "text-orange-500" : "text-[#52525b]";
  const statusText = isRunning ? "ONLINE" : isStarting ? "STARTING" : "OFFLINE";

  const handleConfirmExit = async () => {
    try {
      const tunnelState = useTunnelStore.getState();
      await tunnelState.stopAllTunnels();
      await invoke('force_exit');
    } catch (e) {
      console.error(e);
    }
  };

  if (showSplash) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#09090b] font-sans selection:bg-orange-500/30">
        <style>
          {`
            @keyframes load-pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: .7; transform: scale(0.95); }
            }
            @keyframes load-progress {
              0% { left: -50%; }
              100% { left: 100%; }
            }
          `}
        </style>
        <img 
          src="/icon.png" 
          alt="Vanguarch Logo" 
          className="w-16 h-16 object-contain mb-6"
          style={{ animation: 'load-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} 
        />
        <div className="w-48 h-1 bg-[#27272a] rounded-full overflow-hidden relative">
          <div 
            className="absolute top-0 left-0 h-full w-1/2 bg-orange-500 rounded-full" 
            style={{ animation: 'load-progress 1.5s ease-in-out infinite' }}
          ></div>
        </div>
        <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-[#52525b]">
          Loading Vanguarch...
        </div>
      </div>
    );
  }

  const activeCount = Object.values(activeProcesses).filter(p => p.status === 'running' || p.status === 'starting').length;
  
  const exitMessage = activeCount > 1 
    ? `There are ${activeCount} active tunnels currently running. Are you sure you want to exit? They will be forcefully stopped.`
    : `There is 1 active tunnel currently running. Are you sure you want to exit? It will be forcefully stopped.`;

  return (
    <div className="flex flex-col h-screen bg-[#09090b] text-[#e4e4e7] font-sans overflow-hidden selection:bg-orange-500/30">
      <Titlebar />
      <CloudflaredBanner />
      <div className="flex flex-1 overflow-hidden min-h-0">
        <Toaster theme="dark" toastOptions={{ className: 'font-sans' }} />
      <ConfirmModal
        isOpen={exitConfirmOpen}
        onClose={() => setExitConfirmOpen(false)}
        onConfirm={handleConfirmExit}
        title="Exit Vanguarch"
        message={exitMessage}
        confirmText="Exit"
        variant="danger"
      />
      {/* Sidebar Navigation */}
      <div className="w-16 sm:w-64 bg-[#0c0c0e] border-r border-[#27272a] flex flex-col transition-all duration-300 z-10 shrink-0">
        <div className="h-16 flex items-center justify-center sm:justify-start sm:px-6 border-b border-[#27272a] shrink-0">
          <div
            className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500"
            style={{
              WebkitMaskImage: `url(/icon.png)`,
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              WebkitMaskSize: "contain",
            }}
          />
          <span className="ml-3 font-bold text-sm uppercase tracking-tight hidden sm:block">
            Vanguarch
          </span>
        </div>
        
        <nav className="flex-1 py-6 space-y-2 px-2 sm:px-3">
          <NavItem 
            icon={<Plug className="w-5 h-5" />} 
            label="Manual Tunnel" 
            active={activeTab === 'manual'} 
            onClick={() => setActiveTab('manual')} 
          />
          <NavItem 
            icon={<Bookmark className="w-5 h-5" />} 
            label="Saved Presets" 
            active={activeTab === 'presets'} 
            onClick={() => setActiveTab('presets')} 
          />
          <NavItem 
            icon={<FolderSearch className="w-5 h-5" />} 
            label="Local Projects" 
            active={activeTab === 'projects'} 
            onClick={() => setActiveTab('projects')} 
          />
          <NavItem 
            icon={<Cloud className="w-5 h-5" />} 
            label="Cloud Tunnels" 
            active={activeTab === 'tunnels'} 
            onClick={() => setActiveTab('tunnels')} 
          />
          <NavItem 
            icon={<Share2 className="w-5 h-5" />} 
            label="Quick Share" 
            active={activeTab === 'share'} 
            onClick={() => setActiveTab('share')} 
          />
          <NavItem 
            icon={<MousePointerClick className="w-5 h-5" />} 
            label="Inspector" 
            active={activeTab === 'inspector'} 
            onClick={() => setActiveTab('inspector')} 
          />
          <NavItem 
            icon={<Settings className="w-5 h-5" />} 
            label="Settings" 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
          />
          <NavItem 
            icon={<Info className="w-5 h-5" />} 
            label="About" 
            active={activeTab === 'about'} 
            onClick={() => setActiveTab('about')} 
          />
        </nav>
        
        <ServiceStatus />
        
        <div className="p-4 border-t border-[#27272a] hidden sm:block">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#52525b] font-mono">v2.1.0</span>
            <div className={`flex items-center gap-1.5 text-[10px] font-bold tracking-wider ${statusColor}`}>
              <Activity className="w-3.5 h-3.5" />
              {statusText} {onlineCount > 0 && `(${onlineCount})`}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#09090b]">
        
        {/* Top Region - Configuration */}
        <div className="flex-1 border-b border-[#27272a] flex overflow-hidden">
          {activeTab === 'manual' && <ManualTunnel />}
          {activeTab === 'presets' && <PresetList />}
          {activeTab === 'projects' && <ProjectList />}
          {activeTab === 'tunnels' && <TunnelList />}
          {activeTab === 'share' && <QuickShareView />}
          {activeTab === 'inspector' && <InspectorView />}
          {activeTab === 'settings' && <SettingsView />}
          {activeTab === 'about' && <AboutView />}
        </div>
        
        {/* Bottom Region - Logs */}
        <div className={cn("shrink-0 flex flex-col bg-[#09090b] transition-[height] duration-300 ease-in-out", isLogsMinimized ? "h-8 sm:h-[34px] border-t-0" : "h-[40%]")}>
          <LogsView isMinimized={isLogsMinimized} onToggleMinimize={() => setIsLogsMinimized(!isLogsMinimized)} />
        </div>

      </div>
    </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-center sm:justify-start gap-3 px-3 py-2.5 rounded-md transition-colors duration-200 group relative",
        active 
          ? "bg-[#18181b] border-[#27272a] text-orange-400 border" 
          : "text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#18181b]"
      )}
      title={label}
    >
      <div className={cn("transition-transform duration-200", active ? "scale-100" : "scale-95 group-hover:scale-100")}>
        {icon}
      </div>
      <span className={cn("text-xs font-medium hidden sm:block", active ? "text-orange-400" : "")}>{label}</span>
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-orange-500 rounded-r-full hidden sm:block" />
      )}
    </button>
  );
}

