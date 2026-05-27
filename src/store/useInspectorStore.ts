import { create } from 'zustand';

export interface InspectorLog {
  log_id: string;
  tunnel_name: string;
  timestamp: string;
  request: {
    method: string;
    path: string;
    query: string;
    headers: Record<string, string>;
    body: string;
  } | null;
  response: {
    status: number;
    headers: Record<string, string>;
    body: string;
  } | null;
}

interface InspectorStore {
  logs: InspectorLog[];
  addLog: (log: InspectorLog) => void;
  updateResponse: (log_id: string, response: any) => void;
  clearLogs: () => void;
}

export const useInspectorStore = create<InspectorStore>((set) => ({
  logs: [],
  addLog: (log) => set((state) => ({ 
    logs: [log, ...state.logs].slice(0, 200) 
  })),
  updateResponse: (log_id, response) => set((state) => ({
    logs: state.logs.map(l => 
      l.log_id === log_id ? { ...l, response } : l
    )
  })),
  clearLogs: () => set({ logs: [] }),
}));
