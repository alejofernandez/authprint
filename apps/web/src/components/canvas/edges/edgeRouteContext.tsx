'use client';

import { createContext, useContext } from 'react';
import type { Position } from '../ydoc/schema.ts';

export type SetEdgeRoute = (edgeId: string, points: Position[]) => void;

const EdgeRouteContext = createContext<SetEdgeRoute | null>(null);

export function EdgeRouteProvider({
  setRoute,
  children,
}: {
  setRoute: SetEdgeRoute | null;
  children: React.ReactNode;
}) {
  return <EdgeRouteContext.Provider value={setRoute}>{children}</EdgeRouteContext.Provider>;
}

export function useSetEdgeRoute(): SetEdgeRoute | null {
  return useContext(EdgeRouteContext);
}
