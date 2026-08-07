import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PlayerStage, type PlayerStageProps } from '../PlayerStage.tsx';
import {
  fixtureAction,
  fixtureActionVerify,
  fixtureActionWithNotes,
  fixtureDecision,
  fixtureEntry,
  fixtureExternal,
  fixtureOutcomeError,
  fixtureOutcomeSuccess,
  fixturePendingDecision,
  fixtureRecordFlow,
  fixtureScreenMfa,
  fixtureScreenMockup,
  fixtureScreenMockupWithErrorBanner,
  fixtureScreenPasskeyEnroll,
  stepAction,
  stepActionVerify,
  stepActionWithNotes,
  stepDecision,
  stepEntry,
  stepOutcomeError,
  stepOutcomeSuccess,
  stepScreenMfa,
  stepScreenMockup,
  stepScreenMockupError,
  stepScreenPasskeySkip,
} from '../playerFixtures.ts';
import type { PendingDecision } from '../recorder.ts';
import { PlayerStoryIntl } from './PlayerStoryIntl.tsx';

type PlayerStageStoryArgs = {
  theme?: 'light' | 'dark';
  width?: number;
  height?: number;
  editorTheme?: 'light' | 'dark';
  step?: React.ComponentProps<typeof PlayerStage>['step'];
  node?: React.ComponentProps<typeof PlayerStage>['node'];
  branding?: React.ComponentProps<typeof PlayerStage>['branding'];
  flowTheme?: React.ComponentProps<typeof PlayerStage>['flowTheme'];
  mode?: 'view' | 'record';
  flow?: typeof fixtureRecordFlow;
  headNode?: React.ComponentProps<typeof PlayerStage>['node'];
  contextAtHead?: Record<string, unknown>;
  pendingDecision?: PendingDecision | null;
  previousStepName?: string | null;
  expectOutcomeChecked?: boolean;
  isDiverged?: boolean;
  divergence?: React.ComponentProps<typeof PlayerStage>['divergence'];
  backdropStep?: React.ComponentProps<typeof PlayerStage>['backdropStep'];
  backdropNode?: React.ComponentProps<typeof PlayerStage>['backdropNode'];
};

const meta = {
  title: 'Canvas/Player/PlayerStage',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PlayerStoryIntl>
        <Story />
      </PlayerStoryIntl>
    ),
  ],
  render: ({ theme = 'light', width = 480, height = 360, editorTheme, step, node, ...rest }) => {
    if (!step || !node) return <div hidden />;
    return (
      <div
        data-testid="player-canvas"
        className={`${theme === 'dark' ? 'dark ' : ''}bg-bg-canvas p-4`}
        style={{ width, height }}
      >
        <PlayerStage
          {...({
            editorTheme: editorTheme ?? theme,
            step,
            node,
            ...rest,
          } as PlayerStageProps)}
        />
      </div>
    );
  },
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

export const ScreenMockupSkipLight: Story = {
  args: {
    theme: 'light',
    step: stepScreenPasskeySkip,
    node: fixtureScreenPasskeyEnroll,
    branding,
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

export const InterstitialActionWithNotesLight: Story = {
  args: {
    theme: 'light',
    // Wide enough to hold a centred card plus the note beside it. The real
    // stage is the full viewport (measured 1440px); a 520px frame clipped the
    // note and made the baseline assert a crop rather than the design.
    width: 900,
    height: 360,
    step: stepActionWithNotes,
    node: fixtureActionWithNotes,
  },
};

export const InterstitialActionWithNotesDark: Story = {
  args: {
    theme: 'dark',
    width: 900,
    height: 360,
    step: stepActionWithNotes,
    node: fixtureActionWithNotes,
  },
};

export const InterstitialActionWithBackdropLight: Story = {
  args: {
    theme: 'light',
    height: 420,
    step: stepActionVerify,
    node: fixtureActionVerify,
    branding,
    flowTheme: 'light',
    backdropStep: stepScreenMfa,
    backdropNode: fixtureScreenMfa,
  },
};

// `flow` is what makes this story a real guard: the backdrop derives its action
// links from it (US-126), and without a flow the baseline would happily accept a
// backdrop that has silently dropped them and shrunk. That is the regression this
// story now covers.
export const InterstitialDecisionWithBackdropLight: Story = {
  args: {
    theme: 'light',
    height: 420,
    step: stepDecision,
    node: fixtureDecision,
    backdropStep: stepScreenMockup,
    backdropNode: fixtureScreenMockup,
    flow: fixtureRecordFlow,
    branding,
    flowTheme: 'light',
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

export const RecordScreenLight: Story = {
  args: {
    theme: 'light',
    height: 420,
    mode: 'record',
    step: stepScreenMockup,
    node: fixtureScreenMockup,
    flow: fixtureRecordFlow,
    headNode: fixtureScreenMockup,
    contextAtHead: { 'user.exists': false },
    branding,
    flowTheme: 'light',
  },
};

export const RecordScreenDark: Story = {
  args: {
    theme: 'dark',
    height: 420,
    mode: 'record',
    step: stepScreenMockup,
    node: fixtureScreenMockup,
    flow: fixtureRecordFlow,
    headNode: fixtureScreenMockup,
    contextAtHead: { 'user.exists': false },
    branding,
    flowTheme: 'dark',
  },
};

export const RecordActionLight: Story = {
  args: {
    theme: 'light',
    mode: 'record',
    step: stepScreenMockup,
    node: fixtureAction,
    flow: fixtureRecordFlow,
    headNode: fixtureAction,
    contextAtHead: {},
  },
};

export const RecordExternalDark: Story = {
  args: {
    theme: 'dark',
    mode: 'record',
    step: stepScreenMockup,
    node: fixtureExternal,
    flow: fixtureRecordFlow,
    headNode: fixtureExternal,
    contextAtHead: {},
  },
};

export const RecordDecisionLight: Story = {
  args: {
    theme: 'light',
    height: 440,
    mode: 'record',
    step: stepScreenMockup,
    node: fixtureScreenMockup,
    flow: fixtureRecordFlow,
    headNode: fixtureScreenMockup,
    contextAtHead: { 'user.exists': false },
    pendingDecision: fixturePendingDecision,
    previousStepName: 'Sign in',
  },
};

export const RecordDecisionNeedsValueDark: Story = {
  args: {
    theme: 'dark',
    height: 460,
    mode: 'record',
    step: stepScreenMockup,
    node: fixtureScreenMockup,
    flow: fixtureRecordFlow,
    headNode: fixtureScreenMockup,
    contextAtHead: {},
    pendingDecision: {
      nodeId: 'd1',
      question: 'score greater-than 10?',
      predicate: { slot: 'score', op: 'greater-than', value: 10 },
      dictated: false,
      takenBranch: false,
      takenDestinationId: 'o1',
      otherBranch: true,
      otherDestinationId: 'a1',
      fixes: [{ kind: 'needs-value', slot: 'score', op: 'greater-than' }],
    } satisfies PendingDecision,
  },
};

export const RecordOutcomeLight: Story = {
  args: {
    theme: 'light',
    mode: 'record',
    step: stepOutcomeSuccess,
    node: fixtureOutcomeSuccess,
    flow: fixtureRecordFlow,
    headNode: fixtureOutcomeSuccess,
    contextAtHead: {},
    expectOutcomeChecked: true,
  },
};

export const RecordOutcomeDark: Story = {
  args: {
    theme: 'dark',
    mode: 'record',
    step: stepOutcomeSuccess,
    node: fixtureOutcomeSuccess,
    flow: fixtureRecordFlow,
    headNode: fixtureOutcomeSuccess,
    contextAtHead: {},
    expectOutcomeChecked: false,
  },
};
