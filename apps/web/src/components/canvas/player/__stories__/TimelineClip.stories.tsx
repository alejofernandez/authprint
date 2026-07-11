import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  stepAction,
  stepDecision,
  stepEntry,
  stepOutcomeSuccess,
  stepScreenMockup,
} from '../playerFixtures.ts';
import { TimelineClip } from '../TimelineClip.tsx';

type ClipStoryArgs = React.ComponentProps<typeof TimelineClip> & {
  theme?: 'light' | 'dark';
};

const meta = {
  title: 'Canvas/Player/TimelineClip',
  component: TimelineClip,
  parameters: { layout: 'fullscreen' },
  render: ({ theme = 'light', ...clipProps }: ClipStoryArgs) => (
    <div
      data-testid="player-canvas"
      className={`${theme === 'dark' ? 'dark ' : ''}bg-bg-canvas p-6`}
      style={{ width: 160, height: 120 }}
    >
      <TimelineClip {...clipProps} />
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
