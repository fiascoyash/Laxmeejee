import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type EscapeHandler = () => void;

interface EscapeStackContextValue {
  /** Register an overlay's close handler. Returns an unregister function. */
  register: (handler: EscapeHandler, priority?: number) => () => void;
  /** True when at least one overlay is registered (useful to suppress back-nav on ESC). */
  hasOverlays: boolean;
}

const EscapeStackContext = createContext<EscapeStackContextValue | null>(null);

/**
 * Centralized ESC key management.
 *
 * Components push a close handler onto a priority-ordered stack when they open
 * and pop it when they close.  A single capture-phase keydown listener calls
 * only the topmost handler, so one ESC press closes exactly one layer.
 *
 * Lower priority numbers fire first (priority 1 = dropdowns, 5 = page back-nav).
 * Within the same priority the most recently registered handler fires first (LIFO).
 */
export function EscapeStackProvider({ children }: { children: React.ReactNode }) {
  const handlersRef = useRef<{ handler: EscapeHandler; priority: number; id: number }[]>([]);
  const idCounter = useRef(0);
  const [hasOverlays, setHasOverlays] = useState(false);

  const syncHasOverlays = useCallback(() => {
    setHasOverlays(handlersRef.current.length > 0);
  }, []);

  const register = useCallback((handler: EscapeHandler, priority = 3) => {
    const id = ++idCounter.current;
    handlersRef.current.push({ handler, priority, id });
    // Sort by priority ascending; stable sort keeps insertion order within same priority,
    // but we want LIFO within same priority, so we reverse on equal priority by
    // keeping insertion order and iterating from the end when firing.
    handlersRef.current.sort((a, b) => a.priority - b.priority);
    syncHasOverlays();
    return () => {
      handlersRef.current = handlersRef.current.filter(h => h.id !== id);
      syncHasOverlays();
    };
  }, [syncHasOverlays]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const stack = handlersRef.current;
      if (stack.length === 0) return;

      // Find the topmost: highest priority number present, then last-registered among those.
      // Since we sort ascending by priority, the last element has the highest priority.
      // Among equal priorities, later push() = later in array = fires first (LIFO).
      // Walk from end to find the first handler of the highest priority group.
      const topPriority = stack[stack.length - 1].priority;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].priority === topPriority) {
          // When the topmost layer is page-level navigation (priority 5) and the user
          // is focused in a text input, blur the field instead of navigating away.
          if (topPriority >= 5) {
            const target = event.target as HTMLElement;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
              target.blur();
              event.preventDefault();
              event.stopPropagation();
              return;
            }
          }
          event.preventDefault();
          event.stopPropagation();
          stack[i].handler();
          return;
        }
      }
    };

    // Capture phase so we intercept before any bubble-phase listeners.
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  return (
    <EscapeStackContext.Provider value={{ register, hasOverlays }}>
      {children}
    </EscapeStackContext.Provider>
  );
}

export function useEscapeStack(handler: EscapeHandler | null, priority?: number) {
  const ctx = useContext(EscapeStackContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!ctx || !handler) return;
    // Register a stable wrapper so re-renders with new function identities don't churn the stack.
    return ctx.register(() => handlerRef.current?.(), priority);
  }, [ctx, handler != null, priority]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useEscapeStackState() {
  return useContext(EscapeStackContext);
}
