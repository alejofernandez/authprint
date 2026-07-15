import { describe, expect, test } from 'bun:test';
import type { Scenario } from '@authprint/dsl';
import { createBlankScenario, duplicateScenarioName, uniqueScenarioName } from './scenarioNames.ts';

const base: Scenario = {
  id: 'sc-1',
  name: 'Scenario',
  initialContext: {},
  inputScript: [],
};

describe('scenarioNames', () => {
  test('uniqueScenarioName appends a numeric suffix', () => {
    expect(uniqueScenarioName('Scenario', [base])).toBe('Scenario 2');
    expect(
      uniqueScenarioName('Scenario', [base, { ...base, id: 'sc-2', name: 'Scenario 2' }]),
    ).toBe('Scenario 3');
  });

  test('duplicateScenarioName prefers "copy"', () => {
    expect(duplicateScenarioName('Happy path', [base])).toBe('Happy path copy');
  });

  test('createBlankScenario allocates id + name', () => {
    const next = createBlankScenario([base], 'Scenario');
    expect(next.id).toBe('sc-2');
    expect(next.name).toBe('Scenario 2');
    expect(next.inputScript).toEqual([]);
  });
});
