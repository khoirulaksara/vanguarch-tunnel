import React from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { Settings as SettingsIcon } from 'lucide-react';

export function SettingsView() {
  const { cloudflaredPath, setCloudflaredPath } = useSettingsStore();

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] p-6 text-[#e4e4e7] overflow-y-auto">
      <div className="p-5 bg-[#0c0c0e] border border-[#27272a] rounded-lg max-w-3xl w-full">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#52525b] flex items-center gap-2">
              <SettingsIcon className="w-4 h-4 text-orange-500" />
              Application Settings
            </h2>
            <p className="text-[#a1a1aa] text-[10px] mt-1">Configure global preferences.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-[10px] uppercase text-[#52525b] mb-1.5 font-bold">Cloudflared Executable Path</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={cloudflaredPath}
                onChange={(e) => setCloudflaredPath(e.target.value)}
                placeholder="default (uses PATH)"
                className="flex-1 bg-[#18181b] border border-[#27272a] rounded p-2 text-xs focus:outline-none focus:border-orange-500 transition-colors font-mono"
              />
            </div>
            <p className="text-[10px] text-[#52525b] mt-2 leading-relaxed">
              If cloudflared is not in your system PATH, specify the absolute path to the executable here. <br/>
              Example: <code className="bg-black border border-[#27272a] px-1 py-0.5 rounded text-[#a1a1aa] ml-1">C:\Program Files\cloudflared\cloudflared.exe</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
