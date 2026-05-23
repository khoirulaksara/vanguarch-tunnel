import React, { useEffect, useState } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTunnelStore } from '../store/useTunnelStore';
import { useCloudflareStore } from '../store/useCloudflareStore';
import { Cloud, Play, Search, RefreshCw, XCircle } from 'lucide-react';

export function TunnelList() {
  const { tunnels, loading, error, fetchTunnels } = useCloudflareStore();
  const [searchQuery, setSearchQuery] = useState('');
  
  const { cloudflaredPath } = useSettingsStore();
  const { startTunnel, activeProcess } = useTunnelStore();
  const [startingTunnelId, setStartingTunnelId] = useState<string | null>(null);

  useEffect(() => {
    fetchTunnels(cloudflaredPath);
  }, [cloudflaredPath, fetchTunnels]);

  const handleStartTunnel = async (tunnel: any) => {
    setStartingTunnelId(tunnel.id);
    try {
      const vhost = tunnel.name.replace('vanguarch-', '') + '.test';
      const config = {
        id: Math.random().toString(36).substring(2, 9),
        name: tunnel.name,
        localUrl: 'http://127.0.0.1',
        localVhost: vhost,
        publicDomain: '', 
        tunnelName: tunnel.name,
        options: {
          httpHostHeader: true,
          originServerName: true,
          forceHttp2: false,
          ipv4Only: false
        }
      };

      await startTunnel(config);
    } catch (err: any) {
      alert(err.message || String(err));
    } finally {
      setStartingTunnelId(null);
    }
  };

  const filteredTunnels = Array.isArray(tunnels) ? tunnels.filter((t: any) => (t.name || '').toLowerCase().includes(searchQuery.toLowerCase())) : [];

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] p-6 text-[#e4e4e7] overflow-y-auto">
      <div className="p-5 bg-[#0c0c0e] border border-[#27272a] rounded-lg max-w-3xl w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Cloud className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#e4e4e7] uppercase tracking-wider">Cloudflare Tunnels</h2>
              <p className="text-[11px] text-[#52525b] mt-0.5">Manage existing tunnels from your account</p>
            </div>
          </div>
          <button
            onClick={() => fetchTunnels(cloudflaredPath)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] rounded transition-colors text-[11px] uppercase tracking-wider font-bold text-[#a1a1aa] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="mb-4 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#52525b]" />
          <input
            type="text"
            placeholder="FIND TUNNEL..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#18181b] border border-[#27272a] rounded pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition-colors uppercase tracking-wider"
          />
        </div>

        {error && (
          <div className="p-4 bg-red-950/30 border border-red-900/50 rounded mb-4">
            <h4 className="text-red-500 text-xs font-bold uppercase tracking-wider mb-1">Error Fetching Tunnels</h4>
            <p className="text-red-400/80 text-[10px] font-mono">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#52525b] mb-3" />
              <p className="text-[10px] uppercase tracking-wider text-[#52525b] font-bold">Fetching Tunnels...</p>
            </div>
          ) : filteredTunnels.length === 0 ? (
            <div className="text-center py-8 border border-[#27272a] rounded bg-[#18181b]/50">
              <Cloud className="w-6 h-6 mx-auto text-[#52525b] mb-2 opacity-50" />
              <p className="text-[10px] uppercase tracking-wider text-[#52525b] font-bold">No Tunnels Found</p>
            </div>
          ) : (
            filteredTunnels.map((tunnel: any) => (
              <div key={tunnel.id} className="bg-[#18181b]/50 border border-[#27272a] p-4 flex flex-col gap-3 rounded hover:border-[#52525b] transition-colors overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xs font-bold tracking-tight text-[#e4e4e7]">{tunnel.name}</h3>
                    <p className="text-[10px] text-[#52525b] font-mono mt-1">{tunnel.id}</p>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400">
                    ID: {tunnel.id.substring(0, 8)}...
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-[#27272a]">
                  <div className="flex gap-4">
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase tracking-widest text-[#52525b] font-bold">Status</span>
                      <span className={`text-[10px] font-bold ${activeProcess?.config?.tunnelName === tunnel.name || (tunnel.connections && tunnel.connections.length > 0) ? 'text-green-500' : 'text-[#a1a1aa]'}`}>
                        {activeProcess?.config?.tunnelName === tunnel.name || (tunnel.connections && tunnel.connections.length > 0) ? 'ONLINE' : 'INACTIVE'}
                      </span>
                    </div>
                  </div>
                  
                  {activeProcess?.config?.tunnelName === tunnel.name && activeProcess?.status === 'running' ? (
                     <button
                     onClick={() => useTunnelStore.getState().stopTunnel()}
                     className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                   >
                     <XCircle className="w-3.5 h-3.5" />
                     Stop Tunnel
                   </button>
                  ) : (
                    <button
                      onClick={() => handleStartTunnel(tunnel)}
                      disabled={startingTunnelId === tunnel.id || activeProcess?.status === 'starting'}
                      className="px-3 py-1.5 bg-white text-black hover:bg-[#e4e4e7] rounded text-[10px] font-bold uppercase tracking-wider disabled:opacity-50 transition-colors flex items-center gap-1.5"
                    >
                      {startingTunnelId === tunnel.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      Start Tunnel
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
