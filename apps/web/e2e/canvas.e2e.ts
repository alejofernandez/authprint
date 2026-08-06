import { expect, type Page, test } from '@playwright/test';

// E55's regression net. Every assertion here corresponds to a defect that was
// found by hand and fixed, or to a rule the epic committed to — the two kinds of
// thing that keep coming back because nothing was watching them.
//
// Why a real browser rather than a `dispatchEvent` probe: xyflow routes node
// drag through d3-drag, which ignores synthetic events entirely. A hand-rolled
// probe reports a pass on gestures the framework never saw. Two criteria below
// (press-and-hold, drag-does-not-open) are only meaningful with real input.

const TRIGGER_EDITOR = '[role="dialog"]:not([aria-labelledby="node-inspector-title"])';
const INSPECTOR = '[aria-labelledby="node-inspector-title"]';
const MENU = '[role="menu"]';

async function openSampleFlow(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Passwordless with OTP/ }).click();
  await page.waitForSelector('.react-flow__node');
  // Let the initial elk layout + fitView settle before measuring anything.
  await expect(page.locator('.react-flow__node')).toHaveCount(18);
  await page.waitForTimeout(800);
}

async function dismissOverlays(page: Page) {
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button[aria-label="Close"]')) {
      (b as HTMLButtonElement).click();
    }
  });
  await page.waitForTimeout(200);
}

test.describe('canvas context menu (US-133)', () => {
  test('right-click on empty canvas opens the menu at the pointer', async ({ page }) => {
    await openSampleFlow(page);
    // Well clear of the right edge: nearer to it, floatingPanelPlacement clamps
    // the panel inward, which is correct but would make this assertion about
    // clamping rather than about anchoring.
    await page.mouse.move(860, 220);
    await page.mouse.down({ button: 'right' });
    await page.mouse.up({ button: 'right' });

    const menu = page.locator(MENU);
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    expect(box?.x).toBeCloseTo(860, 0);
    expect(box?.y).toBeCloseTo(220, 0);
  });

  // The pane CONTAINS the viewport, so node events bubble into any native
  // listener bound to it. Tap-hold fired on nodes because of exactly this.
  test('tap-hold on a node opens nothing — the menu is about places', async ({ page }) => {
    await openSampleFlow(page);
    const node = page.locator('.react-flow__node-screen').first();
    const box = await node.boundingBox();
    if (!box) throw new Error('no node');

    await page.mouse.move(box.x + box.width / 2, box.y + 6);
    await page.mouse.down();
    await page.waitForTimeout(700); // past the 500ms long-press delay
    await page.mouse.up();

    await expect(page.locator(MENU)).toHaveCount(0);
  });

  test('menu items stay out of the tab order so Enter runs the active row', async ({ page }) => {
    await openSampleFlow(page);
    await page.mouse.move(860, 220);
    await page.mouse.down({ button: 'right' });
    await page.mouse.up({ button: 'right' });
    await expect(page.locator(MENU)).toBeVisible();

    for (const item of await page.locator('[role="menuitem"]').all()) {
      await expect(item).toHaveAttribute('tabindex', '-1');
    }
    // The dismiss layer is the shape that has shipped three times: a
    // full-viewport button announcing "Close menu" from the tab order.
    const dismiss = page.locator(`${MENU} ~ button, button.fixed.inset-0`).first();
    if ((await dismiss.count()) > 0) {
      await expect(dismiss).toHaveAttribute('aria-hidden', 'true');
    }

    await page.keyboard.press('ArrowDown');
    await expect(page.locator(MENU)).toHaveAttribute('aria-activedescendant', 'play');
  });

  test('Escape closes the menu', async ({ page }) => {
    await openSampleFlow(page);
    await page.mouse.move(860, 220);
    await page.mouse.down({ button: 'right' });
    await page.mouse.up({ button: 'right' });
    await expect(page.locator(MENU)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator(MENU)).toHaveCount(0);
  });

  // A node dropped on empty canvas raises BOTH connectivity errors. Softening
  // one of them left the other painting danger, which is the bug this guards.
  test('a freely placed node reads as unwired, not broken', async ({ page }) => {
    await openSampleFlow(page);
    await page.mouse.move(860, 220);
    await page.mouse.down({ button: 'right' });
    await page.mouse.up({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Add node' }).click();
    await page.getByRole('option', { name: 'Screen' }).click();
    await page.waitForTimeout(400);

    // Error outlines are opt-in; turn them on to read the cue. Selected by title
    // because the control carries no aria-label, so its accessible name is the
    // bare "👁" glyph — logged for US-135, not this suite's to fix.
    await page.getByTitle('Show validation outlines on the canvas').click();
    await page.waitForTimeout(300);

    const fresh = page.locator('.react-flow__node').last().locator('> *').first();
    const cls = await fresh.getAttribute('class');
    expect(cls).toContain('ring-border-default');
    expect(cls).not.toContain('signal-danger-ring');

    // Severity itself is untouched: Problems still reports both errors.
    await expect(page.getByRole('button', { name: /Problems/ })).toContainText('2');
  });
});

test.describe('single activation (US-134)', () => {
  test('press-and-hold on an unselected node only selects it', async ({ page }) => {
    await openSampleFlow(page);
    const node = page.locator('.react-flow__node-screen').first();
    const box = await node.boundingBox();
    if (!box) throw new Error('no node');

    await page.mouse.move(box.x + box.width / 2, box.y + 6);
    await page.mouse.down();
    await page.waitForTimeout(500); // a deliberate click, not a 2ms synthetic one
    await page.mouse.up();
    await page.waitForTimeout(300);

    await expect(node).toHaveClass(/selected/);
    await expect(page.locator(INSPECTOR)).toHaveCount(0);
  });

  test('clicking an already-selected node opens the inspector', async ({ page }) => {
    await openSampleFlow(page);
    const node = page.locator('.react-flow__node-screen').first();
    const box = await node.boundingBox();
    if (!box) throw new Error('no node');
    const x = box.x + box.width / 2;
    const y = box.y + 6;

    await page.mouse.click(x, y);
    await page.waitForTimeout(250);
    await page.mouse.click(x, y);
    await expect(page.locator(INSPECTOR)).toBeVisible();
  });

  test('dragging a selected node does not open the inspector', async ({ page }) => {
    await openSampleFlow(page);
    const node = page.locator('.react-flow__node-screen').first();
    const start = await node.boundingBox();
    if (!start) throw new Error('no node');

    await page.mouse.click(start.x + start.width / 2, start.y + 6);
    await dismissOverlays(page);

    await page.mouse.move(start.x + start.width / 2, start.y + 6);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(start.x + start.width / 2 + i * 8, start.y + 6 + i * 4);
    }
    await page.mouse.up();
    await page.waitForTimeout(300);

    const end = await node.boundingBox();
    expect(Math.abs((end?.x ?? 0) - start.x)).toBeGreaterThan(20);
    await expect(page.locator(INSPECTOR)).toHaveCount(0);
  });

  test('an edge label opens its trigger editor on click and on Enter, once', async ({ page }) => {
    await openSampleFlow(page);
    const label = page.locator('.react-flow__edgelabel-renderer button').first();

    await label.click({ force: true });
    await expect(page.locator(TRIGGER_EDITOR)).toBeVisible();
    await dismissOverlays(page);

    // The label is a native <button>, so Enter also fires a synthetic click.
    // preventDefault() in the keydown must swallow it or the editor opens twice.
    await page.evaluate(() => {
      (window as unknown as { __opens: number }).__opens = 0;
      new MutationObserver(() => {
        const d = document.querySelector(
          '[role="dialog"]:not([aria-labelledby="node-inspector-title"])',
        ) as (HTMLElement & { __counted?: boolean }) | null;
        if (d && !d.__counted) {
          d.__counted = true;
          (window as unknown as { __opens: number }).__opens++;
        }
      }).observe(document.body, { childList: true, subtree: true });
    });
    await label.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator(TRIGGER_EDITOR)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __opens: number }).__opens)).toBe(1);
  });

  test('the edge spine stays drag-only — a click there opens nothing', async ({ page }) => {
    await openSampleFlow(page);
    const spine = page.locator('.react-flow__edge path').first();
    await spine.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
    await expect(page.locator(TRIGGER_EDITOR)).toHaveCount(0);
  });
});

test.describe('input capability floor (§7)', () => {
  test('the compact transport expands on one click, and its control meets 24px', async ({
    page,
  }) => {
    await openSampleFlow(page);
    await page
      .getByRole('button', { name: /^Play / })
      .first()
      .click();
    await page.getByRole('button', { name: 'Collapse transport bar', exact: true }).click();

    const expand = page.getByRole('button', { name: 'Expand transport bar' });
    const box = await expand.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(24);
    expect(box?.height).toBeGreaterThanOrEqual(24);

    await expand.click();
    await expect(
      page.getByRole('button', { name: 'Collapse transport bar', exact: true }),
    ).toBeVisible();
  });

  // US-135 acceptance gate: every interactive target meets the §7 24×24 floor
  // (HandlePlus, edge labels, transport expand, topbar chrome).
  test('no interactive target is smaller than 24x24', async ({ page }) => {
    await openSampleFlow(page);
    // Use layout size (offset*), not getBoundingClientRect — fitView zooms the
    // viewport and would report transformed sizes under the floor.
    const undersized = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll('button, [role="button"], a[href]')) {
        const html = el as HTMLElement;
        const w = html.offsetWidth;
        const h = html.offsetHeight;
        if (w === 0 && h === 0) continue;
        if (w < 24 || h < 24) out.push(el.getAttribute('aria-label') ?? el.className);
      }
      return out;
    });
    expect(undersized).toEqual([]);
  });

  // US-135: NodeTypePicker (and peers) must not park a full-viewport focus stop
  // in the tab order — Escape is the keyboard dismiss path.
  test('no full-viewport dismiss layer sits in the tab order', async ({ page }) => {
    await openSampleFlow(page);
    // Open the picker so its dismiss layer is mounted.
    await page.getByRole('button', { name: 'Add connected node' }).first().click();
    await expect(page.getByRole('listbox', { name: 'Node type' })).toBeVisible();
    const offenders = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll('button, [tabindex]')) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const coversViewport = r.width >= innerWidth && r.height >= innerHeight;
        const focusable = (el as HTMLElement).tabIndex >= 0;
        if (cs.position === 'fixed' && coversViewport && focusable) {
          out.push(el.getAttribute('aria-label') ?? el.className);
        }
      }
      return out;
    });
    expect(offenders).toEqual([]);
    await page.keyboard.press('Escape');
  });

  // US-135: the `+` must be visible when it has keyboard focus (§7).
  test('the handle plus is visible when focused', async ({ page }) => {
    await openSampleFlow(page);
    const plus = page.getByRole('button', { name: 'Add connected node' }).first();
    await plus.evaluate((el) => {
      (el as HTMLElement).focus();
    });
    await expect.poll(async () => plus.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  });
});

test.describe('connect two existing nodes (US-137)', () => {
  // Places a fresh screen on empty canvas and returns its `+`. A new node has
  // every trigger free, so the connect path runs straight through instead of
  // detouring to US-125's action picker — which is correct behaviour on a
  // source whose interaction is taken, and is covered by its own test below.
  async function freshNodePlus(page: Page) {
    await openSampleFlow(page);
    await page.mouse.move(860, 220);
    await page.mouse.down({ button: 'right' });
    await page.mouse.up({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Add node' }).click();
    await page.getByRole('option', { name: 'Screen' }).click();
    await page.waitForTimeout(400);
    return page
      .locator('.react-flow__node')
      .last()
      .getByRole('button', { name: 'Add connected node' })
      .first();
  }

  test('a keyboard-only path connects two existing nodes', async ({ page }) => {
    const plus = await freshNodePlus(page);
    const edgesBefore = await page.locator('.react-flow__edge').count();

    // No pointer past this line. Enter on the `+` opens the type picker — which
    // only works because CanvasNodeRoot no longer swallows keydowns from the
    // controls nested inside a node.
    await plus.evaluate((el) => (el as HTMLElement).focus());
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox', { name: 'Node type' })).toBeVisible();

    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('option', { name: /Connect to existing/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('Enter');
    await expect(page.getByText('Pick a target node')).toBeVisible();

    // Entering the mode parks focus on the first candidate; Tab walks only
    // candidates from there, so Enter here lands on a legal target.
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return {
        isNode: !!el?.closest('.react-flow__node'),
        disabled: el?.getAttribute('aria-disabled'),
      };
    });
    expect(focused.isNode).toBe(true);
    expect(focused.disabled).toBeNull();

    await page.keyboard.press('Enter');
    await expect(page.getByText('Pick a target node')).toHaveCount(0);
    await expect(page.locator('.react-flow__edge')).toHaveCount(edgesBefore + 1);

    await page.keyboard.press('Control+z');
    await expect(page.locator('.react-flow__edge')).toHaveCount(edgesBefore);
  });

  test('an invalid target cannot be picked, not merely styled as such', async ({ page }) => {
    const plus = await freshNodePlus(page);
    await plus.click({ force: true });
    await page.getByRole('option', { name: /Connect to existing/ }).click();
    await expect(page.getByText('Pick a target node')).toBeVisible();
    const edgesBefore = await page.locator('.react-flow__edge').count();

    // The source handle stays anchored while the mode runs, so the edge being
    // drawn keeps a visible origin rather than starting from nowhere.
    await expect.poll(async () => plus.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');

    // Entry is never a legal target, so it must be unfocusable and inert —
    // dimming alone would only look like a restriction.
    const entry = page.locator('.react-flow__node-entry').first();
    await expect(entry.locator('[aria-disabled="true"]')).toHaveCount(1);
    expect(
      await entry
        .locator('[role="button"]')
        .first()
        .evaluate((el) => (el as HTMLElement).tabIndex),
    ).toBe(-1);

    await entry.click({ force: true });
    await page.waitForTimeout(300);
    await expect(page.locator('.react-flow__edge')).toHaveCount(edgesBefore);
    // A rejected click is not a silent exit from the mode.
    await expect(page.getByText('Pick a target node')).toBeVisible();
  });

  test('Escape leaves target-pick mode with no edge', async ({ page }) => {
    const plus = await freshNodePlus(page);
    await plus.click({ force: true });
    await page.getByRole('option', { name: /Connect to existing/ }).click();
    await expect(page.getByText('Pick a target node')).toBeVisible();
    const edgesBefore = await page.locator('.react-flow__edge').count();

    await page.keyboard.press('Escape');
    await expect(page.getByText('Pick a target node')).toHaveCount(0);
    await expect(page.locator('.react-flow__edge')).toHaveCount(edgesBefore);
  });

  // Drag-to-connect and target-pick share one rule, so a source whose resolved
  // interaction is already used defers to the action picker on both paths.
  test('a taken interaction defers to the action picker, as the drag path does', async ({
    page,
  }) => {
    await openSampleFlow(page);
    const plus = page.getByRole('button', { name: 'Add connected node' }).first();
    await plus.click({ force: true });
    await page.getByRole('option', { name: /Connect to existing/ }).click();
    await expect(page.getByText('Pick a target node')).toBeVisible();

    const candidate = page.locator('.react-flow__node [role="button"][tabindex="0"]').first();
    await candidate.click({ force: true });
    await page.waitForTimeout(400);
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});

test.describe('Enter commits (UF-039)', () => {
  test('a custom action name commits and closes on Enter', async ({ page }) => {
    await openSampleFlow(page);

    const label = page
      .locator('.react-flow__edgelabel-renderer button')
      .filter({ hasText: /^submit$/ })
      .first();
    await expect(label).toBeVisible();
    await label.click({ force: true });
    await expect(page.locator(TRIGGER_EDITOR)).toBeVisible();

    // Switch the picker to its custom text field.
    const select = page.locator(`${TRIGGER_EDITOR} select`).first();
    await select.selectOption('__custom__');
    const custom = page.locator(`${TRIGGER_EDITOR} input`).first();
    await expect(custom).toBeVisible();

    await custom.fill('use-magic-link');
    await custom.press('Enter');

    // Enter both commits and dismisses: the panel goes, the label is the new
    // action. Before UF-039 it did neither.
    await expect(page.locator(TRIGGER_EDITOR)).toHaveCount(0);
    await expect(
      page
        .locator('.react-flow__edgelabel-renderer button')
        .filter({ hasText: /^use-magic-link$/ })
        .first(),
    ).toBeVisible();
  });

  test('Enter on an empty custom action does not commit', async ({ page }) => {
    await openSampleFlow(page);
    const label = page
      .locator('.react-flow__edgelabel-renderer button')
      .filter({ hasText: /^submit$/ })
      .first();
    await label.click({ force: true });
    const select = page.locator(`${TRIGGER_EDITOR} select`).first();
    await select.selectOption('__custom__');
    const custom = page.locator(`${TRIGGER_EDITOR} input`).first();
    await custom.fill('   ');
    await custom.press('Enter');

    // Still open: an empty draft is a cancel, and cancelling is the parent's
    // decision to make on dismiss, not Enter's.
    await expect(page.locator(TRIGGER_EDITOR)).toBeVisible();
  });
});

test.describe('closed-pair triggers (UF-054)', () => {
  test('an action edge with no sibling offers a direct flip, not an empty panel', async ({
    page,
  }) => {
    await openSampleFlow(page);

    // Find an edge label whose trigger is one half of a closed pair.
    const label = page
      .locator('.react-flow__edgelabel-renderer button')
      .filter({ hasText: /^(success|error)$/ })
      .first();
    await expect(label).toBeVisible();
    const before = (await label.innerText()).trim();
    await label.click({ force: true });

    const panel = page.locator(TRIGGER_EDITOR);
    await expect(panel).toBeVisible();
    // The bug: this panel rendered with nothing in it at all.
    await expect(panel).not.toHaveText(/^\s*$/);
    const offer = panel.getByRole('button', { name: /Swap with|Change to/ });
    await expect(offer).toBeVisible();

    await offer.click();
    await page.waitForTimeout(500);
    // The edge now carries the other half of the pair.
    const after = before === 'success' ? 'error' : 'success';
    await expect(
      page.locator('.react-flow__edgelabel-renderer button').filter({ hasText: after }).first(),
    ).toBeVisible();
  });
});

test.describe('delete without a keyboard (US-136)', () => {
  test('deleting a node from the inspector is one undo step', async ({ page }) => {
    await openSampleFlow(page);
    const nodesBefore = await page.locator('.react-flow__node').count();
    // Deleting a node cascades to its incident edges and their routes. Counting
    // nodes alone would pass even if undo restored the node and left the edges
    // deleted, which is the half-undo this criterion exists to rule out.
    const edgesBefore = await page.locator('.react-flow__edge').count();

    // Same select-then-activate path as US-134 — not a double-click.
    const node = page.locator('.react-flow__node-screen').first();
    const box = await node.boundingBox();
    if (!box) throw new Error('no node');
    const x = box.x + box.width / 2;
    const y = box.y + 6;
    await page.mouse.click(x, y);
    await page.waitForTimeout(250);
    await page.mouse.click(x, y);
    await expect(page.locator(INSPECTOR)).toBeVisible();

    await page.getByRole('button', { name: 'Delete node' }).click();
    await expect(page.locator(INSPECTOR)).toHaveCount(0);
    await expect(page.locator('.react-flow__node')).toHaveCount(nodesBefore - 1);
    expect(await page.locator('.react-flow__edge').count()).toBeLessThan(edgesBefore);

    // Chromium project (CI + local): Control+z hits the canvas undo listener.
    await page.keyboard.press('Control+z');
    await expect(page.locator('.react-flow__node')).toHaveCount(nodesBefore);
    await expect(page.locator('.react-flow__edge')).toHaveCount(edgesBefore);
  });

  test('deleting an edge from the trigger editor is one undo step', async ({ page }) => {
    await openSampleFlow(page);
    const edgesBefore = await page.locator('.react-flow__edge').count();

    await page.locator('.react-flow__edgelabel-renderer button').first().click({ force: true });
    await expect(page.locator(TRIGGER_EDITOR)).toBeVisible();

    await page.getByRole('button', { name: 'Delete edge' }).click();
    await expect(page.locator(TRIGGER_EDITOR)).toHaveCount(0);
    await expect(page.locator('.react-flow__edge')).toHaveCount(edgesBefore - 1);

    await page.keyboard.press('Control+z');
    await expect(page.locator('.react-flow__edge')).toHaveCount(edgesBefore);
  });
});

test.describe('node notes textarea (US-139)', () => {
  test('Enter inserts a newline and does not commit', async ({ page }) => {
    await openSampleFlow(page);
    const node = page.locator('.react-flow__node-action').first();
    const box = await node.boundingBox();
    if (!box) throw new Error('no action node');
    const x = box.x + box.width / 2;
    const y = box.y + 6;

    await page.mouse.click(x, y);
    await page.waitForTimeout(250);
    await page.mouse.click(x, y);
    await expect(page.locator(INSPECTOR)).toBeVisible();

    const notes = page.locator(`${INSPECTOR} textarea`);
    await expect(notes).toBeVisible();
    await notes.click();
    await notes.fill('line one');
    await notes.press('Enter');
    await notes.type('line two');

    await expect(notes).toBeFocused();
    await expect(notes).toHaveValue('line one\nline two');
    // Still open — Enter must not blur/dismiss the way single-line fields do.
    await expect(page.locator(INSPECTOR)).toBeVisible();
  });
});
