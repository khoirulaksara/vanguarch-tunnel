import React, { useMemo } from 'react';
import { useInspectorStore } from '../store/useInspectorStore';
import { Activity, CheckCircle, XCircle, BarChart3, PieChart } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend } from 'recharts';
import { cn } from '../lib/utils';

export function AnalyticsView() {
  const { logs } = useInspectorStore();

  // Aggregate Data
  const stats = useMemo(() => {
    let total = 0;
    let success = 0;
    let error = 0;
    const methodCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};
    const endpointCounts: Record<string, number> = {};
    const timeSeries: Record<string, number> = {};

    logs.forEach(log => {
      if (!log.request) return;
      total++;
      
      const method = log.request.method.toUpperCase();
      methodCounts[method] = (methodCounts[method] || 0) + 1;

      // Group endpoints by base path (first two segments)
      const parts = log.request.path.split('?')[0].split('/');
      let basePath = parts.slice(0, 3).join('/') || '/';
      if (basePath === '//') basePath = '/';
      endpointCounts[basePath] = (endpointCounts[basePath] || 0) + 1;

      if (log.response) {
        const status = log.response.status;
        const statusStr = status.toString();
        statusCounts[statusStr] = (statusCounts[statusStr] || 0) + 1;

        if (status >= 200 && status < 400) success++;
        if (status >= 400) error++;
      }

      // Group by minute for time series
      const date = new Date(log.timestamp);
      const timeKey = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      timeSeries[timeKey] = (timeSeries[timeKey] || 0) + 1;
    });

    const timeData = Object.entries(timeSeries)
      .map(([time, count]) => ({ time, requests: count }))
      .sort((a, b) => a.time.localeCompare(b.time));

    const methodData = Object.entries(methodCounts).map(([name, value]) => ({ name, value }));
    const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
    
    const topEndpoints = Object.entries(endpointCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { total, success, error, timeData, methodData, statusData, topEndpoints };
  }, [logs]);

  const COLORS = ['#f97316', '#3b82f6', '#22c55e', '#ef4444', '#eab308'];
  const STATUS_COLORS: Record<string, string> = {
    '200': '#22c55e',
    '201': '#22c55e',
    '301': '#3b82f6',
    '302': '#3b82f6',
    '400': '#eab308',
    '401': '#eab308',
    '403': '#f97316',
    '404': '#f97316',
    '500': '#ef4444',
    '502': '#ef4444',
  };

  const successRate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0;
  const errorRate = stats.total > 0 ? Math.round((stats.error / stats.total) * 100) : 0;

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] text-[#e4e4e7] overflow-y-auto">
      <div className="flex flex-col max-w-5xl w-full mx-auto">
        <div className="sticky top-0 z-10 bg-[#09090b]/90 backdrop-blur-md h-16 px-6 border-b border-[#27272a] flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#52525b] flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-orange-500" />
              Traffic Analytics
            </h2>
            <p className="text-[#a1a1aa] text-[10px]">Real-time dashboard for local tunnel requests</p>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Scorecards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#0c0c0e] border border-[#27272a] rounded-xl p-5 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-[#a1a1aa] mb-2 text-[10px] font-bold uppercase tracking-wider">
                <Activity className="w-4 h-4 text-blue-500" /> Total Requests
              </div>
              <div className="text-4xl font-bold font-mono text-white">{stats.total}</div>
            </div>
            
            <div className="bg-[#0c0c0e] border border-[#27272a] rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <CheckCircle className="w-16 h-16 text-green-500" />
              </div>
              <div className="flex items-center gap-2 text-[#a1a1aa] mb-2 text-[10px] font-bold uppercase tracking-wider">
                <CheckCircle className="w-4 h-4 text-green-500" /> Success Rate
              </div>
              <div className="text-4xl font-bold font-mono text-green-500">{successRate}%</div>
            </div>

            <div className="bg-[#0c0c0e] border border-[#27272a] rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <XCircle className="w-16 h-16 text-red-500" />
              </div>
              <div className="flex items-center gap-2 text-[#a1a1aa] mb-2 text-[10px] font-bold uppercase tracking-wider">
                <XCircle className="w-4 h-4 text-red-500" /> Error Rate
              </div>
              <div className="text-4xl font-bold font-mono text-red-500">{errorRate}%</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-3 gap-4 h-[300px]">
            <div className="col-span-2 bg-[#0c0c0e] border border-[#27272a] rounded-xl p-5 flex flex-col">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1aa] mb-4">Requests Over Time (per min)</h3>
              <div className="flex-1 w-full min-h-0">
                {stats.timeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.timeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', fontSize: '12px' }}
                        itemStyle={{ color: '#f97316' }}
                      />
                      <Area type="monotone" dataKey="requests" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#colorReq)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-[#52525b] text-xs">No traffic data yet.</div>
                )}
              </div>
            </div>

            <div className="bg-[#0c0c0e] border border-[#27272a] rounded-xl p-5 flex flex-col">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1aa] mb-4 flex items-center gap-2">
                <PieChart className="w-3.5 h-3.5" /> Status Codes
              </h3>
              <div className="flex-1 w-full min-h-0">
                {stats.statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={stats.statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#a1a1aa'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', fontSize: '12px' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', color: '#a1a1aa' }} />
                    </RePieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-[#52525b] text-xs">No traffic data yet.</div>
                )}
              </div>
            </div>
          </div>

          {/* Top Endpoints */}
          <div className="bg-[#0c0c0e] border border-[#27272a] rounded-xl p-5">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1aa] mb-4">Top Accessed Endpoints</h3>
            <div className="space-y-2">
              {stats.topEndpoints.length > 0 ? stats.topEndpoints.map(([path, count], index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-[#18181b] border border-[#27272a] rounded-lg">
                  <div className="font-mono text-xs text-white truncate max-w-[70%]">{path}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#a1a1aa] uppercase font-bold tracking-widest">Hits</span>
                    <span className="text-orange-500 font-bold font-mono">{count}</span>
                  </div>
                </div>
              )) : (
                <div className="text-center p-4 text-[#52525b] text-xs">No traffic data yet.</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
