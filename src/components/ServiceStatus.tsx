import React, { useEffect, useState } from 'react';
import { Activity, CircleDashed, Globe, Database, Server } from 'lucide-react';
import { cn } from '../lib/utils';

interface PortStatus {
  port: number;
  is_open: true | false;
  description: string;
}

export function ServiceStatus() {
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

  if (!isTauri || ports.length === 0) return null;

  const openPorts = ports.filter(p => p.is_open);

  return (
    <div className="p-3 border-t border-[#27272a] hidden sm:block bg-[#0c0c0e]">
      <div className="text-[10px] uppercase font-bold tracking-wider text-[#52525b] mb-2 flex items-center gap-1.5">
        <Server className="w-3 h-3" /> Local Services
      </div>
      <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
        {ports.map(p => (
          <div key={p.port} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className={cn("font-medium", p.is_open ? "text-green-500" : "text-[#52525b]")}>
                {p.description}
              </span>
              <span className={cn("font-mono text-[9px]", p.is_open ? "text-green-500/70" : "text-[#52525b]/50")}>
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
