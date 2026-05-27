import React, { useState, useEffect } from 'react';
import { Search, Globe, ChevronRight, Activity, XCircle, ArrowDown, ArrowUp, Play, X, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTunnelStore } from '../store/useTunnelStore';
import { useInspectorStore } from '../store/useInspectorStore';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

export function InspectorView() {
  const { logs, clearLogs } = useInspectorStore();
  const { activeProcesses } = useTunnelStore();
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  
  // Replay State
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayMethod, setReplayMethod] = useState('GET');
  const [replayPath, setReplayPath] = useState('/');
  const [replayHeaders, setReplayHeaders] = useState('{\n  \n}');
  const [replayBody, setReplayBody] = useState('');

  const selectedLog = logs.find(l => l.log_id === selectedLogId);

  useEffect(() => {
    if (selectedLog && isReplaying) {
      setReplayMethod(selectedLog.request?.method || 'GET');
      const fullPath = (selectedLog.request?.path || '') + (selectedLog.request?.query ? `?${selectedLog.request.query}` : '');
      setReplayPath(fullPath);
      setReplayHeaders(JSON.stringify(selectedLog.request?.headers || {}, null, 2));
      setReplayBody(selectedLog.request?.body || '');
    }
  }, [selectedLog, isReplaying]);

  const handleStartReplay = () => {
    setIsReplaying(true);
  };

  const submitReplay = async () => {
    if (!selectedLog) return;
    const process = activeProcesses[selectedLog.tunnel_name];
    if (!process || !process.config?.localUrl) {
      toast.error("Tunnel local URL not found or not running.");
      return;
    }

    let parsedHeaders = {};
    try {
      parsedHeaders = JSON.parse(replayHeaders || '{}');
    } catch (e) {
      toast.error("Invalid Headers JSON. Must be valid JSON object.");
      return;
    }

    const base = process.config.localUrl.replace(/\/$/, '');
    const fullUrl = `${base}${replayPath}`;

    try {
      await invoke('replay_request', {
        tunnelName: selectedLog.tunnel_name,
        method: replayMethod,
        url: fullUrl,
        headers: parsedHeaders,
        body: replayBody
      });
      setIsReplaying(false);
      toast.success("Request replayed! See log at the top.");
    } catch (e: any) {
      toast.error(`Replay failed: ${e}`);
    }
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-500';
    if (status >= 300 && status < 400) return 'text-yellow-500';
    if (status >= 400 && status < 500) return 'text-orange-500';
    if (status >= 500) return 'text-red-500';
    return 'text-[#a1a1aa]';
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'text-blue-400';
      case 'POST': return 'text-green-400';
      case 'PUT': return 'text-orange-400';
      case 'DELETE': return 'text-red-400';
      case 'PATCH': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="flex h-full w-full bg-[#09090b] text-[#e4e4e7] overflow-hidden">
      {/* Left Sidebar: Request List */}
      <div className="w-1/3 border-r border-[#27272a] flex flex-col h-full bg-[#0c0c0e]">
        <div className="p-4 border-b border-[#27272a] shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#52525b] flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-500" />
              Web Inspector
            </h2>
            <button onClick={clearLogs} className="text-[10px] text-[#52525b] hover:text-orange-500 uppercase font-bold tracking-wider transition-colors">
              Clear
            </button>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#52525b]" />
            <input 
              type="text" 
              placeholder="Filter by path or method..."
              className="w-full bg-[#18181b] border border-[#27272a] rounded p-1.5 pl-8 text-xs focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#52525b] p-6 text-center space-y-3">
              <Globe className="w-8 h-8 opacity-20" />
              <p className="text-xs">No intercepted traffic yet.</p>
              <p className="text-[10px] opacity-60">Enable Web Inspector on a running tunnel to see requests here.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#27272a]">
              {logs.map((log) => (
                <button
                  key={log.log_id}
                  onClick={() => {
                    setSelectedLogId(log.log_id);
                    setIsReplaying(false);
                  }}
                  className={cn(
                    "w-full text-left p-3 hover:bg-[#18181b] transition-colors flex flex-col gap-2",
                    selectedLogId === log.log_id && !isReplaying ? "bg-[#18181b] border-l-2 border-orange-500" : "border-l-2 border-transparent"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className={cn("font-bold w-10", getMethodColor(log.request?.method || ''))}>
                        {log.request?.method}
                      </span>
                      <span className="truncate max-w-[150px]" title={log.request?.path}>
                        {log.request?.path}
                      </span>
                    </div>
                    <span className={cn("text-[10px] font-bold", log.response ? getStatusColor(log.response.status) : "text-[#52525b] animate-pulse")}>
                      {log.response ? log.response.status : 'PENDING'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-[#52525b] font-mono">
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span>{log.tunnel_name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar: Details or Replay Editor */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto relative">
        {selectedLog ? (
          isReplaying ? (
            <div className="p-6 flex flex-col gap-6 h-full">
              <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
                <h2 className="text-lg font-bold flex items-center gap-2 text-orange-500">
                  <Edit2 className="w-5 h-5" /> Edit & Replay
                </h2>
                <div className="flex gap-2">
                  <button onClick={() => setIsReplaying(false)} className="px-3 py-1.5 text-xs text-[#a1a1aa] hover:text-white transition-colors">
                    Cancel
                  </button>
                  <button onClick={submitReplay} className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded transition-colors flex items-center gap-2">
                    <Play className="w-3.5 h-3.5" /> Send Request
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <select 
                    value={replayMethod}
                    onChange={(e) => setReplayMethod(e.target.value)}
                    className="bg-[#18181b] border border-[#27272a] rounded px-3 py-2 text-xs font-mono text-[#e4e4e7] focus:border-orange-500 outline-none w-24"
                  >
                    <option>GET</option>
                    <option>POST</option>
                    <option>PUT</option>
                    <option>DELETE</option>
                    <option>PATCH</option>
                    <option>OPTIONS</option>
                  </select>
                  <input 
                    type="text" 
                    value={replayPath}
                    onChange={(e) => setReplayPath(e.target.value)}
                    placeholder="/api/path?query=1"
                    className="flex-1 bg-[#18181b] border border-[#27272a] rounded px-3 py-2 text-xs font-mono text-[#e4e4e7] focus:border-orange-500 outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-[10px] uppercase font-bold text-[#52525b]">Headers (JSON)</label>
                  <textarea 
                    value={replayHeaders}
                    onChange={(e) => setReplayHeaders(e.target.value)}
                    className="w-full h-32 bg-[#18181b] border border-[#27272a] rounded p-3 text-xs font-mono text-[#e4e4e7] focus:border-orange-500 outline-none resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-[10px] uppercase font-bold text-[#52525b]">Body</label>
                  <textarea 
                    value={replayBody}
                    onChange={(e) => setReplayBody(e.target.value)}
                    className="w-full h-48 bg-[#18181b] border border-[#27272a] rounded p-3 text-xs font-mono text-[#e4e4e7] focus:border-orange-500 outline-none resize-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
                <div className="flex items-center gap-3">
                  <span className={cn("text-lg font-bold font-mono", getMethodColor(selectedLog.request?.method || ''))}>
                    {selectedLog.request?.method}
                  </span>
                  <span className="text-lg font-mono truncate">{selectedLog.request?.path}</span>
                </div>
                <button 
                  onClick={handleStartReplay}
                  className="px-3 py-1.5 bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" /> Replay
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Request */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#52525b] flex items-center gap-2">
                    <ArrowUp className="w-3.5 h-3.5" /> Request
                  </h3>
                  
                  <div className="bg-[#0c0c0e] border border-[#27272a] rounded-lg overflow-hidden">
                    <div className="bg-[#18181b] border-b border-[#27272a] px-3 py-1.5 text-[10px] font-bold text-[#a1a1aa] uppercase">
                      Headers
                    </div>
                    <div className="p-3 font-mono text-[10px] space-y-1 max-h-48 overflow-y-auto">
                      {Object.entries(selectedLog.request?.headers || {}).map(([key, val]) => (
                        <div key={key} className="grid grid-cols-3 gap-2">
                          <span className="text-[#a1a1aa]">{key}:</span>
                          <span className="col-span-2 text-white break-all">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#0c0c0e] border border-[#27272a] rounded-lg overflow-hidden">
                    <div className="bg-[#18181b] border-b border-[#27272a] px-3 py-1.5 text-[10px] font-bold text-[#a1a1aa] uppercase">
                      Body
                    </div>
                    <div className="p-3 font-mono text-xs whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                      {selectedLog.request?.body || <span className="text-[#52525b] italic">Empty body</span>}
                    </div>
                  </div>
                </div>

                {/* Response */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#52525b] flex items-center gap-2">
                      <ArrowDown className="w-3.5 h-3.5" /> Response
                    </h3>
                    {selectedLog.response && (
                      <span className={cn("text-xs font-bold font-mono", getStatusColor(selectedLog.response.status))}>
                        {selectedLog.response.status}
                      </span>
                    )}
                  </div>

                  {!selectedLog.response ? (
                    <div className="flex flex-col items-center justify-center h-48 border border-[#27272a] border-dashed rounded-lg text-[#52525b]">
                      <Activity className="w-6 h-6 mb-2 animate-pulse" />
                      <p className="text-xs">Waiting for response...</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-[#0c0c0e] border border-[#27272a] rounded-lg overflow-hidden">
                        <div className="bg-[#18181b] border-b border-[#27272a] px-3 py-1.5 text-[10px] font-bold text-[#a1a1aa] uppercase">
                          Headers
                        </div>
                        <div className="p-3 font-mono text-[10px] space-y-1 max-h-48 overflow-y-auto">
                          {Object.entries(selectedLog.response.headers || {}).map(([key, val]) => (
                            <div key={key} className="grid grid-cols-3 gap-2">
                              <span className="text-[#a1a1aa]">{key}:</span>
                              <span className="col-span-2 text-white break-all">{val}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-[#0c0c0e] border border-[#27272a] rounded-lg overflow-hidden">
                        <div className="bg-[#18181b] border-b border-[#27272a] px-3 py-1.5 text-[10px] font-bold text-[#a1a1aa] uppercase">
                          Body
                        </div>
                        <div className="p-3 font-mono text-xs whitespace-pre-wrap break-all max-h-64 overflow-y-auto text-[#e4e4e7]">
                          {selectedLog.response.body || <span className="text-[#52525b] italic">Empty body</span>}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-full text-[#52525b]">
            <p className="text-sm">Select a request to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
