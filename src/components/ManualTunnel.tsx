import React, { useState } from 'react';
import { useTunnelStore } from '../store/useTunnelStore';
import { TunnelConfig } from '../types';
import { Play, Square, Save, Github, Globe } from 'lucide-react';
import { cn } from '../lib/utils';

export function ManualTunnel() {
  const { startTunnel, stopTunnel, activeProcess, addPreset } = useTunnelStore();
  const [config, setConfig] = useState<Partial<TunnelConfig>>({
    localUrl: 'http://127.0.0.1',
    publicDomain: '',
    tunnelName: '',
    options: {
      httpHostHeader: false,
      originServerName: false,
      forceHttp2: false,
      ipv4Only: false,
    }
  });

  const isRunning = activeProcess?.status === 'running' || activeProcess?.status === 'starting';

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.localUrl || !config.publicDomain || !config.tunnelName) return;
    
    startTunnel({
      id: Date.now().toString(),
      localUrl: config.localUrl,
      publicDomain: config.publicDomain,
      tunnelName: config.tunnelName,
      options: config.options!,
      name: config.tunnelName,
    });
  };

  const handleSavePreset = () => {
    if (!config.localUrl || !config.publicDomain || !config.tunnelName) return;
    addPreset({
      id: Date.now().toString(),
      name: config.tunnelName.toUpperCase(),
      localUrl: config.localUrl,
      publicDomain: config.publicDomain,
      tunnelName: config.tunnelName,
      options: config.options!,
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] p-6 text-[#e4e4e7] overflow-y-auto">
      <div className="p-5 bg-[#0c0c0e] border border-[#27272a] rounded-lg max-w-3xl w-full">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#52525b] flex items-center gap-2">
              <Globe className="w-4 h-4 text-orange-500" />
              Manual Tunnel Configuration
            </h2>
            <p className="text-[#a1a1aa] text-[10px] mt-1">Configure and launch a local tunnel.</p>
          </div>
        </div>

        <form onSubmit={handleStart} className="space-y-6 flex-1">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase text-[#52525b] mb-1.5 font-bold">Local URL</label>
              <input
                type="text"
                value={config.localUrl}
                onChange={e => setConfig(prev => ({ ...prev, localUrl: e.target.value }))}
                placeholder="http://127.0.0.1"
                className="w-full bg-[#18181b] border border-[#27272a] rounded p-2 text-xs focus:outline-none focus:border-orange-500 transition-colors"
                disabled={isRunning}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-[#52525b] mb-1.5 font-bold">Public Domain</label>
              <input
                type="text"
                value={config.publicDomain}
                onChange={e => setConfig(prev => ({ ...prev, publicDomain: e.target.value }))}
                placeholder="arts.serat.us"
                className="w-full bg-[#18181b] border border-[#27272a] rounded p-2 text-xs focus:outline-none focus:border-orange-500 transition-colors"
                disabled={isRunning}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-[#52525b] mb-1.5 font-bold">Tunnel Name</label>
              <input
                type="text"
                value={config.tunnelName}
                onChange={e => setConfig(prev => ({ ...prev, tunnelName: e.target.value }))}
                placeholder="arts-demo"
                className="w-full bg-[#18181b] border border-[#27272a] rounded p-2 text-xs focus:outline-none focus:border-orange-500 transition-colors"
                disabled={isRunning}
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="block text-[10px] uppercase text-[#52525b] mb-1.5 font-bold">Advanced Options</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'httpHostHeader', label: 'Enable HTTP Host Header' },
                { id: 'originServerName', label: 'Enable Origin Server Name' },
                { id: 'forceHttp2', label: 'Force HTTP2' },
                { id: 'ipv4Only', label: 'IPv4 Only' },
              ].map(opt => (
                <label key={opt.id} className={cn("flex items-center gap-2 text-[11px] text-[#a1a1aa] cursor-pointer", isRunning && "opacity-50 cursor-not-allowed")}>
                  <input
                    type="checkbox"
                    checked={config.options?.[opt.id as keyof typeof config.options] || false}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      options: { ...prev.options!, [opt.id]: e.target.checked }
                    }))}
                    disabled={isRunning}
                    className="accent-orange-500"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-6 flex gap-3">
            {isRunning ? (
              <button
                type="button"
                onClick={stopTunnel}
                className="flex-1 bg-red-500 hover:bg-red-600 text-black font-bold py-2 px-4 rounded text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                <Square className="w-3 h-3" />
                Stop Tunnel
              </button>
            ) : (
              <button
                type="submit"
                disabled={!config.localUrl || !config.publicDomain || !config.tunnelName}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-[#27272a] disabled:text-[#52525b] text-black font-bold py-2 px-4 rounded text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                <Play className="w-3 h-3" />
                Start Tunnel
              </button>
            )}
            
            <button
              type="button"
              onClick={handleSavePreset}
              disabled={!config.localUrl || !config.publicDomain || !config.tunnelName || isRunning}
              className="px-4 py-2 bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] disabled:opacity-50 disabled:cursor-not-allowed rounded text-[#e4e4e7] flex items-center justify-center transition-colors"
              title="Save as Preset"
            >
              <Save className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
