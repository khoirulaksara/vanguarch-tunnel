import React, { useEffect, useState } from 'react';
import { Activity, CircleDashed, Globe, Database, Server } from 'lucide-react';
import { cn } from '../lib/utils';

interface PortStatus {
  port: number;
  is_open: true | false;
  description: string;
}

export function ServiceStatus({ inPage, horizontal }: { inPage?: boolean, horizontal?: boolean }) {
  const [ports, setPorts] = useState<PortStatus[]>([]);
  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    if ((window as any).__TAURI_INTERNALS__) {
      setIsTauri(true);
      const checkPorts = async () => {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const res: PortStatus[] = await invoke('check_ports');
          setPorts(res);
        } catch (e) {
          console.error("Failed to check ports", e);
        }
      };
      
      checkPorts();
      const interval = setInterval(checkPorts, 5000);
      return () => clearInterval(interval);
    }
  }, []);

  const openPorts = ports.filter(p => p.is_open);

  if (!isTauri || openPorts.length === 0) return null;

  if (horizontal) {
    return (
      <div className="bg-[#0c0c0e] border-y border-[#27272a] h-8 px-4 flex items-center shrink-0 w-full overflow-hidden">
        <div className="text-[10px] uppercase font-bold tracking-wider text-[#52525b] flex items-center gap-1.5 border-r border-[#27272a] pr-4 mr-4 shrink-0">
          <Server className="w-3 h-3 text-orange-500" /> Local Services
        </div>
        <div className="flex items-center gap-6 overflow-x-auto custom-scrollbar flex-1 hide-scrollbar">
          {openPorts.map(p => (
            <div key={p.port} className="flex items-center gap-2 shrink-0">
              <div className="relative flex h-2 w-2">
                {p.is_open && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-20"></span>}
                <span className={cn("relative inline-flex rounded-full h-2 w-2", p.is_open ? "bg-green-500" : "bg-[#27272a]")}></span>
              </div>
              <span className={cn("text-[10px] font-medium", p.is_open ? "text-[#e4e4e7]" : "text-[#52525b]")}>
                {p.description} <span className="text-[#52525b] font-mono ml-0.5">:{p.port}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-[#0c0c0e]", inPage ? "p-5 border border-[#27272a] rounded-xl flex flex-col gap-4" : "p-3 border-t border-[#27272a] hidden sm:block")}>
      <div className={cn("uppercase font-bold tracking-wider text-[#52525b] flex items-center gap-1.5", inPage ? "text-xs" : "text-[10px] mb-2")}>
        <Server className={cn(inPage ? "w-4 h-4 text-orange-500" : "w-3 h-3")} /> Local Services
      </div>
      <div className={cn("custom-scrollbar", inPage ? "grid grid-cols-3 gap-4" : "space-y-1.5 max-h-[120px] overflow-y-auto pr-1")}>
        {openPorts.map(p => (
          <div key={p.port} className={cn("flex flex-col gap-1", inPage ? "bg-[#18181b] p-3 rounded-lg border border-[#27272a]" : "")}>
            <div className={cn("flex items-center justify-between", inPage ? "text-xs mb-1" : "text-[11px]")}>
              <span className={cn("font-medium truncate", p.is_open ? "text-green-500" : "text-[#52525b]")}>
                {p.description}
              </span>
              <span className={cn("font-mono shrink-0", inPage ? "text-[10px]" : "text-[9px]", p.is_open ? "text-green-500/70" : "text-[#52525b]/50")}>
                :{p.port}
              </span>
            </div>
            <div className="w-full bg-[#18181b] h-1 rounded-full overflow-hidden">
              <div className={cn("h-full transition-all duration-500", p.is_open ? "bg-green-500 w-full" : "bg-[#27272a] w-full")} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
