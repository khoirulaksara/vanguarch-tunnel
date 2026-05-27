import React, { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';

interface TunnelMetrics {
  tunnel_name: string;
  req_count: number;
}

interface TrafficMonitorProps {
  tunnelName: string;
}

export const TrafficMonitor: React.FC<TrafficMonitorProps> = ({ tunnelName }) => {
  const [dataPoints, setDataPoints] = useState<number[]>(Array(30).fill(0));
  const [lastTotal, setLastTotal] = useState<number | null>(null);
  const [totalHandled, setTotalHandled] = useState(0);

  useEffect(() => {
    let unlisten: any;

    const setupListener = async () => {
      unlisten = await listen<TunnelMetrics>('tunnel-metrics', (event) => {
        if (event.payload.tunnel_name === tunnelName) {
          setTotalHandled(event.payload.req_count);
          setLastTotal((prev) => {
            if (prev !== null) {
              const diff = Math.max(0, event.payload.req_count - prev);
              setDataPoints((pts) => [...pts.slice(1), diff]);
            }
            return event.payload.req_count;
          });
        }
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [tunnelName]);

  const maxVal = Math.max(...dataPoints, 10); 

  return (
    <div className="flex items-center gap-4 w-full">
      <div className="flex-1 h-10 flex items-end gap-[2px]">
        {dataPoints.map((val, i) => {
          const height = (val / maxVal) * 100;
          return (
            <div 
              key={i} 
              className="flex-1 bg-orange-500 rounded-t-[1px] transition-all duration-300 min-w-[2px]"
              style={{ height: `${Math.max(5, height)}%`, opacity: val > 0 ? 0.9 : 0.2 }}
              title={`${val} reqs/2s`}
            />
          );
        })}
      </div>
      <div className="flex flex-col items-end shrink-0 w-16">
        <span className="text-[10px] text-[#52525b] uppercase font-bold tracking-widest">Total</span>
        <span className="text-xs font-mono text-orange-500 font-bold">{totalHandled}</span>
      </div>
    </div>
  );
};
