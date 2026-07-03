# 0002 — Local persistence (IndexedDB) and the source-of-truth hierarchy

**Status:** Accepted (2026-07-01).
**Deciders:** Alejo (project owner), with the Lead.
**Scope note:** Application-architecture ADR (`docs/adr/`), distinct from the DSL-spec ADRs under `packages/dsl-spec/decisions/` (numbering is independent per directory).

## Context

E42 (Start screen & local recent flows) introduces a Docs-style landing screen that needs a "Recent" list — flows the user has had open, resumable without re-opening a file from disk. Authprint v0 has no concept of this today: the editor is purely file-based (open = pick a file, save = trigger a browser download), and nothing about "what you've worked on" survives a tab close.

The immediate design question (a local IndexedDB cache) is easy in isolation, but Authprint already has two other persistence-shaped commitments on the books that this needs to not collide with:

- **Settled persistence architecture:** `Y.Doc` is the CRDT runtime model from MVP; a sync provider (real-time collaboration) is deferred to v2 but requires no model refactor when it arrives. Firestore is the eventual canonical store, as `{ dsl, layout }` JSON — explicitly **never** Yjs binary blobs.
- **[ADR 0001](0001-control-plane-data-plane-split.md):** identity/accounts may move to a separate control plane; Phase III (auth, E4–E10) and E28 (Firestore persistence) are still gated on that.

So the real question wasn't "how do we build a Recent list" — it was "what does adding a browser-local persistence layer commit us to, and does it still make sense once Firestore and collaboration exist." This ADR records that reasoning so it isn't re-derived when E28 or v2 collaboration land.

## Decision

**IndexedDB stores the same canonical artifact shape that's already committed elsewhere — DSL + layout JSON (the same bundle `persist.ts` produces for file export) — never a new format, never Yjs binary.** This is what keeps the rest of the decision simple: IndexedDB isn't a new kind of source of truth, it's a local, automatic mirror of the artifact shape that was already canonical.

**Concretely (v0, E42 / US-089):**
- One autosave slot per editing session, keyed by a locally-generated `crypto.randomUUID()` — **not** written into the DSL (Principle 2: layout/bookkeeping stays out of the portable artifact).
- Write trigger: periodic (~30s while dirty) + lifecycle events (`visibilitychange`/`pagehide`) — not on every keystroke. Chosen over continuous-debounced-write for simplicity and fewer IndexedDB writes, and over checkpoint-only (save/open events only) because the actual point of the feature is protecting against an accidental tab close, which checkpoint-only doesn't do.
- Opening a Recent entry resumes its existing session id (updates in place). Opening a file from disk, a blank flow, or a pattern always gets a fresh session id — there's no stable link back to a file on disk (no File System Access API handle retained), so re-opening the same disk file twice produces two Recent entries. Accepted as honest behavior rather than faking dedup by filename.
- Capped list (~20 entries), LRU eviction. Per-entry "remove from recent" + "clear all" ship in v1 (not deferred) — browser-local storage on a shared/demo machine can expose real flow content, and per Alejo: "I prefer to have a polished version. We have only a single chance of making a good first impression."
- Best-effort `navigator.storage.persist()` on init. **Known gap:** Safari's ITP purges script-writable storage (including IndexedDB) after 7 days without a visit — infrequent users may see Recent silently empty out on Safari specifically. Documented, not solved (no real mitigation short of a real backend, which is the eventual answer anyway).

### The source-of-truth hierarchy — the part that has to survive E28 and v2

| Stage | Canonical source of truth | IndexedDB's role |
|---|---|---|
| **v0 (now)** | The user's own file on disk, if ever saved (or nothing) | Recovery cache only |
| **E28 (Firestore + accounts)** | Firestore `{dsl, layout}` doc | Local cache/buffer *in front of* Firestore — serves pre-sign-in and offline work, feeds *into* Firestore on save/sync, never competes with it |
| **v2 (real-time collaboration)** | The server-reconciled `Y.Doc`, via the sync provider | One client's local replica — always downstream, never authoritative |

**The rule: IndexedDB is always a leaf, never upstream.** This matters most once collaboration exists — if two collaborators' browsers each autosave their own local view independently, those snapshots can genuinely diverge before the CRDT merge reaches the server. A "restore from local cache" path must never be allowed to overwrite server-reconciled state once a flow has a server-side identity; it can only ever mean "resume where I locally left off if nothing more authoritative exists yet."

### Why the migration path is cheap (not a rewrite)

Same "ship local now, swap the backing store later" pattern already used twice in this project (Yjs-from-MVP, the analytics `track()` abstraction):

- `useRecentFlowAutosave`'s periodic+lifecycle *trigger* logic doesn't change for E28 — only its write target does (a Firestore mutation instead of the local `saveRecentFlow` call).
- The Start screen's Recent list doesn't change its UI — only `listRecentFlows()`'s implementation swaps from an IndexedDB query to a Firestore query scoped to the user's team, as long as US-090 depends on that interface and nothing more concrete.

A relevant real-world precedent: the Yjs ecosystem's own `y-indexeddb` provider does exactly this shape of thing — local IndexedDB caching in front of a real backend, for fast reload and offline resilience. It caches Yjs binary updates rather than DSL+layout text, though, which is why we're not adopting it directly now: it would introduce a second local artifact format alongside the one already committed as canonical. Worth revisiting only if reload performance ever demands it — not needed at this scale.

## Consequences

### Positive
- Recent-flows and "protect against tab-close data loss" ship together, for the cost of one persistence layer, not two.
- Nothing here has to be un-built or redesigned when E28 or v2 land — only the write/read target of already-abstracted functions changes.
- The privacy affordances (remove/clear) are cheap now and avoid a worse retrofit later.

### Negative / costs
- A new dependency surface (`idb` for the wrapper, `fake-indexeddb` for tests) — both small, MIT, standard for this.
- Safari's 7-day storage eviction is a real, undocumented-to-users gap until a real backend exists.
- Anonymous local work and a future account are not connected in v0 — see open questions.

## Open questions (not solved by this ADR)

- **E28 migration UX:** when a user who's been working anonymously creates an account, do we offer to import their local Recent flows into the new Firestore-backed account? Leaning yes (one-time import prompt), but that's E28's design problem against actual auth UX, not this ADR's.
- **Per-user encryption (post-MVP idea, Alejo 2026-07-01):** once Phase III auth exists, derive a per-user key to encrypt local IndexedDB content, so a different logged-in user on the same browser can't read (and storage can be safely wiped for) a prior user's local cache. Real idea, explicitly deferred — not needed while the app is unauthenticated and single-tenant-per-browser in practice.
- **Binary local cache for reload performance** (`y-indexeddb`-style) — future option if DSL+layout text re-parsing ever becomes a measured bottleneck. Not needed now.

## Next steps
1. Drill and land E42 (US-089 persistence layer, US-090 Start screen UI) against this decision.
2. Carry the source-of-truth hierarchy forward into E28's design when it's drilled (gated on Phase III / ADR 0001 per existing WBS notes) — don't re-derive it.
3. Does not block anything currently in flight (E36, E11 v0 deploy) — additive.
