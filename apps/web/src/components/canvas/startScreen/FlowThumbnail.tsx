import { useMemo } from 'react';
import { flowFromSource } from '../flowFromSource.ts';
import type { ThumbnailNode } from './flowThumbnailLayout.ts';
import { edgeLine, layoutFlowThumbnail } from './flowThumbnailLayout.ts';

const nodeFill: Record<ThumbnailNode['type'], string> = {
  entry: 'var(--node-entry-bg)',
  screen: 'var(--bg-subtle)',
  decision: 'var(--node-decision-bg)',
  action: 'var(--accent-primary-bg)',
  external: 'var(--bg-subtle)',
  outcome: 'var(--node-outcome-bg)',
};

const nodeStroke: Record<ThumbnailNode['type'], string> = {
  entry: 'var(--node-entry-border)',
  screen: 'var(--border-default)',
  decision: 'var(--node-decision-border)',
  action: 'var(--accent-primary-border-muted)',
  external: 'var(--border-default)',
  outcome: 'var(--node-outcome-border)',
};

function ThumbnailNodeShape({ node }: { node: ThumbnailNode }) {
  const fill = nodeFill[node.type];
  const stroke = nodeStroke[node.type];

  if (node.shape === 'circle') {
    const r = node.w / 2;
    return (
      <circle cx={node.x + r} cy={node.y + r} r={r} fill={fill} stroke={stroke} strokeWidth={1.5} />
    );
  }

  if (node.shape === 'pill') {
    const radius = node.h / 2;
    return (
      <rect
        x={node.x}
        y={node.y}
        width={node.w}
        height={node.h}
        rx={radius}
        ry={radius}
        fill={fill}
        stroke={stroke}
        strokeWidth={1}
      />
    );
  }

  if (node.shape === 'screen') {
    const radius = node.w * 0.18;
    const chromeH = node.h * 0.14;
    const dotR = Math.max(node.w * 0.05, 0.3);
    const dotY = node.y + chromeH / 2;
    const dotGap = dotR * 2.4;
    const dotStartX = node.x + node.w / 2 - dotGap;
    const bodyX = node.x + node.w * 0.14;
    const bodyY = node.y + chromeH + node.h * 0.1;
    const bodyW = node.w * 0.72;
    const bodyH = node.h - chromeH - node.h * 0.16;
    const bodyRadius = node.w * 0.06;

    return (
      <g>
        <rect
          x={node.x}
          y={node.y}
          width={node.w}
          height={node.h}
          rx={radius}
          ry={radius}
          fill="var(--bg-panel)"
          stroke={stroke}
          strokeWidth={1}
        />
        <line
          x1={node.x}
          y1={node.y + chromeH}
          x2={node.x + node.w}
          y2={node.y + chromeH}
          stroke="var(--border-subtle)"
          strokeWidth={0.75}
        />
        {[0, 1, 2].map((index) => (
          <circle
            key={index}
            cx={dotStartX + index * dotGap}
            cy={dotY}
            r={dotR}
            fill="var(--border-default)"
          />
        ))}
        <rect
          x={bodyX}
          y={bodyY}
          width={bodyW}
          height={bodyH}
          rx={bodyRadius}
          ry={bodyRadius}
          fill="var(--bg-subtle)"
        />
      </g>
    );
  }

  if (node.shape === 'diamond') {
    const cx = node.x + node.w / 2;
    const cy = node.y + node.h / 2;
    return (
      <polygon
        points={`${cx},${node.y} ${node.x + node.w},${cy} ${cx},${node.y + node.h} ${node.x},${cy}`}
        fill={fill}
        stroke={stroke}
        strokeWidth={1}
        strokeLinejoin="round"
      />
    );
  }

  return (
    <rect
      x={node.x}
      y={node.y}
      width={node.w}
      height={node.h}
      fill={fill}
      stroke={stroke}
      strokeWidth={1}
    />
  );
}

export function FlowThumbnail({ source }: { source: string }) {
  const layout = useMemo(() => {
    const { flow } = flowFromSource(source);
    if (!flow) return null;
    return layoutFlowThumbnail(flow);
  }, [source]);

  if (!layout || layout.nodes.length === 0) {
    return <div className="h-full w-full bg-bg-canvas" />;
  }

  return (
    <svg
      viewBox={layout.viewBox}
      className="h-full w-full bg-bg-canvas"
      preserveAspectRatio="xMidYMid meet"
      role="presentation"
    >
      {layout.edges.map((edge) => {
        const line = edgeLine(layout, edge);
        if (!line) return null;
        return (
          <line
            key={edge.id}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="var(--border-default)"
            strokeWidth={1}
          />
        );
      })}
      {layout.nodes.map((node) => (
        <ThumbnailNodeShape key={node.id} node={node} />
      ))}
    </svg>
  );
}
