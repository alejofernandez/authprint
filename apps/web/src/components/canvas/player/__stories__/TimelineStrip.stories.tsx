import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect, useRef } from 'react';
import { buildLongStripSteps } from '../playerFixtures.ts';
import { TimelineStrip } from '../TimelineStrip.tsx';

type StripStoryArgs = React.ComponentProps<typeof TimelineStrip> & {
  theme?: 'light' | 'dark';
  width?: number;
  /** Pin horizontal scroll for deterministic baselines (px). */
  pinnedScrollLeft?: number;
};

function TimelineStripCanvas({
  theme = 'light',
  width = 720,
  pinnedScrollLeft,
  ...stripProps
}: StripStoryArgs) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pinnedScrollLeft === undefined) return;
    const scroller = rootRef.current?.querySelector('[data-timeline-scroller]');
    if (scroller instanceof HTMLElement) {
      scroller.scrollLeft = pinnedScrollLeft;
    }
  }, [pinnedScrollLeft]);

  return (
    <div
      ref={rootRef}
      data-testid="player-canvas"
      className={`${theme === 'dark' ? 'dark ' : ''}bg-bg-canvas p-4`}
      style={{ width, height: 160 }}
    >
      <TimelineStrip {...stripProps} />
    </div>
  );
}

const meta = {
  title: 'Canvas/Player/TimelineStrip',
  component: TimelineStrip,
  parameters: { layout: 'fullscreen' },
  render: (args: StripStoryArgs) => <TimelineStripCanvas {...args} />,
} satisfies Meta<StripStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StripLight: Story = {
  args: {
    theme: 'light',
    steps: buildLongStripSteps(8),
    activeIndex: 2,
    divergedIndex: null,
    autoScroll: false,
  },
};

export const StripScrollLight: Story = {
  args: {
    theme: 'light',
    width: 420,
    steps: buildLongStripSteps(15),
    activeIndex: 12,
    divergedIndex: null,
    autoScroll: false,
    pinnedScrollLeft: 780,
  },
};

export const StripDivergedDark: Story = {
  args: {
    theme: 'dark',
    steps: buildLongStripSteps(8),
    activeIndex: 4,
    divergedIndex: 4,
    autoScroll: false,
  },
};
