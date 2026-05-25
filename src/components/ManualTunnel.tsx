import React, { useState } from 'react';
import { toast } from 'sonner';
import { useTunnelStore } from '../store/useTunnelStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { TunnelConfig } from '../types';
import { Play, Save, Globe } from 'lucide-react';
import { cn } from '../lib/utils';

export function ManualTunnel() {
  const { startTunnel, addPreset, presets } = useTunnelStore();
  const [config, setConfig] = useState<Partial<TunnelConfig>>({
    localUrl: 'http://127.0.0.1:3000',
    localVhost: '',
    publicDomain: '',
    tunnelName: '',
    options: {
      httpHostHeader: false,
      originServerName: false,
      forceHttp2: false,
      ipv4Only: false,
    }
  });

  const rootDomain = useSettingsStore(s => s.publicDomain) || 'your-domain.com';
  const subdomain = config.publicDomain?.replace(`.${rootDomain}`, '') || '';

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.localUrl || !config.publicDomain || !config.tunnelName) return;
    
    startTunnel({
      id: Date.now().toString(),
      localUrl: config.localUrl,
      localVhost: config.localVhost || '',
      publicDomain: config.publicDomain,
      tunnelName: config.tunnelName,
      options: config.options!,
      name: config.tunnelName,
    });
  };

  const handleSavePreset = () => {
    if (!config.localUrl || !config.publicDomain || !config.tunnelName) return;

    const isNameExists = presets.some(p => p.tunnelName.toLowerCase() === config.tunnelName?.toLowerCase());
    if (isNameExists) {
      toast.error("Cannot save preset", { description: `A preset with tunnel name '${config.tunnelName}' already exists.` });
      return;
    }

    const isDomainExists = presets.some(p => p.publicDomain.toLowerCase() === config.publicDomain?.toLowerCase());
    if (isDomainExists) {
      toast.error("Cannot save preset", { description: `A preset using public domain '${config.publicDomain}' already exists.` });
      return;
    }

    addPreset({
      id: Date.now().toString(),
      name: config.tunnelName.toUpperCase(),
      localUrl: config.localUrl,
      localVhost: config.localVhost || '',
      publicDomain: config.publicDomain,
      tunnelName: config.tunnelName,
      options: config.options!,
    });
    
    toast.success("Preset saved successfully!");
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] text-[#e4e4e7] overflow-y-auto relative">
      <div className="flex flex-col max-w-3xl w-full mx-auto">
        <div className="sticky top-0 z-10 bg-[#09090b] h-16 px-6 border-b border-[#27272a] flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#52525b] flex items-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-orange-500" />
              Manual Tunnel Configuration
            </h2>
            <p className="text-[#a1a1aa] text-[10px]">Create presets or start custom tunnels manually.</p>
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 flex flex-col gap-6">
          <div className="p-5 bg-[#0c0c0e] border border-[#27272a] rounded-xl">

        <form onSubmit={handleStart} className="space-y-6 flex-1">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase text-[#52525b] mb-1.5 font-bold">Local URL</label>
              <input
                type="text"
                value={config.localUrl}
                onChange={e => setConfig(prev => ({ ...prev, localUrl: e.target.value }))}
                placeholder="http://127.0.0.1:3000"
                className="w-full bg-[#18181b] border border-[#27272a] rounded p-2 text-xs focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-[#52525b] mb-1.5 font-bold">Local Host Header / Vhost</label>
              <input
                type="text"
                value={config.localVhost}
                onChange={e => setConfig(prev => ({ ...prev, localVhost: e.target.value }))}
                placeholder="misal: arts.test"
                className="w-full bg-[#18181b] border border-[#27272a] rounded p-2 text-xs focus:outline-none focus:border-orange-500 transition-colors"
              />
              <p className="text-[10px] text-[#52525b] mt-1">Hanya diperlukan jika menggunakan Host Header/Origin Server Name (untuk local vhost seperti Laragon).</p>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-[#52525b] mb-1.5 font-bold">Public Domain / URL</label>
              <div className="flex bg-[#18181b] border border-[#27272a] rounded overflow-hidden focus-within:border-orange-500 transition-colors">
                <input
                  type="text"
                  value={subdomain}
                  onChange={e => setConfig(prev => ({ ...prev, publicDomain: e.target.value ? `${e.target.value}.${rootDomain}` : '' }))}
                  placeholder="arts-demo"
                  className="flex-1 bg-transparent p-2 text-xs focus:outline-none"
                />
                <div className="bg-[#27272a] px-3 py-2 text-xs text-[#a1a1aa] border-l border-[#3f3f46] flex items-center">
                  .{rootDomain}
                </div>
              </div>
              <p className="text-[10px] text-[#52525b] mt-1">Masukkan nama subdomain. Pastikan Public Root Domain sudah terdeteksi di menu Settings.</p>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-[#52525b] mb-1.5 font-bold">Tunnel Name</label>
              <input
                type="text"
                value={config.tunnelName}
                onChange={e => setConfig(prev => ({ ...prev, tunnelName: e.target.value }))}
                placeholder="arts-demo"
                className="w-full bg-[#18181b] border border-[#27272a] rounded p-2 text-xs focus:outline-none focus:border-orange-500 transition-colors"
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
                <label key={opt.id} className="flex items-center gap-2 text-[11px] text-[#a1a1aa] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.options?.[opt.id as keyof typeof config.options] || false}
                    onChange={e => setConfig(prev => ({
                      ...prev,
                      options: { ...prev.options!, [opt.id]: e.target.checked }
                    }))}
                    className="accent-orange-500"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-6 flex gap-3">
            <button
              type="submit"
              disabled={!config.localUrl || !config.tunnelName}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-[#27272a] disabled:text-[#52525b] text-black font-bold py-2 px-4 rounded text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
            >
              <Play className="w-3 h-3" />
              Start Tunnel
            </button>
            
            <button
              type="button"
              onClick={handleSavePreset}
              disabled={!config.localUrl || !config.tunnelName}
              className="flex-1 bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] hover:border-[#52525b] disabled:opacity-50 disabled:cursor-not-allowed rounded text-[#e4e4e7] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Preset
            </button>
          </div>
        </form>
          </div>
        </div>
      </div>
    </div>
  );
}
