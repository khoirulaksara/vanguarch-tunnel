import React from 'react';
import { useTunnelStore } from '../store/useTunnelStore';
import { Terminal } from 'lucide-react';
import { cn } from '../lib/utils';

export function LogsView() {
  const activeProcess = useTunnelStore(state => state.activeProcess);
  const logsEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeProcess?.logs]);

  if (!activeProcess) {
    return (
      <div className="flex flex-col h-full bg-black overflow-hidden border-t border-[#27272a]">
        <div className="flex items-center justify-between px-4 py-1.5 bg-[#18181b] border-b border-[#27272a]">
          <span className="text-[10px] font-bold text-[#52525b] uppercase tracking-widest">Live Output Logs</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-[#52525b]">
          <Terminal className="w-8 h-8 mb-3 opacity-30 text-[#52525b]" />
          <p className="text-[11px] uppercase tracking-wider font-bold">No active tunnel process</p>
          <p className="text-[10px] mt-1 text-[#27272a]">Start a tunnel to view logs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black overflow-hidden border-t border-[#27272a]">
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#18181b] border-b border-[#27272a]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[#52525b] uppercase tracking-widest">Live Output Logs</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("w-1.5 h-1.5 rounded-full", {
            'bg-green-500': activeProcess.status === 'running',
            'bg-orange-500 animate-pulse': activeProcess.status === 'starting',
            'bg-red-500': activeProcess.status === 'error',
            'bg-[#52525b]': activeProcess.status === 'stopped',
          })} />
          <span className="text-[10px] text-[#52525b] font-bold uppercase tracking-wider">{activeProcess.status}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] leading-relaxed space-y-1">
        {activeProcess.logs.map((log) => (
          <div key={log.id} className="flex gap-3">
            <span className="text-[#52525b] shrink-0">
              [{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}]
            </span>
            <span className={cn("break-all whitespace-pre-wrap", {
              'text-[#a1a1aa]': log.type === 'info',
              'text-green-500 font-bold': log.type === 'success',
              'text-red-500 font-bold': log.type === 'error',
            })}>
              {log.message}
            </span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
