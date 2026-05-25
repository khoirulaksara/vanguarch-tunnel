import React, { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useProjectStore } from '../store/useProjectStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTunnelStore } from '../store/useTunnelStore';
import { useCloudflareStore } from '../store/useCloudflareStore';
import { Folder, Search, Link as LinkIcon, Code2, RefreshCw, CheckCircle2, XCircle, Plus, ChevronDown, ChevronUp, Play, Cloud } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export function ProjectList() {
  const { projects, isScanning, scanProjects, injectWpHelper } = useProjectStore();
  const { workspaceDirectories, singleProjectDirectories, cloudflaredPath, publicDomain } = useSettingsStore();
  const { tunnels, fetchTunnels } = useCloudflareStore();
  const { activeProcesses } = useTunnelStore();

  const [injectStatus, setInjectStatus] = useState<Record<string, { loading: boolean, error?: string, success?: string }>>({});
  const [expandedHelpers, setExpandedHelpers] = useState<Record<string, boolean>>({});
  const [autoTunnelStatus, setAutoTunnelStatus] = useState<Record<string, { loading: boolean, error?: string }>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    scanProjects();
    fetchTunnels(cloudflaredPath);
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [scanProjects, fetchTunnels, cloudflaredPath]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    return projects.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.framework.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [projects, searchQuery]);

  const handleAutoTunnel = async (project: any) => {
    if (!publicDomain) {
      toast.warning("Please set a Public Root Domain in Settings first.");
      return;
    }
    
    setAutoTunnelStatus(prev => ({ ...prev, [project.id]: { loading: true, error: undefined } }));
    
    try {
      const baseSanitizedName = project.name.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
      
      let attempt = 0;
      let success = false;
      let lastErr = "";

      if ((window as any).__TAURI_INTERNALS__) {
        
        while (!success && attempt < 10) {
          try {
            const suffix = attempt === 0 ? '' : `-${attempt}`;
            const tunnelName = 'vanguarch-' + baseSanitizedName + suffix;
            const subdomain = baseSanitizedName + suffix + '.' + publicDomain.replace(/^\.+/, '');
            
            await invoke('auto_tunnel_setup', {
              cloudflaredPath,
              tunnelName,
              subdomain
            });
            success = true;
          } catch (err: any) {
            lastErr = String(err);
            if (lastErr.toLowerCase().includes("already exists") || lastErr.toLowerCase().includes("validation error") || lastErr.toLowerCase().includes("failed")) {
              attempt++;
            } else {
              throw err;
            }
          }
        }
        
        if (!success) {
          throw new Error(`Could not create tunnel after ${attempt} attempts. Last error: ${lastErr}`);
        }
      } else {
        await new Promise(r => setTimeout(r, 1000));
      }

      toast.success("Tunnel successfully created! You can now start it from the Cloud Tunnels menu.");
      
      setAutoTunnelStatus(prev => ({ ...prev, [project.id]: { loading: false } }));
      fetchTunnels(cloudflaredPath);
    } catch (err: any) {
      setAutoTunnelStatus(prev => ({ ...prev, [project.id]: { loading: false, error: err.message || String(err) } }));
    }
  };

  const handleInject = async (id: string, path: string) => {
    setInjectStatus(prev => ({ ...prev, [id]: { loading: true, error: undefined, success: undefined } }));
    try {
      const msg = await injectWpHelper(id, path);
      setInjectStatus(prev => ({ ...prev, [id]: { loading: false, success: msg } }));
      setTimeout(() => {
        setInjectStatus(prev => ({ ...prev, [id]: { ...prev[id], success: undefined } }));
      }, 3000);
    } catch (err: any) {
      setInjectStatus(prev => ({ ...prev, [id]: { loading: false, error: err.message } }));
    }
  };

  const toggleHelper = (id: string) => {
    setExpandedHelpers(prev => ({...prev, [id]: !prev[id]}));
  };

  const allDirectories = [...(workspaceDirectories || []), ...(singleProjectDirectories || [])];

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] p-6 text-[#e4e4e7] overflow-y-auto">
      <div className="flex flex-col gap-6 max-w-5xl w-full mx-auto">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#52525b] flex items-center gap-2 mb-1">
              <Folder className="w-4 h-4 text-orange-500" />
              Discovered Projects ({projects.length})
            </h2>
            <div className="text-[#a1a1aa] text-[10px] space-y-0.5">
              {allDirectories.length > 0 ? (
                <div className="truncate max-w-md">Scanning: {allDirectories.join(', ')}</div>
              ) : (
                <div>No directories configured</div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#52525b] absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search projects..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#18181b] border border-[#27272a] rounded-lg pl-9 pr-4 py-1.5 text-xs text-[#e4e4e7] w-64 focus:outline-none focus:border-[#52525b] transition-colors placeholder:text-[#52525b]"
              />
            </div>
            <button 
              onClick={() => scanProjects()}
              disabled={isScanning}
              className="px-3 py-1.5 bg-[#27272a] border border-transparent hover:border-[#52525b] rounded-lg text-[11px] font-bold uppercase tracking-wider text-[#e4e4e7] disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              Scan
            </button>
          </div>
        </div>

        {isScanning && projects.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-[#52525b] gap-3 border border-[#27272a] border-dashed rounded-lg bg-[#09090b]">
            <RefreshCw className="w-5 h-5 animate-spin opacity-50" />
            <span className="text-[11px] uppercase tracking-wider">Scanning directory...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-[#52525b] border border-[#27272a] border-dashed rounded-lg bg-[#09090b]">
            <span className="text-[11px] uppercase tracking-wider">No projects found.</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-[#52525b] border border-[#27272a] border-dashed rounded-lg bg-[#09090b]">
            <span className="text-[11px] uppercase tracking-wider">No projects match your search.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map(project => (
              <div 
                key={project.id} 
                className={`bg-[#18181b]/50 border p-4 rounded-xl flex flex-col justify-between gap-3 transition-colors ${project.framework === 'WordPress' ? 'border-orange-500/30 hover:border-orange-500 bg-[#18181b]' : 'border-[#27272a] hover:border-[#52525b]'}`}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="text-sm font-bold tracking-tight text-[#e4e4e7] truncate" title={project.name}>{project.name}</h3>
                    <div className="flex items-center gap-1 shrink-0">
                      {Array.isArray(tunnels) && tunnels.some((t: any) => {
                        const pName = `vanguarch-${project.name.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()}`;
                        const isMatch = t.name === pName || t.name.match(new RegExp(`^${pName}-\\d+$`));
                        const pStore = activeProcesses[t.name];
                        const isRecentlyStopped = pStore?.status === 'stopped' && pStore?.stoppedAt && (now - pStore.stoppedAt < 60000);
                        const hasConnections = t.connections && t.connections.length > 0 && !isRecentlyStopped;
                        return isMatch && hasConnections;
                      }) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400" title="Active Tunnel"><Cloud className="w-3 h-3"/></span>
                      )}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${project.framework === 'WordPress' ? 'bg-orange-500/10 text-orange-400' : 'bg-[#27272a] text-[#a1a1aa]'}`}>
                        {project.framework}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#52525b] font-mono truncate" title={project.path}>{project.path}</p>
                  
                  {project.framework === 'WordPress' && project.wpHelperInstalled !== undefined && (
                    <div className={`flex items-center gap-1 text-[9px] uppercase font-bold tracking-wider ${project.wpHelperInstalled ? 'text-green-500' : 'text-red-500'}`}>
                      {project.wpHelperInstalled ? (
                        <><CheckCircle2 className="w-3 h-3" /> WP Helper Active</>
                      ) : (
                        <><XCircle className="w-3 h-3" /> No Helper</>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="pt-3 border-t border-[#27272a] flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#a1a1aa] truncate">
                      <LinkIcon className="w-3 h-3 text-[#52525b] shrink-0" />
                      <span className="font-mono truncate" title={project.suggestedUrl}>{project.suggestedUrl}</span>
                    </div>
                    {(!Array.isArray(tunnels) || !tunnels.some((t: any) => {
                      const pName = `vanguarch-${project.name.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()}`;
                      return t.name === pName || t.name.match(new RegExp(`^${pName}-\\d+$`));
                    })) && (
                      <button
                        onClick={() => handleAutoTunnel(project)}
                        disabled={autoTunnelStatus[project.id]?.loading}
                        className="px-2 py-1 bg-white text-black hover:bg-[#e4e4e7] rounded text-[10px] font-bold uppercase tracking-wider disabled:opacity-50 transition-colors flex items-center gap-1 shrink-0"
                      >
                        {autoTunnelStatus[project.id]?.loading ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Cloud className="w-3 h-3" />
                        )}
                        Create Tunnel
                      </button>
                    )}
                  </div>
                  
                  {autoTunnelStatus[project.id]?.error && (
                    <div className="p-2 bg-red-950/30 border border-red-900/50 rounded text-[10px] text-red-500 font-mono">
                      {autoTunnelStatus[project.id]?.error}
                    </div>
                  )}

                  {project.framework === 'WordPress' && (
                    <div className="bg-[#0c0c0e] border border-[#27272a] rounded overflow-hidden">
                      <div 
                        className="flex items-center justify-between p-2 cursor-pointer hover:bg-[#18181b] transition-colors"
                        onClick={() => toggleHelper(project.id)}
                      >
                        <div className="flex items-center gap-1.5">
                          <Code2 className="w-3 h-3 text-orange-500" />
                          <span className="text-[9px] font-bold text-[#52525b] uppercase tracking-widest">WP Helper</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!project.wpHelperInstalled && project.wpHelperInstalled !== undefined && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleInject(project.id, project.path); }}
                              disabled={injectStatus[project.id]?.loading}
                              className="text-[9px] uppercase font-bold tracking-wider bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] disabled:opacity-50 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors"
                            >
                              {injectStatus[project.id]?.loading ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Plus className="w-3 h-3" />
                              )}
                              Inject
                            </button>
                          )}
                          <div className="text-[#52525b]">
                            {expandedHelpers[project.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>
                      
                      {expandedHelpers[project.id] && (
                        <div className="p-2 pt-0 border-t border-[#27272a] mt-1">
                          {injectStatus[project.id]?.error && (
                            <div className="mb-2 mt-1 p-1.5 bg-red-950/30 border border-red-900/50 rounded text-[9px] text-red-500 font-mono">
                              {injectStatus[project.id]?.error}
                            </div>
                          )}
                          {injectStatus[project.id]?.success && (
                            <div className="mb-2 mt-1 p-1.5 bg-green-950/30 border border-green-900/50 rounded text-[9px] text-green-500 font-mono">
                              {injectStatus[project.id]?.success}
                            </div>
                          )}

                          <pre className="text-[8px] text-[#a1a1aa] font-mono overflow-x-auto whitespace-pre bg-black p-2 rounded border border-[#27272a] max-h-32">
                            {`if ( ! defined('WP_CLI') ) {\n    $is_https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https' || ($_SERVER['SERVER_PORT'] ?? null) == 443;\n    if ($is_https) $_SERVER['HTTPS'] = 'on';\n    $scheme = $is_https ? 'https' : 'http';\n    $host = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'];\n    define('WP_HOME', $scheme . '://' . $host);\n    define('WP_SITEURL', $scheme . '://' . $host);\n}`}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

