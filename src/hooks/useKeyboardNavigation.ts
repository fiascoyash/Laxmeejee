import { useEffect, useRef, useCallback, useState } from 'react';

interface KeyboardNavigationOptions {
  onEnter?: (currentIndex: number, direction: 'next' | 'prev') => void;
  onArrowUp?: (currentIndex: number) => void;
  onArrowDown?: (currentIndex: number) => void;
  onDelete?: (currentIndex: number) => void;
  onEscape?: () => void;
  onTab?: (currentIndex: number, direction: 'next' | 'prev') => void;
  fieldCount: number;
  isEnabled?: boolean;
}

export function useKeyboardNavigation({
  onEnter,
  onArrowUp,
  onArrowDown,
  onDelete,
  onEscape,
  onTab,
  fieldCount,
  isEnabled = true,
}: KeyboardNavigationOptions) {
  const currentIndexRef = useRef(0);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const setCurrentIndex = useCallback((index: number) => {
    currentIndexRef.current = index;
    setFocusedIndex(index);
  }, []);

  useEffect(() => {
    if (!isEnabled) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      if (!isInput) return;

      // Handle Enter key
      if (e.key === 'Enter' && !e.shiftKey && onEnter) {
        e.preventDefault();
        onEnter(currentIndexRef.current, 'next');
      }

      // Handle Shift+Enter
      if (e.key === 'Enter' && e.shiftKey && onEnter) {
        e.preventDefault();
        onEnter(currentIndexRef.current, 'prev');
      }

      // Handle Arrow Up
      if (e.key === 'ArrowUp' && onArrowUp) {
        onArrowUp(currentIndexRef.current);
      }

      // Handle Arrow Down
      if (e.key === 'ArrowDown' && onArrowDown) {
        onArrowDown(currentIndexRef.current);
      }

      // Handle Delete key (when not in text editing context)
      if (e.key === 'Delete' && onDelete && !target.value) {
        e.preventDefault();
        onDelete(currentIndexRef.current);
      }

      // Handle Escape
      if (e.key === 'Escape' && onEscape) {
        onEscape();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isEnabled, onEnter, onArrowUp, onArrowDown, onDelete, onEscape, onTab]);

  return { currentIndexRef, focusedIndex, setFocusedIndex, setCurrentIndex };
}

export function useAutoFocus(isOpen: boolean, fieldSelector: string = 'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])') {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const firstField = containerRef.current.querySelector(fieldSelector) as HTMLElement;
      if (firstField) {
        setTimeout(() => firstField.focus(), 50);
      }
    }
  }, [isOpen, fieldSelector]);

  return containerRef;
}

export function useArrowNavigation({
  itemCount,
  onSelect,
  isOpen,
}: {
  itemCount: number;
  onSelect: (index: number) => void;
  isOpen: boolean;
}) {
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || itemCount === 0) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % itemCount);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + itemCount) % itemCount);
      } else if (e.key === 'Enter' && highlightedIndex >= 0) {
        e.preventDefault();
        onSelect(highlightedIndex);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, itemCount, highlightedIndex, onSelect]);

  return { highlightedIndex, setHighlightedIndex, resetHighlight: () => setHighlightedIndex(-1) };
}

interface FieldNavigationHook {
  moveToNext: () => void;
  moveToPrev: () => void;
  moveToField: (index: number) => void;
  focusField: (index: number) => void;
}

export function useFieldNavigation(fieldIds: string[], containerRef: React.RefObject<HTMLDivElement | null>): FieldNavigationHook {
  const focusField = useCallback((index: number) => {
    if (index < 0 || index >= fieldIds.length || !containerRef.current) return;

    const field = containerRef.current.querySelector(`[data-field-index="${index}"]`) as HTMLElement;
    if (field) {
      const input = field.querySelector('input, textarea, select') as HTMLElement | null;
      if (input) {
        input.focus();
        if (input.tagName === 'INPUT' && 'select' in input) {
          (input as HTMLInputElement).select();
        }
      }
    }
  }, [fieldIds, containerRef]);

  const moveToNext = useCallback(() => {
    focusField(0); // Start at first field
  }, [focusField]);

  const moveToPrev = useCallback(() => {
    // This would need current index tracking
  }, []);

  const moveToField = useCallback((index: number) => {
    focusField(index);
  }, [focusField]);

  return { moveToNext, moveToPrev, moveToField, focusField };
}

export default useKeyboardNavigation;
