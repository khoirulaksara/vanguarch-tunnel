import React, { useState } from 'react';
import { History, Trash2, Clock, Globe, MonitorSmartphone, ExternalLink } from 'lucide-react';
import { useTunnelStore } from '../store/useTunnelStore';
import { cn } from '../lib/utils';

function formatDuration(ms: number): string {
  if (ms <= 0) return '< 1s';
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function HistoryView() {
  const { history, clearHistory } = useTunnelStore();
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="flex flex-col h-full w-full bg-[#050505] text-[#e4e4e7] overflow-y-auto overflow-x-hidden relative">
      {/* Background glow */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-orange-500/5 blur-[150px] rounded-full pointer-events-none" />

      <div className="flex flex-col max-w-5xl w-full mx-auto relative z-10">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-[#050505]/80 backdrop-blur-xl h-16 px-8 border-b border-[#27272a]/50 flex items-center justify-between gap-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
            <History className="w-4 h-4 text-orange-500" />
            Session History
          </h2>
          {history.length > 0 && (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1.5 text-[10px] text-[#52525b] hover:text-red-400 transition-colors font-bold"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear All
            </button>
          )}
        </div>

        {/* Confirm clear dialog */}
        {confirmClear && (
          <div className="mx-8 mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between gap-4">
            <span className="text-sm text-red-400">Clear all {history.length} session records?</span>
            <div className="flex gap-2">
              <button onClick={() => setConfirmClear(false)} className="px-3 py-1.5 text-xs font-bold bg-[#27272a] text-[#a1a1aa] rounded-lg hover:bg-[#3f3f46] transition-colors">Cancel</button>
              <button onClick={() => { clearHistory(); setConfirmClear(false); }} className="px-3 py-1.5 text-xs font-bold bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors border border-red-500/20">Clear</button>
            </div>
          </div>
        )}

        <div className="px-8 py-8 flex flex-col gap-4">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <History className="w-12 h-12 text-[#27272a]" />
              <div className="text-center">
                <p className="text-sm text-[#52525b] font-medium">No session history yet</p>
                <p className="text-xs text-[#3f3f46] mt-1">Completed tunnel sessions will appear here</p>
              </div>
            </div>
          ) : (
            <>
              <div className="text-xs text-[#52525b] font-medium mb-2">{history.length} session{history.length !== 1 ? 's' : ''} recorded</div>
              <div className="bg-[#0c0c0e]/80 border border-[#27272a]/50 rounded-2xl overflow-hidden">
                <div className="divide-y divide-[#27272a]/50">
                  {history.map((record) => (
                    <div key={record.id} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-[#18181b]/30 transition-colors group">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#18181b] border border-[#27272a] flex items-center justify-center shrink-0">
                          <Globe className="w-3.5 h-3.5 text-orange-500/70" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">{record.name}</div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-[#52525b] font-mono truncate">{record.localUrl}</span>
                            <span className="text-[#3f3f46]">→</span>
                            <span className="text-xs text-green-400/70 font-mono truncate max-w-[180px]">{record.publicDomain}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#52525b]">
                          <Clock className="w-3 h-3" />
                          <span className="tabular-nums">{formatDuration(record.durationMs)}</span>
                        </div>
                        <div className="text-[10px] text-[#3f3f46] font-mono text-right">
                          <div>{formatDate(record.startedAt)}</div>
                          <div className="text-[#27272a]">→ {formatDate(record.stoppedAt)}</div>
                        </div>
                        <button
                          onClick={() => navigator.clipboard.writeText(`https://${record.publicDomain}`).catch(() => {})}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-[#27272a] text-[#52525b] hover:text-[#a1a1aa]"
                          title="Copy public domain"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
