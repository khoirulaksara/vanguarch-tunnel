import React from 'react';
import { useTunnelStore } from '../store/useTunnelStore';
import { Bookmark, Play, Trash2, Square } from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useCloudflaredStatusStore } from '../store/useCloudflaredStatusStore';
import { QRCodeDisplay } from './ui/QRCodeDisplay';
import { TrafficMonitor } from './ui/TrafficMonitor';
import { cn } from '../lib/utils';

export function PresetList() {
  const { presets, startTunnel, stopTunnel, removePreset, activeProcesses } = useTunnelStore();
  const { isInstalled } = useCloudflaredStatusStore();

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] text-[#e4e4e7] overflow-y-auto relative">
      <div className="flex flex-col max-w-5xl w-full mx-auto">
        <div className="sticky top-0 z-10 bg-[#09090b] h-16 px-6 border-b border-[#27272a] flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#52525b] flex items-center gap-2 mb-1">
              <Bookmark className="w-4 h-4 text-orange-500" />
              Saved Presets
            </h2>
            <p className="text-[#a1a1aa] text-[10px]">Quick launch your favorite tunnels.</p>
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 flex flex-col gap-6">

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {presets.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center p-12 text-[#52525b] gap-3 border border-[#27272a] border-dashed rounded-lg bg-[#09090b]">
              <Bookmark className="w-6 h-6 opacity-40" />
              <span className="text-[11px] uppercase tracking-wider">No saved presets yet.</span>
              <span className="text-[10px] text-[#27272a]">Save one from the Manual Tunnel view.</span>
            </div>
          ) : (
            presets.map(preset => {
              const activeProcess = activeProcesses[preset.tunnelName];
              const isThisRunning = activeProcess?.status === 'running' || activeProcess?.status === 'starting';
              
              return (
              <div key={preset.id} className="bg-[#18181b]/50 border border-[#27272a] hover:border-[#52525b] rounded-xl p-4 flex flex-col justify-between transition-colors group">
                <div className="flex flex-col gap-2 mb-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <h3 className="font-bold text-[#e4e4e7] tracking-tight text-sm truncate" title={preset.name}>{preset.name}</h3>
                      {isThisRunning && (
                        <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                          Running
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        onClick={() => removePreset(preset.id)}
                        className="text-[#52525b] hover:text-red-500 transition-colors p-1"
                        title="Remove preset"
                        disabled={isThisRunning}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mb-2 mt-[-8px]">
                    <span className="bg-[#27272a] text-[#a1a1aa] px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest">
                      {preset.protocol || 'HTTP'}
                    </span>
                    {preset.enableInspector && (
                      <span className="bg-orange-500/10 text-orange-500 border border-orange-500/20 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest">
                        Inspector ON
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-1.5 mt-2 text-[10px] font-mono text-[#a1a1aa]">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[#52525b] uppercase tracking-wider font-sans font-bold shrink-0">Local:</span>
                      <span className="truncate">{preset.localUrl}</span>
                    </div>
                    {preset.localVhost && (
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-[#52525b] uppercase tracking-wider font-sans font-bold shrink-0">Vhost:</span>
                        <span className="truncate">{preset.localVhost}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[#52525b] uppercase tracking-wider font-sans font-bold shrink-0">Domain:</span>
                      <div className="flex items-center gap-2 truncate">
                        <span className="truncate">{preset.publicDomain}</span>
                        {isThisRunning && <QRCodeDisplay url={`https://${preset.publicDomain}`} />}
                      </div>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[#52525b] uppercase tracking-wider font-sans font-bold shrink-0">Tunnel:</span>
                      <span className="truncate">{preset.tunnelName}</span>
                    </div>
                  </div>
                </div>

                {isThisRunning ? (
                  <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-[#27272a]">
                    <div className="flex justify-between items-center gap-2">
                      <button 
                        onClick={() => stopTunnel(preset.tunnelName)}
                        className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                      >
                        <Square className="w-3.5 h-3.5" />
                        Stop Preset
                      </button>
                    </div>
                    {preset.protocol && preset.protocol !== 'http' && (
                      <div className="pt-2">
                        <div className="bg-black/50 border border-[#3f3f46] rounded p-2 text-[9px] font-mono text-[#a1a1aa]">
                          <div className="text-orange-500 mb-1 font-bold">Client Connection Command:</div>
                          <code className="select-all block p-1 bg-[#18181b] rounded break-all">
                            cloudflared access {preset.protocol} --hostname {preset.publicDomain} --url localhost:{preset.protocol === 'tcp' ? '3306' : preset.protocol === 'ssh' ? '22' : '3389'}
                          </code>
                        </div>
                      </div>
                    )}
                    <div className="pt-2">
                      <TrafficMonitor tunnelName={preset.tunnelName} />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => startTunnel(preset)}
                    disabled={!isInstalled}
                    title={isInstalled === false ? "Cloudflared is missing" : ""}
                    className={cn(
                      "w-full mt-3 font-bold transition-colors py-2 rounded-lg text-[10px] uppercase tracking-wider flex items-center justify-center gap-2",
                      isInstalled === false 
                        ? "bg-[#27272a] text-[#52525b] cursor-not-allowed" 
                        : "bg-white hover:bg-[#e4e4e7] text-black"
                    )}
                  >
                    <Play className="w-3.5 h-3.5" />
                    Launch Preset
                  </button>
                )}
              </div>
            )})
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
