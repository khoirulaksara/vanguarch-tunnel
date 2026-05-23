/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ManualTunnel } from './components/ManualTunnel';
import { ProjectList } from './components/ProjectList';
import { PresetList } from './components/PresetList';
import { LogsView } from './components/LogsView';
import { SettingsView } from './components/SettingsView';
import { Shield, TerminalSquare, Plug, FolderSearch, Bookmark, Settings } from 'lucide-react';
import { cn } from './lib/utils';

type Tab = 'manual' | 'presets' | 'projects' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('manual');

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
            icon={<Settings className="w-5 h-5" />} 
            label="Settings" 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
          />
        </nav>
        
        <div className="p-4 border-t border-[#27272a] hidden sm:block">
          <div className="flex items-center gap-2 text-[10px] text-[#52525b] justify-between">
            <span>v2.1.0-stable</span>
            <span>PID: 84920</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#09090b]">
        
        {/* Top Region - Configuration */}
        <div className="h-3/5 border-b border-[#27272a] flex overflow-hidden">
          {activeTab === 'manual' && <ManualTunnel />}
          {activeTab === 'presets' && <PresetList />}
          {activeTab === 'projects' && <ProjectList />}
          {activeTab === 'settings' && <SettingsView />}
        </div>
        
        {/* Bottom Region - Logs */}
        <div className="h-2/5 flex flex-col bg-[#09090b]">
          <LogsView />
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

