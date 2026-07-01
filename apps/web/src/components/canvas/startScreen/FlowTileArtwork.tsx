import { FlowThumbnail } from './FlowThumbnail.tsx';

export type TileVisual = { kind: 'blank' } | { kind: 'open' } | { kind: 'flow'; source: string };

export function FlowTileArtwork({ visual }: { visual: TileVisual }) {
  switch (visual.kind) {
    case 'blank':
      return (
        <div className="flex h-full w-full items-center justify-center border border-border-subtle border-dashed bg-bg-canvas">
          <span className="font-light text-3xl text-fg-subtle">+</span>
        </div>
      );
    case 'open':
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 border border-border-subtle bg-bg-canvas">
          <div className="h-8 w-10 border-2 border-accent-primary-border border-t-4" />
          <div className="h-0.5 w-8 bg-border-default" />
        </div>
      );
    case 'flow':
      return <FlowThumbnail source={visual.source} />;
  }
}
