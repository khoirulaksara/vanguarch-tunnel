import React, { useEffect, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTunnelStore } from '../store/useTunnelStore';
import { useCloudflareStore } from '../store/useCloudflareStore';
import { Folder, Search, Link as LinkIcon, Code2, RefreshCw, CheckCircle2, XCircle, Plus, ChevronDown, ChevronUp, Play, Cloud } from 'lucide-react';

export function ProjectList() {
  const { projects, isScanning, scanProjects, injectWpHelper } = useProjectStore();
  const { projectsDirectories, cloudflaredPath, publicDomain } = useSettingsStore();
  const { startTunnel } = useTunnelStore();
  const { tunnels, fetchTunnels } = useCloudflareStore();

  const [injectStatus, setInjectStatus] = useState<Record<string, { loading: boolean, error?: string, success?: string }>>({});
  const [expandedHelpers, setExpandedHelpers] = useState<Record<string, boolean>>({});
  const [autoTunnelStatus, setAutoTunnelStatus] = useState<Record<string, { loading: boolean, error?: string }>>({});

  useEffect(() => {
    scanProjects();
    fetchTunnels(cloudflaredPath);
  }, [scanProjects, fetchTunnels, cloudflaredPath]);

  const handleAutoTunnel = async (project: any) => {
    if (!publicDomain) {
      alert("Please set a Public Root Domain in Settings first.");
      return;
    }
    
    setAutoTunnelStatus(prev => ({ ...prev, [project.id]: { loading: true, error: undefined } }));
    
    try {
      const sanitizedName = project.name.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
      const tunnelName = 'vanguarch-' + sanitizedName;
      const subdomain = sanitizedName + '.' + publicDomain.replace(/^\.+/, '');

      if ((window as any).__TAURI_INTERNALS__) {
        const core = await import('@tauri-apps/api/core');
        await core.invoke('auto_tunnel_setup', {
          cloudflaredPath,
          tunnelName,
          subdomain
        });
      } else {
        await new Promise(r => setTimeout(r, 1000));
      }

      const isLocalhost = project.suggestedUrl.includes('localhost') || project.suggestedUrl.includes('127.0.0.1');
      const hostHeader = project.suggestedUrl.replace('http://', '').replace('https://', '');

      const config = {
        id: Math.random().toString(36).substring(2, 9),
        name: `Auto: ${project.name}`,
        localUrl: isLocalhost ? project.suggestedUrl : 'http://127.0.0.1',
        localVhost: hostHeader,
        publicDomain: subdomain,
        tunnelName: tunnelName,
        options: {
          httpHostHeader: !isLocalhost,
          originServerName: !isLocalhost,
          forceHttp2: false,
          ipv4Only: false
        }
      };

      await startTunnel(config);
      
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

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] p-6 text-[#e4e4e7] overflow-y-auto">
      <div className="p-5 bg-[#0c0c0e] border border-[#27272a] rounded-lg max-w-3xl w-full">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#52525b] flex items-center gap-2">
              <Folder className="w-4 h-4 text-orange-500" />
              Discovered Projects
            </h2>
            <div className="text-[#a1a1aa] text-[10px] mt-1 space-y-0.5">
              {projectsDirectories && projectsDirectories.length > 0 ? (
                projectsDirectories.map((dir: string, idx: number) => (
                  <div key={idx} className="truncate max-w-sm">{dir}</div>
                ))
              ) : (
                <div>No directories configured</div>
              )}
            </div>
          </div>
          <button 
            onClick={() => scanProjects()}
            disabled={isScanning}
            className="px-3 py-1 bg-[#27272a] border border-transparent hover:border-[#52525b] rounded text-[11px] font-bold uppercase tracking-wider text-[#e4e4e7] disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
            Scan
          </button>
        </div>

        <div className="space-y-4">
          {isScanning && projects.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-[#52525b] gap-3 border border-[#27272a] border-dashed rounded-lg bg-[#09090b]">
              <RefreshCw className="w-5 h-5 animate-spin opacity-50" />
              <span className="text-[11px] uppercase tracking-wider">Scanning directory...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-[#52525b] border border-[#27272a] border-dashed rounded-lg bg-[#09090b]">
              <span className="text-[11px] uppercase tracking-wider">No projects found.</span>
            </div>
          ) : (
            projects.map(project => (
              <div 
                key={project.id} 
                className={`bg-[#18181b]/50 border-l-2 p-4 flex flex-col gap-3 transition-colors ${project.framework === 'WordPress' ? 'border-orange-500 bg-[#18181b]' : 'border-[#27272a] hover:border-[#52525b]'}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xs font-bold tracking-tight text-[#e4e4e7]">{project.name}</h3>
                    <p className="text-[10px] text-[#52525b] font-mono mt-1">{project.path}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {Array.isArray(tunnels) && tunnels.some((t: any) => t.name === `vanguarch-${project.name.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()}`) && (
                      <span className="text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 flex items-center gap-1"><Cloud className="w-3 h-3"/> Cloudflared</span>
                    )}
                    {project.framework === 'WordPress' && project.wpHelperInstalled !== undefined && (
                      <div className={`flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider ${project.wpHelperInstalled ? 'text-green-500' : 'text-red-500'}`}>
                        {project.wpHelperInstalled ? (
                          <><CheckCircle2 className="w-3 h-3" /> Terpasang</>
                        ) : (
                          <><XCircle className="w-3 h-3" /> Belum</>
                        )}
                      </div>
                    )}
                    <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider ${project.framework === 'WordPress' ? 'bg-orange-500/10 text-orange-400' : 'bg-[#27272a] text-[#a1a1aa]'}`}>
                      {project.framework}
                    </span>
                  </div>
                </div>
                
                <div className="pt-3 border-t border-[#27272a] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] text-[#a1a1aa]">
                      <LinkIcon className="w-3 h-3 text-[#52525b]" />
                      <span className="font-mono">{project.suggestedUrl}</span>
                    </div>
                    {(!Array.isArray(tunnels) || !tunnels.some((t: any) => t.name === `vanguarch-${project.name.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()}`)) && (
                      <button
                        onClick={() => handleAutoTunnel(project)}
                        disabled={autoTunnelStatus[project.id]?.loading}
                        className="px-2 py-1 bg-white text-black hover:bg-[#e4e4e7] rounded text-[10px] font-bold uppercase tracking-wider disabled:opacity-50 transition-colors flex items-center gap-1.5"
                      >
                        {autoTunnelStatus[project.id]?.loading ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        Tunnel
                      </button>
                    )}
                  </div>
                  
                  {autoTunnelStatus[project.id]?.error && (
                    <div className="p-2 bg-red-950/30 border border-red-900/50 rounded text-[10px] text-red-500 font-mono">
                      {autoTunnelStatus[project.id]?.error}
                    </div>
                  )}

                  {project.framework === 'WordPress' && (
                    <div className="bg-[#0c0c0e] border border-[#27272a] rounded overflow-hidden mt-2">
                      <div 
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-[#18181b]/50 transition-colors"
                        onClick={() => toggleHelper(project.id)}
                      >
                        <div className="flex items-center gap-2">
                          <Code2 className="w-3 h-3 text-orange-500" />
                          <span className="text-[10px] font-bold text-[#52525b] uppercase tracking-widest">WordPress Helper (wp-config.php)</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {!project.wpHelperInstalled && project.wpHelperInstalled !== undefined && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleInject(project.id, project.path); }}
                              disabled={injectStatus[project.id]?.loading}
                              className="text-[10px] uppercase font-bold tracking-wider bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] disabled:opacity-50 px-2 py-1 rounded flex items-center gap-1.5 transition-colors"
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
                            {expandedHelpers[project.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      </div>
                      
                      {expandedHelpers[project.id] && (
                        <div className="p-3 pt-0 border-t border-[#27272a] mt-1">
                          {injectStatus[project.id]?.error && (
                            <div className="mb-3 mt-2 p-2 bg-red-950/30 border border-red-900/50 rounded text-[10px] text-red-500 font-mono">
                              {injectStatus[project.id]?.error}
                            </div>
                          )}
                          {injectStatus[project.id]?.success && (
                            <div className="mb-3 mt-2 p-2 bg-green-950/30 border border-green-900/50 rounded text-[10px] text-green-500 font-mono">
                              {injectStatus[project.id]?.success}
                            </div>
                          )}

                          <p className="text-[10px] text-[#52525b] mb-3 leading-relaxed">
                            Tambahkan kode ini di <span className="text-orange-500 font-mono">wp-config.php</span> sebelum baris <span className="opacity-70 italic">/* That's all, stop editing! */</span> agar admin URL menyesuaikan dengan domain tunnel.
                          </p>
                          <pre className="text-[10px] text-[#a1a1aa] font-mono overflow-x-auto whitespace-pre bg-black p-3 rounded border border-[#27272a]">
                            {`if ( ! defined('WP_CLI') ) {

    $is_https =
        (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'
        || ($_SERVER['SERVER_PORT'] ?? null) == 443;

    if ($is_https) {
        $_SERVER['HTTPS'] = 'on';
    }

    $scheme = $is_https ? 'https' : 'http';

    $host =
        $_SERVER['HTTP_X_FORWARDED_HOST']
        ?? $_SERVER['HTTP_HOST'];

    define('WP_HOME', $scheme . '://' . $host);

    define('WP_SITEURL', $scheme . '://' . $host);
}`}
                          </pre>
                        </div>
                      )}
                    </div>
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
