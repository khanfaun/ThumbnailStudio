import React, { useState, useCallback } from 'react';

export const useHistoryState = <T extends unknown>(initialState: T): readonly [T, (action: React.SetStateAction<T>) => void, () => void, () => void, (newState: T) => void, boolean, boolean] => {
  const [history, setHistory] = useState([initialState]);
  const [index, setIndex] = useState(0);

  const setState = useCallback((action: React.SetStateAction<T>) => {
    const currentState = history[index];
    const newState = typeof action === 'function'
      ? (action as (prevState: T) => T)(currentState)
      : action;

    if (JSON.stringify(newState) === JSON.stringify(currentState)) {
      return; // No change, don't add to history
    }

    const newHistory = history.slice(0, index + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setIndex(newHistory.length - 1);
  }, [history, index]);

  const undo = useCallback(() => {
    if (index > 0) {
      setIndex(prevIndex => prevIndex - 1);
    }
  }, [index]);

  const redo = useCallback(() => {
    if (index < history.length - 1) {
      setIndex(prevIndex => prevIndex + 1);
    }
  }, [index, history.length]);
  
  const resetState = useCallback((newState: T) => {
    setHistory([newState]);
    setIndex(0);
  }, []);

  return [
    history[index],
    setState,
    undo,
    redo,
    resetState,
    index > 0,
    index < history.length - 1,
  ];
};