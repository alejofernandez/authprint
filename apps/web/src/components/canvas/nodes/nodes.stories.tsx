import type {
  ActionNode,
  DecisionNode,
  EntryNode,
  ExternalNode,
  OutcomeNode,
  ScreenNode,
} from '@authprint/dsl';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { NodeCanvas } from './__stories__/NodeCanvas.tsx';

// Visual-regression stories for the six structural-type node components. Each
// story is one node in one theme; the test runner screenshots every story and
// diffs it against a committed baseline (see `.storybook/test-runner.ts`).
const meta = {
  title: 'Canvas/Nodes',
  component: NodeCanvas,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof NodeCanvas>;

export default meta;

type Story = StoryObj<typeof meta>;

const entry: EntryNode = { type: 'entry', id: 'entry' };

const screen: ScreenNode = {
  type: 'screen',
  id: 'collect-email',
  name: 'Enter your email',
  kind: 'identifier-collect',
  traits: [],
  fields: [],
  fidelity: 'lo-fi',
};

const decision: DecisionNode = {
  type: 'decision',
  id: 'user-exists',
  name: 'Account exists?',
  kind: 'user-exists',
  predicate: { slot: 'user.exists', op: 'equals', value: true },
};

const action: ActionNode = {
  type: 'action',
  id: 'send-otp',
  name: 'Send sign-in code',
  kind: 'send-otp',
};

const external: ExternalNode = {
  type: 'external',
  id: 'google',
  name: 'Continue with Google',
  kind: 'google',
};

const outcome: OutcomeNode = {
  type: 'outcome',
  id: 'authenticated',
  name: 'Authenticated',
  kind: 'authenticated',
};

export const EntryLight: Story = { args: { type: 'entry', node: entry, theme: 'light' } };
export const EntryDark: Story = { args: { type: 'entry', node: entry, theme: 'dark' } };

export const ScreenLight: Story = { args: { type: 'screen', node: screen, theme: 'light' } };
export const ScreenDark: Story = { args: { type: 'screen', node: screen, theme: 'dark' } };

export const DecisionLight: Story = { args: { type: 'decision', node: decision, theme: 'light' } };
export const DecisionDark: Story = { args: { type: 'decision', node: decision, theme: 'dark' } };

export const ActionLight: Story = { args: { type: 'action', node: action, theme: 'light' } };
export const ActionDark: Story = { args: { type: 'action', node: action, theme: 'dark' } };

export const ExternalLight: Story = { args: { type: 'external', node: external, theme: 'light' } };
export const ExternalDark: Story = { args: { type: 'external', node: external, theme: 'dark' } };

export const OutcomeLight: Story = { args: { type: 'outcome', node: outcome, theme: 'light' } };
export const OutcomeDark: Story = { args: { type: 'outcome', node: outcome, theme: 'dark' } };
