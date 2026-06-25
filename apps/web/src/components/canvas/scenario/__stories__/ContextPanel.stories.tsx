import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ContextPanel } from '../ContextPanel.tsx';

type ContextPanelStoryArgs = React.ComponentProps<typeof ContextPanel> & {
  theme?: 'light' | 'dark';
};

const meta = {
  title: 'Canvas/Scenario/ContextPanel',
  component: ContextPanel,
  parameters: { layout: 'fullscreen' },
  render: ({ theme = 'light', ...panelProps }) => (
    <div
      data-testid="context-panel-canvas"
      className={`relative h-72 w-96 ${theme === 'dark' ? 'dark ' : ''}bg-zinc-50 dark:bg-zinc-950`}
    >
      <ContextPanel {...panelProps} />
    </div>
  ),
} satisfies Meta<ContextPanelStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

const demoContext = {
  'user.exists': true,
  'user.emailVerified': false,
  'user.mfaEnrolled': true,
};

export const Light: Story = {
  args: {
    theme: 'light',
    initialContext: demoContext,
    divergence: null,
  },
};

export const Dark: Story = {
  args: {
    theme: 'dark',
    initialContext: demoContext,
    divergence: null,
  },
};

export const FlaggedSlot: Story = {
  args: {
    theme: 'light',
    initialContext: demoContext,
    divergence: { kind: 'unknown-slot', nodeId: 'decision-1', slot: 'user.exists' },
  },
};
