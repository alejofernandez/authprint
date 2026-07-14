import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useRef } from 'react';
import {
  stepAction,
  stepDecision,
  stepEntry,
  stepOutcomeSuccess,
  stepScreenMockup,
} from '../playerFixtures.ts';
import { StepEditorPopover } from '../StepEditorPopover.tsx';
import { PlayerStoryIntl } from './PlayerStoryIntl.tsx';

const demoContextSlots = {
  'user.exists': { type: 'boolean' as const },
  'user.has_passkey': { type: 'boolean' as const },
  tier: { type: 'enum' as const, values: ['free', 'pro'] },
};

type PopoverStoryArgs = {
  theme?: 'light' | 'dark';
  variant:
    | 'scripted-screen'
    | 'scripted-action'
    | 'derived-decision'
    | 'derived-entry'
    | 'derived-outcome';
};

function PopoverCanvas({ theme = 'light', variant }: PopoverStoryArgs) {
  const anchorRef = useRef<HTMLDivElement>(null);

  const anchor = { left: 48, top: 48, right: 168, bottom: 132 };

  const common = {
    anchor,
    contextSlots: demoContextSlots,
    onClose: () => {},
    onActionChange: () => {},
    onResultChange: () => {},
    onSetPatchChange: () => {},
    onDeleteFromHere: () => {},
  };

  let popover: React.ReactNode;
  switch (variant) {
    case 'scripted-screen':
      popover = (
        <StepEditorPopover
          {...common}
          variant="scripted"
          editable={{
            kind: 'screen',
            scriptStepIndex: 0,
            displayName: stepScreenMockup.displayName,
            step: {
              type: 'screen',
              nodeId: 's-mock',
              action: 'submit',
              set: { 'user.exists': true },
            },
            legalActions: ['submit', 'back', 'forgot-password'],
          }}
        />
      );
      break;
    case 'scripted-action':
      popover = (
        <StepEditorPopover
          {...common}
          variant="scripted"
          editable={{
            kind: 'action',
            scriptStepIndex: 1,
            displayName: stepAction.displayName,
            step: { type: 'action', nodeId: 'a1', result: 'success' },
            legalResults: ['success', 'error'],
          }}
        />
      );
      break;
    case 'derived-decision':
      popover = <StepEditorPopover {...common} variant="derived" step={stepDecision} />;
      break;
    case 'derived-entry':
      popover = <StepEditorPopover {...common} variant="derived" step={stepEntry} />;
      break;
    case 'derived-outcome':
      popover = <StepEditorPopover {...common} variant="derived" step={stepOutcomeSuccess} />;
      break;
  }

  return (
    <div
      data-testid="player-canvas"
      className={`${theme === 'dark' ? 'dark ' : ''}relative bg-bg-canvas p-6`}
      style={{ width: 360, height: 420 }}
    >
      <div
        ref={anchorRef}
        className="absolute left-12 top-12 flex h-[84px] w-[120px] items-center justify-center rounded-lg border border-border-default bg-bg-panel text-xs text-fg-subtle"
      >
        clip anchor
      </div>
      {popover}
    </div>
  );
}

const meta = {
  title: 'Canvas/Player/StepEditorPopover',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PlayerStoryIntl>
        <Story />
      </PlayerStoryIntl>
    ),
  ],
  render: (args: PopoverStoryArgs) => <PopoverCanvas {...args} />,
} satisfies Meta<PopoverStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ScriptedScreenLight: Story = {
  args: { theme: 'light', variant: 'scripted-screen' },
};

export const ScriptedScreenWithSetDark: Story = {
  args: { theme: 'dark', variant: 'scripted-screen' },
};

export const ScriptedActionLight: Story = {
  args: { theme: 'light', variant: 'scripted-action' },
};

export const DerivedDecisionLight: Story = {
  args: { theme: 'light', variant: 'derived-decision' },
};

export const DerivedEntryDark: Story = {
  args: { theme: 'dark', variant: 'derived-entry' },
};

export const DerivedOutcomeLight: Story = {
  args: { theme: 'light', variant: 'derived-outcome' },
};
