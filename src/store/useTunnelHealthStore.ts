import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface HealthRecord {
  tunnelName: string;
  publicDomain: string;
  status: 'ok' | 'down' | 'unknown';
  latencyMs: number | null;
  httpStatus: number | null;
  lastCheckedAt: number | null;
  /** Timestamp when this tunnel first went down (null if ok/unknown) */
  downSince: number | null;
  consecutiveFailures: number;
}

interface TunnelHealthStore {
  enabled: boolean;
  intervalMinutes: number; // 1 | 2 | 5 | 10
  records: Record<string, HealthRecord>;
  setEnabled: (v: boolean) => void;
  setIntervalMinutes: (v: number) => void;
  updateRecord: (tunnelName: string, data: Partial<HealthRecord>) => void;
  clearRecord: (tunnelName: string) => void;
  clearAll: () => void;
}

export const useTunnelHealthStore = create<TunnelHealthStore>()(
  persist(
    (set) => ({
      enabled: true,
      intervalMinutes: 2,
      records: {},

      setEnabled: (v) => set({ enabled: v }),
      setIntervalMinutes: (v) => set({ intervalMinutes: v }),

      updateRecord: (tunnelName, data) =>
        set((state) => ({
          records: {
            ...state.records,
            [tunnelName]: {
              tunnelName,
              publicDomain: '',
              status: 'unknown',
              latencyMs: null,
              httpStatus: null,
              lastCheckedAt: null,
              downSince: null,
              consecutiveFailures: 0,
              ...state.records[tunnelName],
              ...data,
            },
          },
        })),

      clearRecord: (tunnelName) =>
        set((state) => {
          const { [tunnelName]: _, ...rest } = state.records;
          return { records: rest };
        }),

      clearAll: () => set({ records: {} }),
    }),
    {
      name: 'vanguarch-health',
      // Only persist settings, not transient records
      partialize: (state) => ({
        enabled: state.enabled,
        intervalMinutes: state.intervalMinutes,
      }),
    }
  )
);
