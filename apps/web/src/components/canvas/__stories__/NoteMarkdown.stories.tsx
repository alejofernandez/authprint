import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { NoteMarkdown } from '../NoteMarkdown.tsx';

const SAMPLE = `## Retry policy

Call the token endpoint with:

- \`grant_type=refresh_token\`
- exponential backoff, max 3

\`\`\`
Authorization: Bearer <token>
Content-Type: application/json
\`\`\`

**Do not** log the refresh token.
`;

function Frame({ theme, children }: { theme: 'light' | 'dark'; children: React.ReactNode }) {
  return (
    <div
      data-testid="node-canvas"
      className={`${theme === 'dark' ? 'dark ' : ''}bg-bg-canvas p-6`}
      style={{ width: 360, minHeight: 280 }}
    >
      <div className="max-w-sm rounded border border-border-default bg-bg-panel p-3">
        {children}
      </div>
    </div>
  );
}

const meta = {
  title: 'Canvas/NoteMarkdown',
  component: NoteMarkdown,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof NoteMarkdown>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Light: Story = {
  args: { children: SAMPLE },
  decorators: [
    (Story) => (
      <Frame theme="light">
        <Story />
      </Frame>
    ),
  ],
};

export const Dark: Story = {
  args: { children: SAMPLE },
  decorators: [
    (Story) => (
      <Frame theme="dark">
        <Story />
      </Frame>
    ),
  ],
};
