// Shares player-mode state (US-110) for the overlay UI and canvas read-only guard.

import { createContext, useContext } from 'react';
import type { PlayerModeValue } from './usePlayerMode.ts';

const PlayerModeContext = createContext<PlayerModeValue | null>(null);

export const PlayerModeProvider = PlayerModeContext.Provider;

export function usePlayerModeContext(): PlayerModeValue {
  const value = useContext(PlayerModeContext);
  if (value === null) {
    throw new Error('usePlayerModeContext must be used within a PlayerModeProvider');
  }
  return value;
}

/** Non-throwing read for FlowCanvas — null when no provider or outside player mode. */
export function useOptionalPlayerMode(): PlayerModeValue | null {
  return useContext(PlayerModeContext);
}
