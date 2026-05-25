import React, { useState } from 'react';
import { useTunnelStore } from '../store/useTunnelStore';
import { Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';

interface LogsViewProps {
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

export function LogsView({ isMinimized = false, onToggleMinimize }: LogsViewProps) {
  const { activeProcesses, selectedLogTunnel, selectLogTunnel, clearLogs, removeProcess } = useTunnelStore();
  const logsEndRef = React.useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());

  React.useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const tunnelKeys = Object.keys(activeProcesses);
  const currentProcess = selectedLogTunnel ? activeProcesses[selectedLogTunnel] : null;

  React.useEffect(() => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentProcess?.logs, autoScroll]);

  if (!currentProcess && tunnelKeys.length === 0) {
    return (
      <div className="flex flex-col h-full bg-black overflow-hidden border-t border-[#27272a]">
        <div className="flex items-center justify-between px-4 py-1.5 bg-[#18181b] border-b border-[#27272a] cursor-pointer" onClick={onToggleMinimize}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-[#52525b] uppercase tracking-widest">Live Output Logs</span>
          </div>
          <div className="flex items-center gap-2 text-[#52525b]">
            <span className="text-[10px] uppercase font-bold tracking-wider">No Process</span>
            {isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </div>
        {!isMinimized && (
          <div className="flex-1 flex flex-col items-center justify-center text-[#52525b] pb-2">
            <Terminal className="w-8 h-8 mb-3 opacity-30 text-[#52525b]" />
            <p className="text-[11px] uppercase tracking-wider font-bold">No active tunnel process</p>
            <p className="text-[10px] mt-1 text-[#27272a]">Start a tunnel to view logs.</p>
          </div>
        )}
      </div>
    );
  }

  // Auto-select first if none selected but available
  if (!currentProcess && tunnelKeys.length > 0) {
    selectLogTunnel(tunnelKeys[0]);
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-black overflow-hidden border-t border-[#27272a]">
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#18181b] border-b border-[#27272a]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 cursor-pointer hover:text-orange-500 transition-colors" onClick={onToggleMinimize}>
            <span className="text-[10px] font-bold text-[#52525b] uppercase tracking-widest group-hover:text-amber-500">Live Output Logs</span>
            <div className="text-[#52525b]">
              {isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </div>
          
          {!isMinimized && tunnelKeys.length > 1 && (
            <select 
              value={selectedLogTunnel!} 
              onChange={e => selectLogTunnel(e.target.value)}
              className="bg-[#09090b] text-[10px] uppercase font-bold tracking-wider text-[#a1a1aa] border border-[#27272a] rounded px-2 py-0.5 focus:outline-none"
            >
              {tunnelKeys.map(key => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-4">
          {!isMinimized && (
            <>
              <div className="flex gap-3 text-[10px] text-[#52525b]">
                {currentProcess?.status === 'stopped' && (
                  <button 
                    onClick={() => removeProcess(selectedLogTunnel!)} 
                    disabled={currentProcess.stoppedAt ? (now - currentProcess.stoppedAt) < 60000 : false}
                    className="hover:text-red-400 disabled:hover:text-[#52525b] disabled:opacity-50 transition-colors uppercase tracking-wider font-bold"
                    title={currentProcess.stoppedAt && (now - currentProcess.stoppedAt) < 60000 ? `Cooling down (${Math.ceil((60000 - (now - currentProcess.stoppedAt)) / 1000)}s)` : "Close Logs"}
                  >
                    {currentProcess.stoppedAt && (now - currentProcess.stoppedAt) < 60000 
                      ? `${Math.ceil((60000 - (now - currentProcess.stoppedAt)) / 1000)}s`
                      : 'Close'}
                  </button>
                )}
                <button onClick={() => {
                  if (currentProcess) {
                    const text = currentProcess.logs.map(l => `[${new Date(l.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}] ${l.message}`).join('\n');
                    navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }} className={cn("transition-colors uppercase tracking-wider font-bold", copied ? "text-green-500" : "hover:text-[#a1a1aa]")}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button onClick={() => clearLogs(selectedLogTunnel!)} className="hover:text-[#a1a1aa] transition-colors uppercase tracking-wider font-bold">Clear</button>
                <button onClick={() => setAutoScroll(!autoScroll)} className={cn("transition-colors uppercase tracking-wider font-bold", autoScroll ? "text-orange-500 hover:text-orange-400" : "hover:text-[#a1a1aa]")}>Scroll</button>
              </div>
              <div className="w-px h-3 bg-[#27272a]"></div>
            </>
          )}
          <div className="flex items-center gap-2 cursor-pointer" onClick={onToggleMinimize}>
            {currentProcess && (
              <>
                <div className={cn("w-1.5 h-1.5 rounded-full", {
                  'bg-green-500': currentProcess.status === 'running',
                  'bg-orange-500 animate-pulse': currentProcess.status === 'starting',
                  'bg-red-500': currentProcess.status === 'error',
                  'bg-[#52525b]': currentProcess.status === 'stopped',
                })} />
                <span className="text-[10px] text-[#52525b] font-bold uppercase tracking-wider">{currentProcess.status}</span>
              </>
            )}
          </div>
        </div>
      </div>
      {!isMinimized && currentProcess && (
        <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] leading-relaxed space-y-1">
          {currentProcess.logs.map((log) => (
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
      )}
    </div>
  );
}
