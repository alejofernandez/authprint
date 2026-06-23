import type { Preview } from '@storybook/nextjs-vite';

// The node components are styled entirely with the app's Tailwind layer, so the
// real `globals.css` (which defines the `dark` custom-variant + theme tokens)
// must load for stories to render the way they do in the editor. React Flow's
// stylesheet positions the node/handles.
import '@xyflow/react/dist/style.css';
import '../src/app/globals.css';

// Freeze anything time-based so screenshot baselines stay byte-stable across
// runs (no half-finished transitions captured mid-animation).
import './visual-stability.css';

const preview: Preview = {
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
