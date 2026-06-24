import { describe, expect, test } from 'bun:test';
import {
  PLUS_AFFORDANCE_GAP,
  placeFloatingPanel,
  placeFloatingPanelAtPoint,
  placeFloatingPanelBelow,
} from './floatingPanelPlacement.ts';

const viewport = { width: 1000, height: 800 };
const panel = { width: 288, height: 400 };
const smallPanel = { width: 160, height: 220 };

describe('placeFloatingPanel', () => {
  test('prefers right of anchor with ⅛-width offset, vertically centered', () => {
    const anchor = { left: 100, top: 200, right: 320, bottom: 284 };
    const { left, top } = placeFloatingPanel(anchor, panel, { viewport });
    expect(left).toBe(320 + (320 - 100) / 8);
    expect(top).toBe((200 + 284) / 2 - 400 / 2);
  });

  test('flips left when right side does not fit', () => {
    const anchor = { left: 700, top: 200, right: 920, bottom: 284 };
    const { left } = placeFloatingPanel(anchor, panel, { viewport });
    expect(left).toBe(700 - 288 - (920 - 700) / 8);
  });

  test('clamps vertical position inside the viewport', () => {
    const anchor = { left: 100, top: 10, right: 320, bottom: 94 };
    const { top } = placeFloatingPanel(anchor, panel, { viewport });
    expect(top).toBe(12);
  });
});

describe('placeFloatingPanelBelow', () => {
  test('centers below anchor with ⅛-height offset', () => {
    const anchor = { left: 100, top: 200, right: 320, bottom: 284 };
    const { left, top } = placeFloatingPanelBelow(anchor, smallPanel, { viewport });
    expect(top).toBe(284 + (284 - 200) / 8);
    expect(left).toBe((100 + 320) / 2 - 160 / 2);
  });

  test('adds affordance gap when picker must clear the + button', () => {
    const anchor = { left: 100, top: 200, right: 320, bottom: 284 };
    const { top } = placeFloatingPanelBelow(anchor, smallPanel, {
      viewport,
      affordanceGap: PLUS_AFFORDANCE_GAP,
    });
    expect(top).toBe(284 + (284 - 200) / 8 + PLUS_AFFORDANCE_GAP);
  });
});

describe('placeFloatingPanel affordance gap', () => {
  test('offsets further right for node-type picker', () => {
    const anchor = { left: 100, top: 200, right: 320, bottom: 284 };
    const { left } = placeFloatingPanel(anchor, panel, {
      viewport,
      affordanceGap: PLUS_AFFORDANCE_GAP,
    });
    expect(left).toBe(320 + (320 - 100) / 8 + PLUS_AFFORDANCE_GAP);
  });
});

describe('placeFloatingPanelAtPoint', () => {
  test('clamps point inside the viewport', () => {
    const { left, top } = placeFloatingPanelAtPoint({ x: 990, y: 790 }, smallPanel, { viewport });
    expect(left).toBe(1000 - 12 - 160);
    expect(top).toBe(800 - 12 - 220);
  });
});
