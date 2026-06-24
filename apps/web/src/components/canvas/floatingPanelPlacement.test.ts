import { describe, expect, test } from 'bun:test';
import { placeFloatingPanel } from './floatingPanelPlacement.ts';

const viewport = { width: 1000, height: 800 };
const panel = { width: 288, height: 400 };

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
