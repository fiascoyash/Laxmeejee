import { useState, useCallback, useRef } from 'react';
import { TemplateBlock, TableColumn } from '../types';

interface TemplateState {
  blocks: TemplateBlock[];
  productColumns: TableColumn[];
}

interface UseTemplateHistoryOptions {
  maxHistorySize?: number;
}

interface UseTemplateHistoryReturn {
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  pushState: (state: TemplateState) => void;
  getCurrentState: () => TemplateState | null;
}

export function useTemplateHistory(options: UseTemplateHistoryOptions = {}): UseTemplateHistoryReturn {
  const { maxHistorySize = 50 } = options;

  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef<TemplateState[]>([]);
  const isUndoRedoRef = useRef(false);

  const pushState = useCallback((state: TemplateState) => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }

    const history = historyRef.current;

    if (history.length > maxHistorySize) {
      historyRef.current = history.slice(-maxHistorySize + 1);
    }

    historyRef.current = [...history.slice(0, historyIndex + 1), state];

    setHistoryIndex(historyRef.current.length - 1);
  }, [historyIndex, maxHistorySize]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoRef.current = true;
      setHistoryIndex(prev => prev - 1);
    }
  }, [historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < historyRef.current.length - 1) {
      isUndoRedoRef.current = true;
      setHistoryIndex(prev => prev + 1);
    }
  }, [historyIndex]);

  const getCurrentState = useCallback((): TemplateState | null => {
    if (historyIndex >= 0 && historyIndex < historyRef.current.length) {
      return historyRef.current[historyIndex];
    }
    return null;
  }, [historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyRef.current.length - 1;

  return {
    historyIndex,
    canUndo,
    canRedo,
    undo,
    redo,
    pushState,
    getCurrentState,
  };
}
