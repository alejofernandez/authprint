import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  stepAction,
  stepDecision,
  stepEntry,
  stepOutcomeSuccess,
  stepScreenMockup,
} from '../playerFixtures.ts';
import type { PlayerStep } from '../steps.ts';
import { GhostHeadClip, TimelineClip } from '../TimelineClip.tsx';
import { PlayerStoryIntl } from './PlayerStoryIntl.tsx';

type ClipStoryArgs = {
  theme?: 'light' | 'dark';
  step: PlayerStep;
  active?: boolean;
  diverged?: boolean;
  onSeek?: () => void;
  onRevealOnCanvas?: () => void;
  revealLabel?: string;
  mode?: 'view' | 'edit';
  scripted?: boolean;
  hasSetPatch?: boolean;
  onEdit?: () => void;
};

const meta = {
  title: 'Canvas/Player/TimelineClip',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PlayerStoryIntl>
        <Story />
      </PlayerStoryIntl>
    ),
  ],
  render: ({ theme = 'light', ...clipProps }: ClipStoryArgs) => (
    <div
      data-testid="player-canvas"
      className={`${theme === 'dark' ? 'dark ' : ''}bg-bg-canvas p-6`}
      style={{ width: 160, height: 120 }}
    >
      <TimelineClip {...(clipProps as React.ComponentProps<typeof TimelineClip>)} />
    </div>
  ),
} satisfies Meta<ClipStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EntryLight: Story = {
  args: { theme: 'light', step: stepEntry, active: false },
};
export const ScreenLight: Story = {
  args: { theme: 'light', step: stepScreenMockup, active: false },
};
export const DecisionLight: Story = {
  args: { theme: 'light', step: stepDecision, active: false },
};
export const ActionLight: Story = {
  args: { theme: 'light', step: stepAction, active: false },
};
export const OutcomeLight: Story = {
  args: { theme: 'light', step: stepOutcomeSuccess, active: false },
};
export const ActiveLight: Story = {
  args: { theme: 'light', step: stepScreenMockup, active: true },
};
export const DivergedLight: Story = {
  args: { theme: 'light', step: stepDecision, diverged: true },
};
export const ActiveDark: Story = {
  args: { theme: 'dark', step: stepScreenMockup, active: true },
};

export const EditableScreenLight: Story = {
  args: {
    theme: 'light',
    step: stepScreenMockup,
    mode: 'edit',
    scripted: true,
    hasSetPatch: false,
  },
};

export const EditableScreenWithSetLight: Story = {
  args: {
    theme: 'light',
    step: stepScreenMockup,
    mode: 'edit',
    scripted: true,
    hasSetPatch: true,
  },
};

export const EditableActionDark: Story = {
  args: {
    theme: 'dark',
    step: stepAction,
    mode: 'edit',
    scripted: true,
    hasSetPatch: false,
  },
};

export const EditableDerivedDecisionLight: Story = {
  args: {
    theme: 'light',
    step: stepDecision,
    mode: 'edit',
    scripted: false,
  },
};

type GhostArgs = React.ComponentProps<typeof GhostHeadClip> & { theme?: 'light' | 'dark' };

export const GhostHeadLight: StoryObj<GhostArgs> = {
  render: ({ theme = 'light', ...props }) => (
    <PlayerStoryIntl>
      <div
        data-testid="player-canvas"
        className={`${theme === 'dark' ? 'dark ' : ''}bg-bg-canvas p-6`}
        style={{ width: 160, height: 120 }}
      >
        <GhostHeadClip {...props} />
      </div>
    </PlayerStoryIntl>
  ),
  args: {
    theme: 'light',
    nextDisplayName: 'Enter code',
  },
};

export const GhostHeadDark: StoryObj<GhostArgs> = {
  ...GhostHeadLight,
  args: {
    theme: 'dark',
    nextDisplayName: 'Enter code',
  },
};
