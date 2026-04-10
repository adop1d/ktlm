import { useEffect, useCallback } from 'react';

type KeyboardShortcutHandler = (event: KeyboardEvent) => void;

interface UseKeyboardShortcutsOptions {
  onNewTask?: () => void;
  onFocusSearch?: () => void;
  onEscape?: () => void;
  enabled?: boolean;
}

/**
 * Custom hook for keyboard navigation and shortcuts
 * 
 * Shortcuts:
 * - n: New task
 * - /: Focus search
 * - 1/2/3: Switch filter tabs
 * - Esc: Close form or clear search
 */
export function useKeyboardShortcuts({
  onNewTask,
  onFocusSearch,
  onEscape,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;
    
    // Ignore if typing in an input
    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || 
                  target.tagName === 'TEXTAREA' || 
                  target.tagName === 'SELECT';
    
    // Ignore Cmd/Ctrl + key combinations (like Cmd+R for refresh)
    if (event.metaKey || event.ctrlKey) return;
    
    switch (event.key) {
      case 'n':
        // Only if not in an input
        if (!isInput && onNewTask) {
          event.preventDefault();
          onNewTask();
        }
        break;
        
      case '/':
        // Focus search
        if (onFocusSearch) {
          event.preventDefault();
          onFocusSearch();
        }
        break;
        
      case 'Escape':
        // Handle escape
        if (onEscape) {
          event.preventDefault();
          onEscape();
        }
        break;
        
      case '1':
      case '2':
      case '3':
        // These are handled by tab key navigation
        // Could emit custom events if needed
        break;
    }
  }, [enabled, onNewTask, onFocusSearch, onEscape]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Hook to manage focus trap in a container
 */
export function useFocusTrap(containerRef: { current: HTMLElement | null }, enabled = true) {
  useEffect(() => {
    if (!enabled || !containerRef.current) return;
    
    const container = containerRef.current;
    const focusableSelectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');
    
    const getFocusableElements = () => 
      Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
    
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      const focusable = getFocusableElements();
      if (focusable.length === 0) return;
      
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    
    container.addEventListener('keydown', handleTabKey);
    return () => container.removeEventListener('keydown', handleTabKey);
  }, [containerRef, enabled]);
}

/**
 * Hook for trap focus when modal/dialog is open
 */
export function useFocusReturn(focusRef: { current: HTMLElement | null }, isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;
    
    // Store previously focused element
    const previous = document.activeElement as HTMLElement;
    if (focusRef.current) {
      focusRef.current.focus();
    }
    
    return () => {
      // Return focus when closed
      if (previous) {
        previous.focus();
      }
    };
  }, [focusRef, isOpen]);
}