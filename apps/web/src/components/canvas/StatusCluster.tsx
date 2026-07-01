'use client';

// Bottom-right status cluster (E43 / US-093): compact pill row anchored where the
// React Flow minimap lived.

import type { ReactNode } from 'react';

export function StatusCluster({ children }: { children: ReactNode }) {
  return (
    <div className="absolute right-4 bottom-4 z-20 flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-panel/95 p-1 shadow-lg backdrop-blur dark:border-border-default dark:bg-bg-panel/95">
      {children}
    </div>
  );
}
