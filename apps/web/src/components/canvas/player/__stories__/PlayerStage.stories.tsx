import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PlayerStage } from '../PlayerStage.tsx';
import {
  fixtureAction,
  fixtureDecision,
  fixtureEntry,
  fixtureOutcomeError,
  fixtureOutcomeSuccess,
  fixtureScreenLoFi,
  fixtureScreenMockup,
  fixtureScreenMockupWithErrorBanner,
  fixtureScreenWireframe,
  stepAction,
  stepDecision,
  stepEntry,
  stepOutcomeError,
  stepOutcomeSuccess,
  stepScreenMockup,
  stepScreenMockupError,
} from '../playerFixtures.ts';

type PlayerStageStoryArgs = React.ComponentProps<typeof PlayerStage> & {
  theme?: 'light' | 'dark';
  width?: number;
  height?: number;
};

const meta = {
  title: 'Canvas/Player/PlayerStage',
  component: PlayerStage,
  parameters: { layout: 'fullscreen' },
  render: ({ theme = 'light', width = 480, height = 360, editorTheme, ...stageProps }) => (
    <div
      data-testid="player-canvas"
      className={`${theme === 'dark' ? 'dark ' : ''}bg-bg-canvas p-4`}
      style={{ width, height }}
    >
      <PlayerStage editorTheme={editorTheme ?? theme} {...stageProps} />
    </div>
  ),
} satisfies Meta<PlayerStageStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

const branding = { theme: 'light' as const, companyName: 'Acme', primaryColor: '#4f46e5' };

export const ScreenMockupLight: Story = {
  args: {
    theme: 'light',
    step: stepScreenMockup,
    node: fixtureScreenMockup,
    branding,
    flowTheme: 'light',
  },
};

export const ScreenMockupDark: Story = {
  args: {
    theme: 'dark',
    step: stepScreenMockup,
    node: fixtureScreenMockup,
    branding,
    flowTheme: 'dark',
  },
};

export const ScreenMockupErrorLight: Story = {
  args: {
    theme: 'light',
    step: stepScreenMockupError,
    node: fixtureScreenMockupWithErrorBanner,
    branding,
    flowTheme: 'light',
  },
};

export const ScreenWireframeLight: Story = {
  args: {
    theme: 'light',
    step: stepScreenMockup,
    node: fixtureScreenWireframe,
    flowTheme: 'light',
  },
};

export const ScreenLoFiLight: Story = {
  args: {
    theme: 'light',
    height: 300,
    step: stepScreenMockup,
    node: fixtureScreenLoFi,
    flowTheme: 'light',
  },
};

export const InterstitialDecisionLight: Story = {
  args: {
    theme: 'light',
    step: stepDecision,
    node: fixtureDecision,
  },
};

export const InterstitialDecisionDark: Story = {
  args: {
    theme: 'dark',
    step: stepDecision,
    node: fixtureDecision,
  },
};

export const InterstitialActionLight: Story = {
  args: {
    theme: 'light',
    step: stepAction,
    node: fixtureAction,
  },
};

export const OutcomeSuccessLight: Story = {
  args: {
    theme: 'light',
    step: stepOutcomeSuccess,
    node: fixtureOutcomeSuccess,
  },
};

export const OutcomeSuccessDark: Story = {
  args: {
    theme: 'dark',
    step: stepOutcomeSuccess,
    node: fixtureOutcomeSuccess,
  },
};

export const OutcomeErrorLight: Story = {
  args: {
    theme: 'light',
    step: stepOutcomeError,
    node: fixtureOutcomeError,
  },
};

export const EntryLight: Story = {
  args: {
    theme: 'light',
    step: stepEntry,
    node: fixtureEntry,
  },
};

export const DivergenceLight: Story = {
  args: {
    theme: 'light',
    step: stepDecision,
    node: fixtureDecision,
    isDiverged: true,
    divergence: {
      kind: 'unexpected-outcome',
      nodeId: 'o1',
      expected: 'o-authenticated-enrolled',
      actual: 'o-authenticated-passkey',
    },
  },
};

export const DivergenceDark: Story = {
  args: {
    theme: 'dark',
    step: stepDecision,
    node: fixtureDecision,
    isDiverged: true,
    divergence: {
      kind: 'unexpected-outcome',
      nodeId: 'o1',
      expected: 'o-authenticated-enrolled',
      actual: 'o-authenticated-passkey',
    },
  },
};
