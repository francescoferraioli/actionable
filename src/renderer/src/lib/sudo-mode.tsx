import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'actionable-sudo-mode';

const readStored = (): boolean => {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const writeStored = (value: boolean): void => {
  try {
    if (value) {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // sessionStorage may be unavailable in some environments
  }
};

interface SudoModeContextValue {
  sudoMode: boolean;
  enterSudoMode: () => void;
  exitSudoMode: () => void;
}

const SudoModeContext = createContext<SudoModeContextValue | null>(null);

export function SudoModeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [sudoMode, setSudoMode] = useState(readStored);

  const enterSudoMode = useCallback(() => {
    setSudoMode(true);
    writeStored(true);
  }, []);

  const exitSudoMode = useCallback(() => {
    setSudoMode(false);
    writeStored(false);
  }, []);

  return (
    <SudoModeContext.Provider value={{ sudoMode, enterSudoMode, exitSudoMode }}>
      {children}
    </SudoModeContext.Provider>
  );
}

export function useSudoMode(): SudoModeContextValue {
  const context = useContext(SudoModeContext);
  if (!context) {
    throw new Error('useSudoMode must be used within SudoModeProvider');
  }
  return context;
}
