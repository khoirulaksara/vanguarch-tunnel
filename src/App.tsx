/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ManualTunnel } from './components/ManualTunnel';
import { ProjectList } from './components/ProjectList';
import { PresetList } from './components/PresetList';
import { TunnelList } from './components/TunnelList';
import { LogsView } from './components/LogsView';
import { SettingsView } from './components/SettingsView';
import { AboutView } from './components/AboutView';
import { Shield, TerminalSquare, Plug, FolderSearch, Bookmark, Settings, Activity, Cloud, Info } from 'lucide-react';
import { cn } from './lib/utils';
import { useTunnelStore } from './store/useTunnelStore';
import { useCloudflareStore } from './store/useCloudflareStore';
import { useSettingsStore } from './store/useSettingsStore';

type Tab = 'manual' | 'presets' | 'projects' | 'tunnels' | 'settings' | 'about';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('manual');
  const [isLogsMinimized, setIsLogsMinimized] = useState(false);
  const { activeProcess } = useTunnelStore();
  const { tunnels, fetchTunnels } = useCloudflareStore();
  const { cloudflaredPath } = useSettingsStore();

  useEffect(() => {
    fetchTunnels(cloudflaredPath);
  }, [cloudflaredPath, fetchTunnels]);

  const isRunning = activeProcess?.status === 'running';
  const isStarting = activeProcess?.status === 'starting';

  // Count online tunnels. We map over the ones that have connections > 0, 
  // and we make sure not to double count our own if it has connections in the api response.
  // Actually, we can just say any tunnel with connections > 0 is online + 1 if our active one isn't in that list? 
  // Let's just use the api response 'connections' array + the running status of activeProcess for the count.
  const apiOnlineTunnels = Array.isArray(tunnels) ? tunnels.filter(t => t.connections && t.connections.length > 0).map(t => t.name) : [];
  if (isRunning && activeProcess?.config?.tunnelName && !apiOnlineTunnels.includes(activeProcess.config.tunnelName)) {
    apiOnlineTunnels.push(activeProcess.config.tunnelName);
  }
  const onlineCount = apiOnlineTunnels.length;
  const statusColor = isRunning ? "text-green-500" : isStarting ? "text-orange-500" : "text-[#52525b]";
  const statusText = isRunning ? "ONLINE" : isStarting ? "STARTING" : "OFFLINE";

  return (
    <div className="flex h-screen bg-[#09090b] text-[#e4e4e7] font-sans overflow-hidden selection:bg-orange-500/30">
      {/* Sidebar Navigation */}
      <div className="w-16 sm:w-64 bg-[#0c0c0e] border-r border-[#27272a] flex flex-col transition-all duration-300 z-10 shrink-0">
        <div className="h-16 flex items-center justify-center sm:justify-start sm:px-6 border-b border-[#27272a] shrink-0">
          <Shield className="w-6 h-6 text-orange-500" />
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
        <div className={cn("border-b border-[#27272a] flex overflow-hidden transition-all duration-300", isLogsMinimized ? "flex-1" : "h-3/5")}>
          {activeTab === 'manual' && <ManualTunnel />}
          {activeTab === 'presets' && <PresetList />}
          {activeTab === 'projects' && <ProjectList />}
          {activeTab === 'tunnels' && <TunnelList />}
          {activeTab === 'settings' && <SettingsView />}
          {activeTab === 'about' && <AboutView />}
        </div>
        
        {/* Bottom Region - Logs */}
        <div className={cn("flex flex-col bg-[#09090b] transition-all duration-300", isLogsMinimized ? "h-8 sm:h-[34px] border-t-0" : "h-2/5")}>
          <LogsView isMinimized={isLogsMinimized} onToggleMinimize={() => setIsLogsMinimized(!isLogsMinimized)} />
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

