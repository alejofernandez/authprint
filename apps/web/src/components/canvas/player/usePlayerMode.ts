// US-110 — player-mode session + headless playback (mirrors useScenarioRun seam).

import type { Flow, ScenarioRun } from '@authprint/dsl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { derivePlayerSteps } from './steps.ts';
import { usePlayer } from './usePlayer.ts';

export type PlayerSession = {
  run: ScenarioRun;
  name: string;
  flow: Flow;
  initialContext: Record<string, unknown>;
};

export type PlayerModeValue = {
  session: PlayerSession | null;
  steps: ReturnType<typeof derivePlayerSteps>['steps'];
  divergedIndex: number | null;
  divergence: ReturnType<typeof derivePlayerSteps>['divergence'];
  enter: (
    run: ScenarioRun,
    name: string,
    flow: Flow,
    initialContext: Record<string, unknown>,
  ) => void;
  exit: () => void;
} & ReturnType<typeof usePlayer>;

export function usePlayerMode(): PlayerModeValue {
  const [session, setSession] = useState<PlayerSession | null>(null);

  const model = useMemo(() => {
    if (!session) {
      return { steps: [], divergedIndex: null as number | null, divergence: null };
    }
    return derivePlayerSteps(session.flow, session.run);
  }, [session]);

  const sessionKey = session?.run.scenarioId ?? null;

  const player = usePlayer({
    steps: model.steps,
    divergedIndex: model.divergedIndex,
  });

  const { seek, pause } = player;

  useEffect(() => {
    if (!sessionKey) return;
    seek(0);
    pause();
  }, [sessionKey, seek, pause]);

  const enter = useCallback(
    (run: ScenarioRun, name: string, flow: Flow, initialContext: Record<string, unknown>) => {
      setSession({ run, name, flow, initialContext });
    },
    [],
  );

  const exit = useCallback(() => {
    setSession(null);
  }, []);

  return {
    session,
    steps: model.steps,
    divergedIndex: model.divergedIndex,
    divergence: model.divergence,
    enter,
    exit,
    ...player,
  };
}
