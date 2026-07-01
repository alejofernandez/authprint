import type { Preview } from '@storybook/nextjs-vite';
import { Geist, Geist_Mono } from 'next/font/google';
import { useLayoutEffect } from 'react';

// The node components are styled entirely with the app's Tailwind layer, so the
// real `globals.css` (which defines the `dark` custom-variant + theme tokens)
// must load for stories to render the way they do in the editor. React Flow's
// stylesheet positions the node/handles.
import '@xyflow/react/dist/style.css';
import '../src/app/globals.css';

// Mirror layout.tsx font wiring so body { font-family: var(--font-sans) } resolves
// to Geist in Storybook, not the ui-sans-serif fallback.
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Freeze anything time-based so screenshot baselines stay byte-stable across
// runs (no half-finished transitions captured mid-animation).
import './visual-stability.css';

const preview: Preview = {
  decorators: [
    (Story) => {
      useLayoutEffect(() => {
        document.documentElement.classList.add(geistSans.variable, geistMono.variable);
      }, []);
      return <Story />;
    },
  ],
  parameters: {
    layout: 'fullscreen',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo',
    },
  },
};

export default preview;
