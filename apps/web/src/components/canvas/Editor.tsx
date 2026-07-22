'use client';

// The Editor: a shell over the React Flow canvas. It owns the current flow as a
// Y.Doc (blank entry-only flow by default, then whatever the user opens), file loading
// (drag-and-drop or the command palette), and the Cmd+K palette that is the
// product's primary navigation surface. elkjs computes auto-layout (LR,
// E17); E24 binds the canvas to the Y.Doc so node moves (→ layout map) and
// deletes (→ cascade) flow into the document. Richer authoring (drag-from-handle
// creation, inline editing) is E26; persistence/serialization is E25.

import '@xyflow/react/dist/style.css';

import type { Flow } from '@authprint/dsl';
import {
  Background,
  type Connection,
  Controls,
  type FinalConnectionState,
  type IsValidConnection,
  MarkerType,
  type NodeMouseHandler,
  type OnConnect,
  type OnConnectEnd,
  type OnEdgesChange,
  type OnNodesChange,
  type OnReconnect,
  ReactFlow,
  ReactFlowProvider,
  type Edge as RfEdge,
  type Node as RfNode,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { useTranslations } from 'next-intl';
import {
  type DragEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type * as Y from 'yjs';
import { track } from '@/analytics';
import { useTheme } from '@/components/theme';
import { AboutModal } from './AboutModal.tsx';
import { CommandPalette, type PaletteCommand } from './CommandPalette.tsx';
import { DocumentPreferencesModal } from './DocumentPreferencesModal.tsx';
import { type EdgeTriggerActions, EdgeTriggerEditor } from './EdgeTriggerEditor.tsx';
import { EdgeRouteProvider } from './edges/edgeRouteContext.tsx';
import { EdgeTriggerProvider } from './edges/edgeTriggerContext.tsx';
import { RoutableEdge } from './edges/RoutableEdge.tsx';
import { isEditableEdgeTrigger } from './edgeTriggerUtils.ts';
import { elkLayoutReady } from './elkLayoutReady.ts';
import type { PatternFlow } from './flowCatalog.ts';
import { flowFromSource } from './flowFromSource.ts';
import { flowToReactFlow, NODE_SIZE, type NodePositionsMap } from './flowToReactFlow.ts';
import { layoutFlow } from './layout.ts';
import { type NodeEditActions, NodeInlineEditor } from './NodeInlineEditor.tsx';
import { NodeInspector } from './NodeInspector.tsx';
import { NodeTypePicker, type NodeTypePickerPlacement } from './NodeTypePicker.tsx';
import { type Notice, NoticeToast } from './NoticeToast.tsx';
import { NodeCreateProvider, type OpenCreateMenu } from './nodes/HandlePlus.tsx';
import { type CanvasNodeData, nodeTypes } from './nodes/index.ts';
import { NodeActivateProvider } from './nodes/nodeA11y.tsx';
import { ProblemsPanel } from './ProblemsPanel.tsx';
import { PlayerMode } from './player/PlayerMode.tsx';
import { PlayerModeProvider, useOptionalPlayerMode } from './player/PlayerModeContext.tsx';
import { usePlayerMode } from './player/usePlayerMode.ts';
import type { RecentFlowEntry } from './recentFlows/store.ts';
import { useRecentFlowAutosave } from './recentFlows/useRecentFlowAutosave.ts';
import { useUnexportedChanges } from './recentFlows/useUnexportedChanges.ts';
import { reconcileFlowEdges, reconcileFlowNodes } from './reconcileFlowState.ts';
import { StartScreen } from './StartScreen.tsx';
import { StatusCluster } from './StatusCluster.tsx';
import { Topbar } from './Topbar.tsx';
import { UnexportedChangesConfirmDialog } from './UnexportedChangesConfirmDialog.tsx';
import { useValidation } from './useValidation.ts';
import {
  applyEdgeReconnect,
  type CreatableType,
  connectNodes,
  createConnectedNode,
  resolveCreateFromHandle,
  validateConnection,
} from './ydoc/create.ts';
import { hydrate } from './ydoc/hydrate.ts';
import {
  declareContextSlot,
  putScenario,
  removeScenario,
  setCompanyName,
  setDecisionPredicate,
  setEdgeRoute,
  setEdgeTrigger,
  setFlowName,
  setFlowTheme,
  setNodeErrorMessage,
  setNodeKind,
  setNodeName,
  setPrimaryColor,
  setScreenDisplayErrorState,
  setScreenFidelity,
  setScreenFields,
  setScreenTraits,
  swapEdgeTriggers,
} from './ydoc/ops.ts';
import {
  docToArtifact,
  findMatchingSidecar,
  isAuthprintFile,
  isLayoutSidecarFile,
  resolveLayoutForImport,
  serializeBundle,
  serializeSemantic,
  serializeSidecar,
} from './ydoc/persist.ts';
import { layoutPositionsOnly } from './ydoc/schema.ts';
import { useFlowMeta } from './ydoc/useFlowMeta.ts';
import { useScenarios } from './ydoc/useScenarios.ts';
import { shouldDeferUndoToField, useUndoManager } from './ydoc/useUndoManager.ts';
import { useYDocFlow } from './ydoc/useYDocFlow.ts';

export type { PatternFlow } from './flowCatalog.ts';

type EditorPhase = 'not-started' | 'active';

function newSessionId(): string {
  return crypto.randomUUID();
}

const edgeTypes = { routable: RoutableEdge };

// Leave margin around the fitted graph. `maxZoom` caps magnification so a lone
// entry node doesn't blow up to fill the viewport; wide flows still zoom out to
// fit because their ideal zoom is below 1. `initialWidth`/`initialHeight` hints
// on the nodes (see flowToReactFlow) give the first fit correct-enough bounds.
const FIT_VIEW_OPTIONS = { padding: 0.15, maxZoom: 1 } as const;

// `smoothstep` routes edges as clean orthogonal paths (vs the default bezier,
// whose curves overlap and are hard to trace once edges cross). Arrowheads make
// flow direction legible at a glance.
const DEFAULT_EDGE_OPTIONS = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
} as const;

const FILE_EXT = '.authprint';
const LAYOUT_EXT = '.authprint.layout';
const MIME = 'application/vnd.authprint+yaml';
const LAYOUT_MIME = 'application/vnd.authprint.layout+yaml';
const MAX_BYTES = 2_000_000; // generous guard; real flows are a few KB

// Flow name → safe file stem; never empty.
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'flow';
}

function downloadText(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function Editor({ initialFlow, patterns }: { initialFlow: Flow; patterns: PatternFlow[] }) {
  // ReactFlowProvider hoists the store above the canvas so the palette (a
  // sibling of the canvas) can drive it — e.g. the "Fit view" command.
  return (
    <ReactFlowProvider>
      <EditorShell initialFlow={initialFlow} patterns={patterns} />
    </ReactFlowProvider>
  );
}

function EditorShell({ initialFlow, patterns }: { initialFlow: Flow; patterns: PatternFlow[] }) {
  const tPalette = useTranslations('palette');
  const tPlayer = useTranslations('player');
  const tNotices = useTranslations('notices');
  const [phase, setPhase] = useState<EditorPhase>('not-started');
  const [sessionId, setSessionId] = useState<string | null>(null);
  // The Y.Doc is the editable runtime model. It's built from the parsed
  // Flow and rebuilt wholesale on each load — a fresh document per flow is
  // simpler than diffing one doc into another, and load is a deliberate reset.
  const [doc, setDoc] = useState(() => hydrate(initialFlow));
  // Bumped on every successful load so the canvas remounts and re-runs `fitView`
  // for the new flow (the `fitView` prop only fires on mount).
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dragging, setDragging] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [docPrefsOpen, setDocPrefsOpen] = useState(false);
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);
  const pendingReplaceRef = useRef<(() => void) | null>(null);
  const { fitView, getNode, setCenter } = useReactFlow();
  const { theme, setTheme } = useTheme();
  const { undo, redo, canUndo, canRedo } = useUndoManager(doc);
  // Scenario player overlay (US-110 / US-120): Play + Edit shell over the canvas.
  const playerPersist = useMemo(
    () => ({
      persistScenario: (scenario: Parameters<typeof putScenario>[1]) => {
        putScenario(doc, scenario);
      },
      removeScenario: (id: string) => {
        removeScenario(doc, id);
      },
    }),
    [doc],
  );
  const player = usePlayerMode(playerPersist);
  const scenarios = useScenarios(doc);
  // The doc is the truth for scenarios — undo/redo mutate it behind the
  // shell's back; without this, ⌘Z appears dead in the player and the next
  // gesture resurrects the undone state (UF-017 / UF-014).
  const { syncScenarios } = player;
  useEffect(() => {
    syncScenarios(scenarios, () => docToArtifact(doc).flow);
  }, [syncScenarios, scenarios, doc]);
  const { name: flowName, branding: flowBranding } = useFlowMeta(doc);
  const flowTheme = flowBranding.theme;
  useRecentFlowAutosave(sessionId ?? '', doc, flowName);
  const { hasUnexportedChanges, markExported } = useUnexportedChanges(doc);

  const needsReplaceConfirm = useCallback(
    () => hasUnexportedChanges && phase === 'active',
    [hasUnexportedChanges, phase],
  );

  const guardedReplace = useCallback(
    (action: () => void) => {
      if (!needsReplaceConfirm()) {
        action();
        return;
      }
      pendingReplaceRef.current = action;
      setReplaceConfirmOpen(true);
    },
    [needsReplaceConfirm],
  );

  const confirmReplace = useCallback(() => {
    pendingReplaceRef.current?.();
    pendingReplaceRef.current = null;
  }, []);

  const activateLoadedDoc = useCallback((nextSessionId: string) => {
    setSessionId(nextSessionId);
    setRevision((r) => r + 1);
    setPhase('active');
  }, []);

  // Parse `.authprint` source (and optional layout sidecar) and swap the flow
  // on success; on failure the current flow stays and errors surface in the toast.
  const loadFlowFromSource = useCallback(
    (
      authprintSource: string,
      label: string,
      options?: { sidecarSource?: string; sessionId?: string; onOpened?: () => void },
    ): boolean => {
      const { flow: parsed, diagnostics } = flowFromSource(authprintSource);
      if (!parsed) {
        setNotice({ kind: 'error', title: tNotices('parseFailed', { label }), diagnostics });
        return false;
      }
      const { nodes, edges } = resolveLayoutForImport(authprintSource, options?.sidecarSource);
      setDoc(hydrate(parsed, nodes, edges));
      activateLoadedDoc(options?.sessionId ?? newSessionId());
      setNotice(
        diagnostics.length
          ? {
              kind: 'info',
              title: tNotices('loadedWithIssues', { label, count: diagnostics.length }),
              diagnostics,
            }
          : null,
      );
      options?.onOpened?.();
      return true;
    },
    [activateLoadedDoc, tNotices],
  );

  const applyImport = useCallback(
    (authprintSource: string, label: string, sidecarSource?: string): boolean => {
      return loadFlowFromSource(authprintSource, label, { sidecarSource });
    },
    [loadFlowFromSource],
  );

  const applySourceInner = useCallback(
    (source: string, label: string) => {
      applyImport(source, label);
    },
    [applyImport],
  );

  const applySource = useCallback(
    (source: string, label: string) => {
      guardedReplace(() => applySourceInner(source, label));
    },
    [guardedReplace, applySourceInner],
  );

  const loadFilesInner = useCallback(
    async (files: File[]) => {
      const authprints = files.filter((f) => isAuthprintFile(f.name));
      const sidecars = files.filter((f) => isLayoutSidecarFile(f.name));

      if (authprints.length === 0) {
        if (sidecars.length > 0) {
          setNotice({
            kind: 'error',
            title: tNotices('sidecarNeedsMatch', {
              name: sidecars[0]?.name ?? tNotices('layoutFileFallback'),
            }),
            diagnostics: [],
          });
          return;
        }
        setNotice({
          kind: 'error',
          title: tNotices('noFileSelected'),
          diagnostics: [],
        });
        return;
      }

      const primary = authprints[0];
      if (!primary) return;

      if (primary.size > MAX_BYTES) {
        setNotice({
          kind: 'error',
          title: tNotices('fileTooLarge', { name: primary.name }),
          diagnostics: [],
        });
        return;
      }

      const sidecarName = findMatchingSidecar(
        primary.name,
        sidecars.map((f) => f.name),
      );
      const sidecar = sidecarName ? sidecars.find((f) => f.name === sidecarName) : undefined;

      if (sidecar && sidecar.size > MAX_BYTES) {
        setNotice({
          kind: 'error',
          title: tNotices('fileTooLarge', { name: sidecar.name }),
          diagnostics: [],
        });
        return;
      }

      const authprintSource = await primary.text();
      const sidecarSource = sidecar ? await sidecar.text() : undefined;
      const label = sidecar ? `${primary.name} + ${sidecar.name}` : primary.name;
      if (applyImport(authprintSource, label, sidecarSource)) {
        track('flow_opened', { fileName: primary.name, hasSidecar: Boolean(sidecar) });
        markExported();
      }
    },
    [applyImport, markExported, tNotices],
  );

  const loadFiles = useCallback(
    (files: File[]) => {
      guardedReplace(() => void loadFilesInner(files));
    },
    [guardedReplace, loadFilesInner],
  );

  const onStartScreenDrop = useCallback(
    (files: File[]) => {
      const relevant = files.filter((f) => isAuthprintFile(f.name) || isLayoutSidecarFile(f.name));
      if (relevant.length > 0) void loadFiles(relevant);
    },
    [loadFiles],
  );

  const startBlankInner = useCallback(() => {
    setDoc(hydrate(initialFlow));
    activateLoadedDoc(newSessionId());
    setNotice(null);
  }, [activateLoadedDoc, initialFlow]);

  const startBlank = useCallback(() => {
    guardedReplace(startBlankInner);
  }, [guardedReplace, startBlankInner]);

  const resumeRecent = useCallback(
    (entry: RecentFlowEntry) => {
      loadFlowFromSource(entry.bundle, entry.name, { sessionId: entry.sessionId });
    },
    [loadFlowFromSource],
  );

  const openFilePickerInner = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `${FILE_EXT},${LAYOUT_EXT}`;
    input.multiple = true;
    input.addEventListener('change', () => {
      const selected = input.files ? [...input.files] : [];
      if (selected.length > 0) void loadFilesInner(selected);
    });
    input.click();
  }, [loadFilesInner]);

  const openFilePicker = useCallback(() => {
    guardedReplace(openFilePickerInner);
  }, [guardedReplace, openFilePickerInner]);

  // Cmd/Ctrl+K toggles the palette from anywhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Canvas undo/redo — defer to native field undo when a text control is focused.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (shouldDeferUndoToField(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        redo();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const {
    shellMode: playerShellMode,
    exit: exitPlayer,
    next: stepPlayer,
    prev: backPlayer,
    togglePlay: togglePlayerPlay,
    enterEmpty,
    enterPlay,
    enterEdit,
    startRecording,
  } = player;

  const openPlayerEntry = useCallback(() => {
    const flow = docToArtifact(doc).flow;
    const [first] = flow.scenarios;
    if (!first) {
      enterEmpty(flow);
      return;
    }
    enterPlay(first, flow);
  }, [doc, enterEmpty, enterPlay]);

  const recordNewScenario = useCallback(() => {
    const flow = docToArtifact(doc).flow;
    startRecording(flow, tPlayer('defaultScenarioName'));
  }, [doc, startRecording, tPlayer]);

  const revealOnCanvas = useCallback(
    (nodeId: string) => {
      exitPlayer();
      requestAnimationFrame(() => {
        const node = getNode(nodeId);
        if (!node) return;
        const w = node.measured?.width ?? 0;
        const h = node.measured?.height ?? 0;
        setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom: 1.2, duration: 300 });
      });
    },
    [exitPlayer, getNode, setCenter],
  );

  const playFirstScenario = openPlayerEntry;

  const goHome = useCallback(() => {
    exitPlayer();
    setPaletteOpen(false);
    setNotice(null);
    setPhase('not-started');
  }, [exitPlayer]);

  const saveFlow = useCallback(() => {
    const artifact = docToArtifact(doc);
    track('flow_saved', { flowName: artifact.flow.name });
    downloadText(`${slugify(artifact.flow.name)}${FILE_EXT}`, serializeBundle(artifact), MIME);
    markExported();
  }, [doc, markExported]);

  // ⌘O open, ⌘S save (active only), ⌘⇧H home — same actions as the palette.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (shouldDeferUndoToField(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === 'o' && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        openFilePicker();
      } else if (key === 's' && !event.shiftKey && !event.altKey) {
        if (phase !== 'active') return;
        event.preventDefault();
        saveFlow();
      } else if (key === 'h' && event.shiftKey && !event.altKey) {
        if (phase !== 'active') return;
        event.preventDefault();
        goHome();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase, openFilePicker, saveFlow, goHome]);

  const resumeEditing = useCallback(() => {
    setPhase('active');
  }, []);

  // Esc on the start screen returns to the in-memory session (after Home).
  useEffect(() => {
    if (phase !== 'not-started' || !sessionId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || paletteOpen) return;
      event.preventDefault();
      resumeEditing();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase, sessionId, paletteOpen, resumeEditing]);

  // Player-mode keyboard: Esc exits; space/arrows only in Play (not Edit/empty).
  useEffect(() => {
    if (!playerShellMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (paletteOpen) return;
      if (shouldDeferUndoToField(event.target)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        exitPlayer();
        return;
      }
      if (playerShellMode !== 'play') return;
      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        togglePlayerPlay();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        stepPlayer();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        backPlayer();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [playerShellMode, exitPlayer, togglePlayerPlay, stepPlayer, backPlayer, paletteOpen]);

  // Loading a new flow drops out of player mode (runs are flow-scoped).
  // biome-ignore lint/correctness/useExhaustiveDependencies: must re-run on each load (revision change), not just on exit identity.
  useEffect(() => {
    exitPlayer();
  }, [revision, exitPlayer]);

  const commands = useMemo<PaletteCommand[]>(
    () => [
      ...(phase === 'not-started' && sessionId
        ? [
            {
              id: 'continue-editing',
              group: tPalette('groups.file'),
              label: tPalette('commands.continueEditing'),
              keywords: 'resume canvas esc return graph',
              run: resumeEditing,
            },
          ]
        : []),
      ...(phase === 'active'
        ? [
            {
              id: 'home',
              group: tPalette('groups.file'),
              label: tPalette('commands.home'),
              keywords: 'start landing home',
              run: goHome,
            },
          ]
        : []),
      {
        id: 'undo',
        group: tPalette('groups.edit'),
        label: tPalette('commands.undo'),
        keywords: 'revert back cmd z ctrl',
        disabled: !canUndo,
        run: undo,
      },
      {
        id: 'redo',
        group: tPalette('groups.edit'),
        label: tPalette('commands.redo'),
        keywords: 'restore forward cmd shift z ctrl y',
        disabled: !canRedo,
        run: redo,
      },
      {
        id: 'open-file',
        group: tPalette('groups.file'),
        label: tPalette('commands.openFile'),
        keywords: 'load import',
        run: openFilePicker,
      },
      {
        id: 'save-file',
        group: tPalette('groups.file'),
        label: tPalette('commands.saveFlow'),
        keywords: 'export download write',
        run: saveFlow,
      },
      {
        id: 'export-semantic',
        group: tPalette('groups.export'),
        label: tPalette('commands.exportSemantic'),
        keywords: 'download git clean layout-free diff codegen',
        run: () => {
          const artifact = docToArtifact(doc);
          downloadText(
            `${slugify(artifact.flow.name)}${FILE_EXT}`,
            serializeSemantic(artifact),
            MIME,
          );
          markExported();
        },
      },
      {
        id: 'export-sidecar',
        group: tPalette('groups.export'),
        label: tPalette('commands.exportSidecar'),
        keywords: 'download two files positions layout sidecar',
        run: () => {
          const artifact = docToArtifact(doc);
          const base = slugify(artifact.flow.name);
          const { semantic, layout } = serializeSidecar(artifact);
          downloadText(`${base}${FILE_EXT}`, semantic, MIME);
          downloadText(`${base}${LAYOUT_EXT}`, layout, LAYOUT_MIME);
          markExported();
        },
      },
      {
        id: 'export-bundled',
        group: tPalette('groups.export'),
        label: tPalette('commands.exportBundled'),
        keywords: 'download save default single file bundle',
        run: () => {
          const artifact = docToArtifact(doc);
          downloadText(
            `${slugify(artifact.flow.name)}${FILE_EXT}`,
            serializeBundle(artifact),
            MIME,
          );
          markExported();
        },
      },
      ...patterns.map((pattern) => ({
        id: `pattern-${pattern.id}`,
        group: 'New flow from pattern',
        label: pattern.name,
        keywords: pattern.id,
        run: () => {
          applySource(pattern.source, pattern.name);
        },
      })),
      {
        id: 'fit-view',
        group: tPalette('groups.view'),
        label: tPalette('commands.fitView'),
        keywords: 'zoom center reset',
        run: () => fitView(FIT_VIEW_OPTIONS),
      },
      ...(['light', 'dark', 'system'] as const).map((option) => ({
        id: `theme-${option}`,
        group: tPalette('groups.appearance'),
        label: tPalette('commands.theme', {
          name: tPalette(`themes.${option}`),
          mark: theme === option ? '  ✓' : '',
        }),
        keywords: `dark light system appearance ${option}`,
        run: () => setTheme(option),
      })),
      // Player (US-110 / US-120): play, record, edit per scenario.
      {
        id: 'record-scenario',
        group: tPalette('groups.scenario'),
        label: tPalette('commands.recordScenario'),
        keywords: 'record new scenario edit author create',
        run: recordNewScenario,
      },
      ...(scenarios.length > 0
        ? [
            ...scenarios.map((sc) => ({
              id: `play-scenario-${sc.id}`,
              group: tPalette('groups.scenario'),
              label: tPalette('commands.playScenario', { name: sc.name }),
              keywords: `play player simulate timeline ${sc.id}`,
              run: () => {
                const flow = docToArtifact(doc).flow;
                enterPlay(sc, flow);
              },
            })),
            ...scenarios.map((sc) => ({
              id: `edit-scenario-${sc.id}`,
              group: tPalette('groups.scenario'),
              label: tPalette('commands.editScenario', { name: sc.name }),
              keywords: `edit record author scenario ${sc.id}`,
              run: () => {
                const flow = docToArtifact(doc).flow;
                enterEdit(sc, flow);
              },
            })),
          ]
        : []),
      ...(playerShellMode
        ? [
            {
              id: 'exit-player',
              group: tPalette('groups.scenario'),
              label: tPalette('commands.exitPlayer', {
                name: player.draft?.name ?? player.session?.name ?? '',
              }),
              keywords: 'stop close player esc',
              run: player.exit,
            },
          ]
        : []),
      {
        id: 'about',
        group: tPalette('groups.help'),
        label: tPalette('commands.about'),
        keywords: 'about credits license mit react flow attribution',
        run: () => setAboutOpen(true),
      },
    ],
    [
      phase,
      sessionId,
      goHome,
      resumeEditing,
      doc,
      patterns,
      openFilePicker,
      saveFlow,
      applySource,
      fitView,
      theme,
      setTheme,
      undo,
      redo,
      canUndo,
      canRedo,
      scenarios,
      player,
      playerShellMode,
      enterPlay,
      enterEdit,
      recordNewScenario,
      tPalette,
      markExported,
    ],
  );

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const files = [...event.dataTransfer.files];
    const relevant = files.filter((f) => isAuthprintFile(f.name) || isLayoutSidecarFile(f.name));
    if (relevant.length > 0) loadFiles(relevant);
  };

  const openPattern = useCallback(
    (pattern: PatternFlow) => {
      applySource(pattern.source, pattern.name);
    },
    [applySource],
  );

  return (
    <PlayerModeProvider value={player}>
      {phase === 'not-started' ? (
        <>
          <StartScreen
            patterns={patterns}
            dragging={dragging}
            onDragStateChange={setDragging}
            onDropFiles={onStartScreenDrop}
            onBlank={startBlank}
            onPattern={openPattern}
            onOpenDisk={openFilePicker}
            onResumeRecent={resumeRecent}
          />
          {notice && <NoticeToast notice={notice} onDismiss={() => setNotice(null)} />}
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />
        </>
      ) : (
        <div className="flex h-dvh w-full flex-col bg-bg-canvas">
          <Topbar
            flowName={flowName}
            onGoHome={goHome}
            onFlowNameClick={() => setDocPrefsOpen(true)}
            hasUnexportedChanges={hasUnexportedChanges}
          />
          {/* biome-ignore lint/a11y/noStaticElementInteractions: file drop zone; palette "Open file" is the keyboard equivalent. */}
          <div
            className="relative h-full min-h-0 flex-1"
            onDragOver={(e) => {
              e.preventDefault();
              if (!dragging) setDragging(true);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) setDragging(false);
            }}
            onDrop={onDrop}
          >
            <FlowCanvas key={revision} doc={doc} />

            {dragging && (
              <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-accent-primary/10 backdrop-blur-sm">
                <div className="rounded-xl border-2 border-accent-primary-border border-dashed bg-bg-panel/90 px-8 py-6 font-medium text-accent-primary-fg">
                  {tPalette('dropOverlay')}
                </div>
              </div>
            )}

            {notice && <NoticeToast notice={notice} onDismiss={() => setNotice(null)} />}

            <div className="absolute bottom-4 left-14 z-20 flex items-center gap-2">
              {!playerShellMode ? (
                <button
                  type="button"
                  onClick={playFirstScenario}
                  aria-label={
                    scenarios.length > 0
                      ? tPlayer('canvasPlay', { name: scenarios[0]?.name ?? '' })
                      : tPlayer('canvasPlayEmpty')
                  }
                  title={
                    scenarios.length > 0
                      ? tPlayer('canvasPlay', { name: scenarios[0]?.name ?? '' })
                      : tPlayer('canvasPlayEmpty')
                  }
                  className="flex shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-bg-panel/95 px-2.5 py-1.5 text-accent-primary-fg-emphasis text-sm shadow-lg backdrop-blur transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border dark:border-border-default dark:bg-bg-panel/95 dark:text-accent-primary-fg-on-bg"
                >
                  ▶
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-label={tPalette('openPalette')}
                className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-panel/95 px-2.5 py-1.5 text-fg-muted text-sm shadow-lg backdrop-blur transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border dark:border-border-default dark:bg-bg-panel/95"
              >
                {tPalette('searchButton')}
                <kbd className="rounded border border-border-default bg-bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-fg-subtle">
                  ⌘K
                </kbd>
              </button>
            </div>

            {playerShellMode ? (
              <PlayerMode onRevealOnCanvas={revealOnCanvas} onNewScenario={recordNewScenario} />
            ) : null}

            <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />
            <DocumentPreferencesModal
              open={docPrefsOpen}
              onOpenChange={setDocPrefsOpen}
              flowName={flowName}
              flowTheme={flowTheme}
              companyName={flowBranding.companyName}
              primaryColor={flowBranding.primaryColor}
              onFlowNameChange={(name) => setFlowName(doc, name)}
              onFlowThemeChange={(theme) => setFlowTheme(doc, theme)}
              onCompanyNameChange={(name) => setCompanyName(doc, name)}
              onPrimaryColorChange={(color) => setPrimaryColor(doc, color)}
            />
          </div>
        </div>
      )}
      <AboutModal open={aboutOpen} onOpenChange={setAboutOpen} />
      <UnexportedChangesConfirmDialog
        open={replaceConfirmOpen}
        onOpenChange={setReplaceConfirmOpen}
        onConfirm={confirmReplace}
      />
    </PlayerModeProvider>
  );
}

// elkjs auto-layout, preserved across edits. We run elk only for nodes that have
// no coordinates yet — everything on first load, and any freshly-added node
// later (E26). A delete or a move never leaves a node unplaced, so layout is NOT
// recomputed for them: the surviving nodes keep their positions, the graph
// doesn't reflow, and — because the hook stops returning null after the first
// layout — `FlowCanvas` never unmounts, so the mount-only `fitView` doesn't
// re-fire. (Previously any structural change re-ran elk and briefly returned
// null, which remounted the canvas and reset the zoom on every delete.)
//
// Returns null only until the very first layout resolves, so the caller holds
// the canvas off rather than painting against empty coordinates.
function useElkLayout(
  flow: Flow,
  layout: NodePositionsMap,
  edgeLayout: import('./ydoc/schema.ts').EdgeRoutes,
): NodePositionsMap | null {
  // The effect reads the latest flow off a ref so it isn't a dependency — only
  // the set of unplaced nodes should trigger a (re)layout.
  const flowRef = useRef(flow);
  const edgeLayoutRef = useRef(edgeLayout);
  useEffect(() => {
    flowRef.current = flow;
    edgeLayoutRef.current = edgeLayout;
  }, [flow, edgeLayout]);

  const [positions, setPositions] = useState<NodePositionsMap | null>(null);

  // Sorted ids of nodes still missing coordinates — not yet laid out by elk AND
  // not manually placed (the layout map). A node created via the `+` / drag
  // already has a layout position, so it counts as placed and does NOT trigger a
  // full re-layout: the rest of the graph stays put and only the new node
  // appears where it was dropped. (Empty once everything is placed.)
  const unplaced = flow.nodes
    .filter(
      (node) => (!positions || positions[node.id] === undefined) && layout[node.id] === undefined,
    )
    .map((node) => node.id)
    .sort()
    .join(',');

  useEffect(() => {
    if (unplaced === '') return;
    let cancelled = false;
    layoutFlow(flowRef.current, edgeLayoutRef.current).then((next) => {
      if (!cancelled) setPositions(next);
    });
    return () => {
      cancelled = true;
    };
  }, [unplaced]);

  // Bundled imports place every node in the layout map — elk never runs, but the
  // canvas still needs a non-null map to merge with layout (US-066 regression).
  return elkLayoutReady(positions, unplaced);
}

type CreateMenu = {
  sourceId: string;
  sourceHandle: string | null;
  // How to place the new node: a `+` aligns it to the source along the handle's
  // axis; a drag drops it where the user released.
  placement:
    | { kind: 'aligned'; side: 'top' | 'right' | 'bottom' }
    | { kind: 'drop'; at: { x: number; y: number } };
};

// Gap (flow units) between a source node and the node its `+` creates.
const NEW_NODE_GAP = 80;

// Place a `+`-created node aligned to its source so the connecting edge reads
// cleanly into the new node's left (target) handle:
//   - right child: to the right, vertical centers level → straight horizontal.
//   - bottom child: below, with its left edge aligned to the source's RIGHT edge
//     so there's room for a clean down-then-right "L" (a smoothstep edge always
//     enters the target from its left handle, so a node directly below would
//     force the arrow to bend back on itself).
// The new node isn't measured yet, so its intrinsic NODE_SIZE seeds the offset.
function alignedNodePosition(
  source: RfNode | undefined,
  side: 'top' | 'right' | 'bottom',
  type: CreatableType,
): { x: number; y: number } {
  const { width, height } = NODE_SIZE[type];
  if (!source) return { x: 0, y: 0 };
  const src = source.type
    ? NODE_SIZE[source.type as keyof typeof NODE_SIZE]
    : { width: 0, height: 0 };
  const sw = source.measured?.width ?? src.width;
  const sh = source.measured?.height ?? src.height;
  const { x, y } = source.position;
  if (side === 'right') {
    return { x: x + sw + NEW_NODE_GAP, y: y + sh / 2 - height / 2 };
  }
  if (side === 'bottom') {
    return { x: x + sw, y: y + sh + NEW_NODE_GAP };
  }
  return { x: x + sw / 2 - width / 2, y: y - NEW_NODE_GAP - height };
}

function FlowCanvas({ doc }: { doc: Y.Doc }) {
  const {
    flow,
    layout,
    edgeLayout,
    onNodesChange: nodesToDoc,
    onEdgesChange: edgesToDoc,
  } = useYDocFlow(doc);
  const { theme: editorTheme } = useTheme();
  const autoPositions = useElkLayout(flow, layout, edgeLayout);
  const validation = useValidation(flow);
  const reconnectingEdgeId = useRef<string | null>(null);
  // Player mode makes the canvas read-only — no create / drag / delete / inline edit.
  const playerMode = useOptionalPlayerMode();
  const readOnly = playerMode?.shellMode != null;
  // Error outlines on the canvas are opt-in (off while building — the per-handle
  // `+` already hints at incompleteness; the Problems badge tracks the count).
  // Flip them on to review. Gates both node rings and edge recoloring.
  const [showOutlines, setShowOutlines] = useState(false);
  const { getNode, screenToFlowPosition } = useReactFlow();
  const [menu, setMenu] = useState<CreateMenu | null>(null);

  const setEdgeRouteOnDoc = useCallback(
    (edgeId: string, points: { x: number; y: number }[]) => {
      setEdgeRoute(doc, edgeId, points);
    },
    [doc],
  );

  // Dragged + freshly-created nodes (in the layout map) win over auto-placed.
  const graph = useMemo(() => {
    if (!autoPositions) return null;
    const base = flowToReactFlow(
      flow,
      { ...autoPositions, ...layoutPositionsOnly(layout) },
      edgeLayout,
      showOutlines ? validation : undefined,
      editorTheme,
      layout,
    );
    if (menu?.placement.kind !== 'aligned') return base;
    // Patch picker anchor into node data so React Flow re-renders the `+`.
    return {
      ...base,
      nodes: base.nodes.map((n) =>
        n.id === menu.sourceId
          ? { ...n, data: { ...n.data, pickerAnchorHandle: menu.sourceHandle } }
          : n,
      ),
    };
  }, [flow, layout, edgeLayout, autoPositions, menu, validation, showOutlines, editorTheme]);

  // A `+` was clicked: record the source handle side so the picker anchors to the
  // node (same placement as the inspector) and the new node aligns on pick.
  const openCreateMenu = useCallback<OpenCreateMenu>((sourceId, sourceHandle, _anchor, side) => {
    setMenu({
      sourceId,
      sourceHandle,
      placement: { kind: 'aligned', side },
    });
  }, []);

  const pickType = useCallback(
    (type: CreatableType) => {
      if (!menu) return;
      const position =
        menu.placement.kind === 'drop'
          ? screenToFlowPosition(menu.placement.at)
          : alignedNodePosition(getNode(menu.sourceId), menu.placement.side, type);
      createConnectedNode(doc, {
        sourceId: menu.sourceId,
        sourceHandle: menu.sourceHandle,
        type,
        position,
      });
      setMenu(null);
    },
    [doc, menu, getNode, screenToFlowPosition],
  );

  // Drag-from-handle onto an existing node → connect only (no new node).
  const onConnect = useCallback<OnConnect>(
    (c: Connection) => {
      connectNodes(doc, { sourceId: c.source, sourceHandle: c.sourceHandle, targetId: c.target });
    },
    [doc],
  );

  // Drag-from-handle released on empty canvas → open the picker there and create
  // a node connected to the drag's source handle. (A drop on a node connects via
  // `onConnect` and leaves `isValid` true, so we skip those here.)
  const onConnectEnd = useCallback<OnConnectEnd>(
    (event, state: FinalConnectionState) => {
      if (state.isValid || !state.fromNode) return;
      const fromType = flow.nodes.find((n) => n.id === state.fromNode?.id)?.type;
      if (
        !fromType ||
        !resolveCreateFromHandle(
          fromType,
          state.fromNode.id,
          state.fromHandle?.id ?? null,
          flow.edges,
        )
      ) {
        return;
      }
      const onPane = (event.target as Element | null)?.classList?.contains('react-flow__pane');
      if (!onPane) return;
      const point =
        'changedTouches' in event
          ? { x: event.changedTouches[0]?.clientX ?? 0, y: event.changedTouches[0]?.clientY ?? 0 }
          : { x: event.clientX, y: event.clientY };
      setMenu({
        sourceId: state.fromNode.id,
        sourceHandle: state.fromHandle?.id ?? null,
        placement: { kind: 'drop', at: point },
      });
    },
    [flow.nodes, flow.edges],
  );

  const isValidConnection = useCallback<IsValidConnection>(
    (c) =>
      validateConnection(flow, c, {
        reconnectingEdgeId: reconnectingEdgeId.current ?? undefined,
      }),
    [flow],
  );

  const onReconnectDoc = useCallback(
    (oldEdge: RfEdge, connection: Connection): boolean => {
      if (!connection.source || !connection.target) return false;
      return applyEdgeReconnect(doc, flow, edgeLayout, oldEdge.id, {
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
      });
    },
    [doc, flow, edgeLayout],
  );

  const onReconnectStart = useCallback((_event: React.MouseEvent, edge: RfEdge) => {
    reconnectingEdgeId.current = edge.id;
  }, []);

  const onReconnectEnd = useCallback(() => {
    reconnectingEdgeId.current = null;
  }, []);

  // Double-click a node → node-anchored inspector (Entry has nothing to edit).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edgeEditor, setEdgeEditor] = useState<{
    edgeId: string;
    at: { x: number; y: number };
  } | null>(null);

  const openEdgeTriggerEditor = useCallback(
    (edgeId: string, at: { x: number; y: number }) => {
      const edge = flow.edges.find((e) => e.id === edgeId);
      if (!edge || !isEditableEdgeTrigger(edge.trigger)) return;
      setEditingId(null);
      setEdgeEditor({ edgeId, at });
    },
    [flow.edges],
  );

  const onNodeDoubleClick = useCallback<NodeMouseHandler>((_event, node) => {
    if (node.type === 'entry') return;
    setEdgeEditor(null);
    setEditingId(node.id);
  }, []);

  const onNodeActivate = useCallback(
    (nodeId: string) => {
      const target = flow.nodes.find((n) => n.id === nodeId);
      if (!target || target.type === 'entry') return;
      setEdgeEditor(null);
      setEditingId(nodeId);
    },
    [flow.nodes],
  );

  const edgeTriggerActions = useMemo<EdgeTriggerActions>(
    () => ({
      setTrigger: (id, trigger) => setEdgeTrigger(doc, id, trigger),
      swapWithSibling: (id, siblingId) => swapEdgeTriggers(doc, id, siblingId),
    }),
    [doc],
  );

  const editActions = useMemo<NodeEditActions>(
    () => ({
      setName: (id, v) => setNodeName(doc, id, v),
      setKind: (id, v) => setNodeKind(doc, id, v),
      setErrorMessage: (id, v) => setNodeErrorMessage(doc, id, v),
      setFidelity: (id, v) => setScreenFidelity(doc, id, v),
      setTraits: (id, v) => setScreenTraits(doc, id, v),
      setFields: (id, v) => setScreenFields(doc, id, v),
      setPredicate: (id, p) => setDecisionPredicate(doc, id, p),
      declareSlot: (name, slot) => declareContextSlot(doc, name, slot),
      setDisplayErrorState: (id, display) => {
        const rfNode = getNode(id);
        const pos = rfNode?.position ??
          layoutPositionsOnly(layout)[id] ??
          autoPositions?.[id] ?? { x: 0, y: 0 };
        setScreenDisplayErrorState(doc, id, display, pos);
      },
    }),
    [doc, getNode, layout, autoPositions],
  );

  const editingNode = editingId ? flow.nodes.find((n) => n.id === editingId) : undefined;

  const pickerPlacement = useMemo((): NodeTypePickerPlacement | null => {
    if (!menu) return null;
    return menu.placement.kind === 'aligned'
      ? { kind: 'node', sourceId: menu.sourceId, side: menu.placement.side }
      : { kind: 'point', at: menu.placement.at };
  }, [menu]);

  if (!graph) return null;

  return (
    // In scenario mode the `+` affordances vanish (HandlePlus renders nothing
    // without a create handler), reinforcing read-only.
    <EdgeRouteProvider setRoute={readOnly ? null : setEdgeRouteOnDoc}>
      <EdgeTriggerProvider openEditor={readOnly ? null : openEdgeTriggerEditor}>
        <NodeActivateProvider value={readOnly ? null : onNodeActivate}>
          <NodeCreateProvider value={readOnly ? null : openCreateMenu}>
            <BoundCanvas
              graph={graph}
              nodesToDoc={nodesToDoc}
              edgesToDoc={edgesToDoc}
              onConnect={onConnect}
              onConnectEnd={onConnectEnd}
              onReconnectDoc={onReconnectDoc}
              onReconnectStart={onReconnectStart}
              onReconnectEnd={onReconnectEnd}
              isValidConnection={isValidConnection}
              onNodeDoubleClick={readOnly ? undefined : onNodeDoubleClick}
              readOnly={readOnly}
            />
            <StatusCluster>
              <ProblemsPanel
                validation={validation}
                showOutlines={showOutlines}
                onToggleOutlines={() => setShowOutlines((v) => !v)}
              />
            </StatusCluster>
            {!readOnly && pickerPlacement && (
              <NodeTypePicker
                placement={pickerPlacement}
                onPick={pickType}
                onClose={() => setMenu(null)}
              />
            )}
            {!readOnly && editingId && editingNode && (
              <NodeInspector
                key={editingId}
                nodeId={editingId}
                node={editingNode}
                onClose={() => setEditingId(null)}
              >
                <NodeInlineEditor
                  node={editingNode}
                  context={flow.context}
                  actions={editActions}
                  screenLayout={layout[editingId]}
                />
              </NodeInspector>
            )}
            {!readOnly && edgeEditor && (
              <EdgeTriggerEditor
                key={edgeEditor.edgeId}
                edgeId={edgeEditor.edgeId}
                flow={flow}
                anchorAt={edgeEditor.at}
                actions={edgeTriggerActions}
                onClose={() => setEdgeEditor(null)}
              />
            )}
          </NodeCreateProvider>
        </NodeActivateProvider>
      </EdgeTriggerProvider>
    </EdgeRouteProvider>
  );
}

// Mounted only once coordinates are ready, so its local node/edge state seeds
// with the full graph and `fitView` fits real bounds on the first frame. Holds
// React Flow's interactive state locally (smooth drag) while mirroring every
// change into the Y.Doc; external Y.Doc changes flow back via the `graph` prop.
function BoundCanvas({
  graph,
  nodesToDoc,
  edgesToDoc,
  onConnect,
  onConnectEnd,
  onReconnectDoc,
  onReconnectStart,
  onReconnectEnd,
  isValidConnection,
  onNodeDoubleClick,
  readOnly,
}: {
  graph: ReturnType<typeof flowToReactFlow>;
  nodesToDoc: OnNodesChange<RfNode<CanvasNodeData>>;
  edgesToDoc: OnEdgesChange;
  onConnect: OnConnect;
  onConnectEnd: OnConnectEnd;
  onReconnectDoc: (oldEdge: RfEdge, connection: Connection) => boolean;
  onReconnectStart: (event: React.MouseEvent, edge: RfEdge) => void;
  onReconnectEnd: () => void;
  isValidConnection: IsValidConnection;
  onNodeDoubleClick?: NodeMouseHandler;
  /** Player mode (US-110): disable all editing; pan/zoom stay live. */
  readOnly?: boolean;
}) {
  const [nodes, setNodes, onNodesChangeLocal] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChangeLocal] = useEdgesState(graph.edges);
  const { theme: editorTheme } = useTheme();

  // Reconcile before paint so a layout-only graph refresh (edge route commit,
  // node drag end) doesn't replace every node object and remeasure handles.
  useLayoutEffect(() => {
    setNodes((current) => reconcileFlowNodes(current, graph.nodes));
  }, [graph.nodes, setNodes]);
  useLayoutEffect(() => {
    setEdges((current) => reconcileFlowEdges(current, graph.edges));
  }, [graph.edges, setEdges]);

  const onNodesChange = useCallback<OnNodesChange<RfNode<CanvasNodeData>>>(
    (changes) => {
      onNodesChangeLocal(changes); // local echo: smooth drag + selection
      nodesToDoc(changes); // commit move-on-end / delete to the doc
    },
    [onNodesChangeLocal, nodesToDoc],
  );
  const onEdgesChange = useCallback<OnEdgesChange>(
    (changes) => {
      onEdgesChangeLocal(changes);
      edgesToDoc(changes);
    },
    [onEdgesChangeLocal, edgesToDoc],
  );

  const onReconnect = useCallback<OnReconnect>(
    (oldEdge, connection) => {
      if (onReconnectDoc(oldEdge, connection)) {
        setEdges((eds) => reconnectEdge(oldEdge, connection, eds));
      }
    },
    [onReconnectDoc, setEdges],
  );

  return (
    <ReactFlow
      className="h-full w-full"
      colorMode={editorTheme}
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onConnectEnd={onConnectEnd}
      onReconnect={onReconnect}
      onReconnectStart={onReconnectStart}
      onReconnectEnd={onReconnectEnd}
      isValidConnection={isValidConnection}
      edgesReconnectable={!readOnly}
      reconnectRadius={24}
      onNodeDoubleClick={onNodeDoubleClick}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodesDraggable={!readOnly}
      nodesConnectable={!readOnly}
      elementsSelectable={!readOnly}
      deleteKeyCode={readOnly ? null : ['Delete', 'Backspace']}
      defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
      fitView
      fitViewOptions={FIT_VIEW_OPTIONS}
      // Default minZoom (0.5) is too high to fit wide flows — a long
      // sequence needs to zoom further out, else fitView clips the ends.
      minZoom={0.1}
      attributionPosition="bottom-center"
    >
      <Background gap={24} size={1} />
      <Controls position="bottom-left" showInteractive={false} />
    </ReactFlow>
  );
}
