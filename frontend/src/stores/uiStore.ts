import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    set => ({
      // Una terminal es oscura de serie. El toggle sigue ahí para quien prefiera claro.
      darkMode: true,
      toggleDarkMode: () => set(state => ({ darkMode: !state.darkMode })),
    }),
    { name: 'ui-store' }
  )
);
