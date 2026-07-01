'use client';

// Cmd+K command palette — the product's primary navigation surface (§7). Built
// on cmdk (fuzzy search + keyboard nav) over Radix Dialog (focus trap, Esc,
// backdrop). Controlled by the parent; commands are supplied as a flat typed
// list and grouped here in registration order. Features register their own
// commands as they land (flow search, theme, share, sign out…).

import { Command } from 'cmdk';

export type PaletteCommand = {
  id: string;
  label: string;
  group: string;
  /** Extra terms folded into fuzzy search (synonyms, the thing it acts on). */
  keywords?: string;
  /** Grayed out and non-selectable — e.g. undo when the stack is empty. */
  disabled?: boolean;
  run: () => void;
};

export function CommandPalette({
  open,
  onOpenChange,
  commands,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: PaletteCommand[];
}) {
  const groups: { name: string; items: PaletteCommand[] }[] = [];
  for (const command of commands) {
    const existing = groups.find((g) => g.name === command.group);
    if (existing) existing.items.push(command);
    else groups.push({ name: command.group, items: [command] });
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      overlayClassName="fixed inset-0 z-40 bg-overlay-scrim backdrop-blur-sm transition-opacity duration-[var(--duration-base)] ease-standard data-[state=open]:opacity-100 data-[state=closed]:opacity-0"
      contentClassName="fixed left-1/2 top-[18vh] z-50 w-[min(640px,90vw)] -translate-x-1/2 origin-top focus:outline-none transition-[opacity,transform] duration-[var(--duration-base)] ease-standard data-[state=open]:scale-100 data-[state=open]:opacity-100 data-[state=closed]:scale-[0.98] data-[state=closed]:opacity-0"
      className="overflow-hidden rounded-xl border border-border-subtle bg-bg-panel shadow-2xl dark:border-border-subtle"
    >
      <Command.Input
        placeholder="Type a command or search…"
        className="w-full border-border-subtle border-b bg-transparent px-4 py-3 text-sm text-fg-default outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-primary-border placeholder:text-fg-subtle dark:border-border-subtle"
      />
      <Command.List className="max-h-[min(50vh,360px)] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-fg-subtle">
          No results.
        </Command.Empty>
        {groups.map((group) => (
          <Command.Group
            key={group.name}
            heading={group.name}
            className="text-xs text-fg-subtle [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:font-medium"
          >
            {group.items.map((command) => (
              <Command.Item
                key={command.id}
                value={`${command.label} ${command.keywords ?? ''}`}
                disabled={command.disabled}
                onSelect={() => {
                  if (command.disabled) return;
                  onOpenChange(false);
                  command.run();
                }}
                className={`flex items-center rounded-md px-3 py-2 text-sm text-fg-secondary outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-primary-border dark:text-fg-soft ${
                  command.disabled
                    ? 'cursor-not-allowed opacity-40'
                    : 'cursor-pointer data-[selected=true]:bg-accent-primary-bg data-[selected=true]:text-accent-primary-fg-emphasis dark:data-[selected=true]:bg-accent-primary-bg/60 dark:data-[selected=true]:text-accent-primary-fg-on-bg'
                }`}
              >
                {command.label}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
