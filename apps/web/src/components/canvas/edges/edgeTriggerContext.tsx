'use client';

import { createContext, useContext } from 'react';

export type OpenEdgeTriggerEditor = (edgeId: string, at: { x: number; y: number }) => void;

const EdgeTriggerContext = createContext<OpenEdgeTriggerEditor | null>(null);

export function EdgeTriggerProvider({
  openEditor,
  children,
}: {
  openEditor: OpenEdgeTriggerEditor | null;
  children: React.ReactNode;
}) {
  return <EdgeTriggerContext.Provider value={openEditor}>{children}</EdgeTriggerContext.Provider>;
}

export function useOpenEdgeTriggerEditor(): OpenEdgeTriggerEditor | null {
  return useContext(EdgeTriggerContext);
}
