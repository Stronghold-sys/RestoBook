import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ActivityLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
}

interface ActivityStore {
  logs: ActivityLog[];
  addLog: (action: string, details: string) => void;
  clearLogs: () => void;
}

export const useActivityStore = create<ActivityStore>()(
  persist(
    (set) => ({
      logs: [],
      addLog: (action, details) => set((state) => {
        const newLog: ActivityLog = {
          id: Math.random().toString(36).substring(2, 9),
          action,
          details,
          timestamp: new Date().toISOString()
        };
        // Keep the last 50 logs to prevent layout clutter
        const updatedLogs = [newLog, ...state.logs].slice(0, 50);
        return { logs: updatedLogs };
      }),
      clearLogs: () => set({ logs: [] })
    }),
    {
      name: 'restobook-activity-logs'
    }
  )
);
