// Shares the scenario-mode run state (US-060) down the canvas tree so the
// trace visualization (US-061) and the floating controls + Context panel
// (US-062) read the same `useScenarioRun` instance the Editor shell owns.

import { createContext, useContext } from 'react';
import type { ScenarioModeValue } from './useScenarioRun.ts';

const ScenarioModeContext = createContext<ScenarioModeValue | null>(null);

export const ScenarioModeProvider = ScenarioModeContext.Provider;

export function useScenarioMode(): ScenarioModeValue {
  const value = useContext(ScenarioModeContext);
  if (value === null) {
    throw new Error('useScenarioMode must be used within a ScenarioModeProvider');
  }
  return value;
}
