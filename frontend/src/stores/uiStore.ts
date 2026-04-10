import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    set => ({
      darkMode: false,
      toggleDarkMode: () => set(state => ({ darkMode: !state.darkMode })),
    }),
    { name: 'ui-store' }
  )
);
