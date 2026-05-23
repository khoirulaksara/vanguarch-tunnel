import React, { useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { Folder, Search, Link as LinkIcon, Code2, RefreshCw } from 'lucide-react';

export function ProjectList() {
  const { projects, isScanning, scanProjects } = useProjectStore();
  const { projectsDirectory } = useSettingsStore();

  useEffect(() => {
    scanProjects();
  }, [scanProjects]);

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] p-6 text-[#e4e4e7] overflow-y-auto">
      <div className="p-5 bg-[#0c0c0e] border border-[#27272a] rounded-lg max-w-3xl w-full">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#52525b] flex items-center gap-2">
              <Folder className="w-4 h-4 text-orange-500" />
              Discovered Projects
            </h2>
            <p className="text-[#a1a1aa] text-[10px] mt-1">{projectsDirectory}</p>
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
                  <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider ${project.framework === 'WordPress' ? 'bg-orange-500/10 text-orange-400' : 'bg-[#27272a] text-[#a1a1aa]'}`}>
                    {project.framework}
                  </span>
                </div>
                
                <div className="pt-3 border-t border-[#27272a] space-y-3">
                  <div className="flex items-center gap-2 text-[11px] text-[#a1a1aa]">
                    <LinkIcon className="w-3 h-3 text-[#52525b]" />
                    <span className="font-mono">{project.suggestedUrl}</span>
                  </div>
                  
                  {project.framework === 'WordPress' && (
                    <div className="bg-[#0c0c0e] border border-[#27272a] rounded p-3 mt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Code2 className="w-3 h-3 text-orange-500" />
                        <span className="text-[10px] font-bold text-[#52525b] uppercase tracking-widest">WordPress Helper (wp-config.php)</span>
                      </div>
                      <pre className="text-[10px] text-[#a1a1aa] font-mono overflow-x-auto whitespace-pre bg-black p-3 rounded border border-[#27272a]">
                        {`if (!defined('WP_CLI')) {
    $is_https = 
        (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') 
        || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';

    if ($is_https) {
        $_SERVER['HTTPS'] = 'on';
    }
}`}
                      </pre>
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
