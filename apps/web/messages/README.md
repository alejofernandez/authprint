# Message catalog (`messages/`)

English-only v1. User-facing copy for `@authprint/web` lives here as JSON,
loaded at request time via `next-intl` (see `src/i18n/request.ts`).

## Namespaces

| File key | Used by | Status (US-076) |
|---|---|---|
| `palette` | Command palette groups/labels, search button, drop overlay | migrated |
| `notices` | Import/load toasts (`setNotice` titles in `Editor.tsx`) | migrated |
| `inspector` | Node inline editor (`NodeInlineEditor.tsx`) | migrated |

Other surfaces (Problems panel, scenario chrome, node views, etc.) still use
inline literals — migrate incrementally into new namespaces as those areas ship.

## Consuming messages

**Client components** (most of the canvas):

```tsx
import { useTranslations } from 'next-intl';

const t = useTranslations('palette');
return <span>{t('commands.undo')}</span>;
```

**Server components** (when needed later):

```tsx
import { getTranslations } from 'next-intl/server';

const t = await getTranslations('SomeNamespace');
```

Interpolation uses ICU placeholders: `{name}`, `{count}`, etc.

## Adding strings

1. Add the key under the right namespace in `en.json`.
2. Replace the literal in the component with `t('…')`.
3. Keep keys grouped by feature area; prefer nested objects over flat prefixes.
4. Do **not** add locale routing or a locale switcher until product asks for it.

## Wiring

- Provider: `NextIntlClientProvider` in `src/app/layout.tsx`
- Config: `src/i18n/request.ts` + `createNextIntlPlugin()` in `next.config.ts`
- Setup follows [next-intl — App Router without i18n routing](https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing)
