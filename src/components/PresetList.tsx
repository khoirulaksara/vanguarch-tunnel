import React from 'react';
import { useTunnelStore } from '../store/useTunnelStore';
import { Bookmark, Play, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

export function PresetList() {
  const { presets, startTunnel, removePreset, activeProcess } = useTunnelStore();

  const isRunning = activeProcess?.status === 'running' || activeProcess?.status === 'starting';

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] p-6 text-[#e4e4e7] overflow-y-auto">
      <div className="p-5 bg-[#0c0c0e] border border-[#27272a] rounded-lg max-w-3xl w-full">
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#52525b] flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-orange-500" />
            Saved Presets
          </h2>
          <p className="text-[#a1a1aa] text-[10px] mt-1">Quick launch your favorite tunnels.</p>
        </div>

        <div className="space-y-3">
          {presets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-[#52525b] gap-2 border border-[#27272a] border-dashed rounded-lg bg-[#09090b]">
              <Bookmark className="w-6 h-6 opacity-40" />
              <span className="text-[11px]">No saved presets yet.</span>
              <span className="text-[10px] text-[#27272a]">Save one from the Manual Tunnel view.</span>
            </div>
          ) : (
            presets.map(preset => (
              <div key={preset.id} className="bg-[#18181b] border border-[#27272a] rounded p-4 group">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-[#e4e4e7] tracking-wide text-[11px]">{preset.name}</h3>
                  <button 
                    onClick={() => removePreset(preset.id)}
                    className="text-[#52525b] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove preset"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                
                <div className="space-y-2 mb-4 text-[10px] font-mono text-[#a1a1aa]">
                  <div className="flex justify-between">
                    <span className="text-[#52525b] uppercase tracking-wider font-sans font-bold">Local:</span>
                    <span>{preset.localUrl}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#52525b] uppercase tracking-wider font-sans font-bold">Domain:</span>
                    <span>{preset.publicDomain}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#52525b] uppercase tracking-wider font-sans font-bold">Tunnel:</span>
                    <span>{preset.tunnelName}</span>
                  </div>
                </div>

                <button
                  disabled={isRunning}
                  onClick={() => startTunnel(preset)}
                  className="w-full bg-[#27272a] hover:bg-orange-500 text-[#a1a1aa] hover:text-black font-bold disabled:opacity-50 disabled:hover:bg-[#27272a] disabled:hover:text-[#a1a1aa] transition-colors py-2 rounded text-[10px] uppercase tracking-widest"
                >
                  Launch Preset
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
