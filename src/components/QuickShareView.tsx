import React, { useState } from 'react';
import { toast } from 'sonner';
import { Folder, Share2, StopCircle, Cloud } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTunnelStore } from '../store/useTunnelStore';
import { QRCodeDisplay } from './ui/QRCodeDisplay';

export function QuickShareView() {
  const [folderPath, setFolderPath] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [activePort, setActivePort] = useState<number | null>(null);
  const [activeTunnelId, setActiveTunnelId] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

  const { cloudflaredPath, publicDomain } = useSettingsStore();
  const { startTunnel, stopTunnel, activeProcesses } = useTunnelStore();

  const handleBrowse = async () => {
    if (openDialog) {
      try {
        const selected = await openDialog({
          multiple: false,
          directory: true,
          title: 'Select Folder to Share',
        });
        if (selected && typeof selected === 'string') {
          setFolderPath(selected);
        }
      } catch (e) {
        console.error("Dialog error:", e);
      }
    } else {
      toast.warning("Browse dialog only available in desktop app.");
    }
  };

  const startSharing = async () => {
    if (!folderPath) {
      toast.error("Please select a folder first.");
      return;
    }
    if (!publicDomain) {
      toast.warning("Please set a Public Root Domain in Settings first.");
      return;
    }

    setIsSharing(true);
    try {
      // 1. Start local static server
      const port: number = await invoke('start_static_server', { folderPath });
      setActivePort(port);

      // 2. Setup tunnel routing
      const tunnelId = `vanguarch-share-${Math.random().toString(36).substring(2, 8)}`;
      const subdomain = `share-${Math.random().toString(36).substring(2, 6)}.${publicDomain.replace(/^\.+/, '')}`;
      
      await invoke('auto_tunnel_setup', {
        cloudflaredPath,
        tunnelName: tunnelId,
        subdomain,
        localUrl: `http://127.0.0.1:${port}`
      });

      // 3. Start the tunnel process
      const config = {
        id: tunnelId,
        name: tunnelId,
        localUrl: `http://127.0.0.1:${port}`,
        localVhost: '',
        publicDomain: subdomain,
        tunnelName: tunnelId,
        options: {
          httpHostHeader: false,
          originServerName: false,
          forceHttp2: false,
          ipv4Only: false
        }
      };

      await startTunnel(config);
      setActiveTunnelId(tunnelId);
      setPublicUrl(`https://${subdomain}`);
      toast.success("Folder shared successfully!");
    } catch (err: any) {
      toast.error(`Failed to share: ${err.message || String(err)}`);
      // Cleanup if failed
      if (activePort) {
        await invoke('stop_static_server', { port: activePort }).catch(() => {});
        setActivePort(null);
      }
    } finally {
      setIsSharing(false);
    }
  };

  const stopSharing = async () => {
    if (activeTunnelId) {
      await stopTunnel(activeTunnelId);
      // Attempt to delete the temporary tunnel
      invoke('delete_tunnel', { cloudflaredPath, tunnelName: activeTunnelId }).catch(() => {});
      setActiveTunnelId(null);
    }
    if (activePort) {
      await invoke('stop_static_server', { port: activePort }).catch(() => {});
      setActivePort(null);
    }
    setPublicUrl(null);
    toast.success("Sharing stopped.");
  };

  const isRunning = activeTunnelId && activeProcesses[activeTunnelId]?.status === 'running';

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] text-[#e4e4e7] overflow-y-auto relative">
      <div className="flex flex-col max-w-3xl w-full mx-auto">
        <div className="sticky top-0 z-10 bg-[#09090b] h-16 px-6 border-b border-[#27272a] flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#52525b] flex items-center gap-2 mb-1">
              <Share2 className="w-4 h-4 text-orange-500" />
              Quick Share
            </h2>
            <p className="text-[#a1a1aa] text-[10px]">Instantly host and tunnel a local folder to the internet.</p>
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 flex flex-col gap-6">
          <div className="p-5 bg-[#0c0c0e] border border-[#27272a] rounded-xl space-y-6">
            
            <div>
              <label className="block text-[10px] uppercase text-[#52525b] mb-1.5 font-bold">Select Folder</label>
              <div className="flex gap-2">
                <div className="flex-1 bg-[#18181b] border border-[#27272a] rounded p-2 text-xs font-mono text-[#e4e4e7] flex items-center overflow-x-auto truncate">
                  {folderPath || "No folder selected"}
                </div>
                <button 
                  onClick={handleBrowse}
                  disabled={isRunning || isSharing}
                  className="px-3 bg-[#18181b] border border-[#27272a] rounded hover:border-orange-500 transition-colors flex items-center justify-center text-[#a1a1aa] hover:text-orange-500 disabled:opacity-50"
                  title="Browse for folder"
                >
                  <Folder className="w-4 h-4" />
                </button>
              </div>
            </div>

            {publicUrl && isRunning ? (
              <div className="bg-[#18181b]/50 border border-green-500/30 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                      Sharing Active
                    </span>
                  </div>
                  <button 
                    onClick={stopSharing}
                    className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                    Stop Sharing
                  </button>
                </div>
                
                <div className="flex justify-between items-center bg-black p-3 rounded-lg border border-[#27272a]">
                  <a href={publicUrl} target="_blank" rel="noreferrer" className="font-mono text-xs text-orange-500 hover:text-orange-400 hover:underline truncate">
                    {publicUrl}
                  </a>
                  <QRCodeDisplay url={publicUrl} />
                </div>
              </div>
            ) : (
              <button
                onClick={startSharing}
                disabled={isSharing || !folderPath}
                className="w-full py-3 bg-white hover:bg-[#e4e4e7] text-black font-bold transition-colors rounded-lg text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSharing ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Cloud className="w-4 h-4" />
                )}
                Start Sharing
              </button>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
