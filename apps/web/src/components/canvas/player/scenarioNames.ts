import type { Scenario } from '@authprint/dsl';

/** Allocate a unique scenario name, preferring `preferred` then `preferred 2`, … */
export function uniqueScenarioName(preferred: string, existing: readonly Scenario[]): string {
  const taken = new Set(existing.map((s) => s.name));
  if (!taken.has(preferred)) return preferred;
  for (let n = 2; ; n++) {
    const candidate = `${preferred} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export function uniqueScenarioId(existing: readonly Scenario[]): string {
  const taken = new Set(existing.map((s) => s.id));
  for (let n = 1; ; n++) {
    const id = `sc-${n}`;
    if (!taken.has(id)) return id;
  }
}

export function createBlankScenario(existing: readonly Scenario[], defaultName: string): Scenario {
  return {
    id: uniqueScenarioId(existing),
    name: uniqueScenarioName(defaultName, existing),
    initialContext: {},
    inputScript: [],
  };
}

export function duplicateScenarioName(name: string, existing: readonly Scenario[]): string {
  return uniqueScenarioName(`${name} copy`, existing);
}
