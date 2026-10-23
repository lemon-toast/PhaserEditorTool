import { computed, reactive } from 'vue';
import {
  clone,
  ensureScreen,
  layoutData,
  switchLayoutMode,
  createNode,
  demoDocument,
  evaluate,
  parentOf,
  reparent,
  validateDocument,
  type Kind,
  type SceneDocument,
  type SceneNode,
} from '../core/document';
import { convertSlotLayout } from '../adapters/slotClient';
import { exportSlotDocument } from '../integration/exportSlot';
import { validateSlotPackage } from '../integration/slotRuntime';
import type { EditorProject, ProjectScene } from '../core/projects';
import { alignOrigins } from '../core/placement';

export interface Asset {
  kind: 'image' | 'spine';
  file: string;
  name: string;
  atlas?: string;
  animations?: string[];
  skins?: string[];
  version?: string;
}
const initial = demoDocument();
export const state = reactive({
  doc: initial,
  selected: 'title',
  selection: [] as string[],
  snapEnabled: false,
  snapSize: 10,
  revision: 0,
  saved: JSON.stringify(initial),
  assets: [] as Asset[],
  project: '',
  loading: false,
  logs: [] as { time: string; level: string; message: string }[],
  playing: true,
  timeline: false,
  time: 0,
  speed: 1,
  loop: true,
  animationId: 'winner',
  reset: 0,
  dirty: false,
  canUndo: false,
  canRedo: false,
  projectPickerOpen: true,
  hasOpenDocument: false,
  activeProject: null as EditorProject | null,
  activeScene: null as ProjectScene | null,
});
let past: SceneDocument[] = [],
  future: SceneDocument[] = [];
export const selected = computed(() => state.doc.nodes[state.selected]);
export const selectedIds = computed(() =>
  (state.selection.includes(state.selected) ? state.selection : [state.selected]).filter(
    (id) => !!state.doc.nodes[id],
  ),
);
export function selectNode(id: string, toggle = false) {
  const ids = toggle ? [...selectedIds.value] : [];
  const index = ids.indexOf(id);
  if (index >= 0) ids.splice(index, 1);
  else if (state.doc.nodes[id]) ids.push(id);
  state.selection = ids;
  state.selected = ids[ids.length - 1] || '';
}
export function alignSelection(axis: 'x' | 'y') {
  edit((doc) => alignOrigins(doc, selectedIds.value, axis, state.selected));
}
export const animation = computed(() =>
  state.doc.animations.find((a) => a.id === state.animationId),
);
export const renderedDocument = () =>
  state.timeline ? evaluate(state.doc, state.animationId, state.time) : state.doc;
export function log(message: string, level = '정보') {
  state.logs.push({ time: new Date().toLocaleTimeString('ko-KR'), level, message });
  if (state.logs.length > 200) state.logs.shift();
}
function changed() {
  state.revision++;
  state.dirty = JSON.stringify(state.doc) !== state.saved;
  state.canUndo = past.length > 0;
  state.canRedo = future.length > 0;
}
export function stop() {
  state.playing = false;
  state.timeline = false;
  state.time = 0;
  state.reset++;
}
export function edit(action: (doc: SceneDocument) => void) {
  if (state.timeline) stop();
  const before = clone(state.doc),
    draft = clone(state.doc);
  try {
    action(draft);
    const valid = validateDocument(draft);
    if (JSON.stringify(valid) === JSON.stringify(before)) return true;
    past.push(before);
    if (past.length > 80) past.shift();
    future = [];
    state.doc = valid;
    changed();
    return true;
  } catch (e) {
    log((e as Error).message, '오류');
    return false;
  }
}
export function selectLayoutMode(id: string) {
  if (id === state.doc.screen?.activeMode) return;
  stop();
  state.selection = [];
  if (edit((doc) => switchLayoutMode(doc, id))) {
    state.selected = state.doc.roots[0] || '';
    state.animationId = state.doc.animations[0]?.id || '';
  }
}
export function patchNode(id: string, action: (node: SceneNode) => void) {
  edit((doc) => {
    if (doc.nodes[id]) action(doc.nodes[id]);
  });
}
export function undo() {
  if (!past.length) return;
  stop();
  future.push(clone(state.doc));
  state.doc = past.pop()!;
  if (!state.doc.nodes[state.selected]) state.selected = '';
  if (!state.doc.animations.some((a) => a.id === state.animationId))
    state.animationId = state.doc.animations[0]?.id || '';
  changed();
}
export function redo() {
  if (!future.length) return;
  stop();
  past.push(clone(state.doc));
  state.doc = future.pop()!;
  if (!state.doc.nodes[state.selected]) state.selected = '';
  if (!state.doc.animations.some((a) => a.id === state.animationId))
    state.animationId = state.doc.animations[0]?.id || '';
  changed();
}
export function add(kind: Kind, asset?: Asset) {
  const n = createNode(kind);
  if (asset) {
    n.name = asset.name;
    n.asset = asset.file;
    n.atlas = asset.atlas;
    n.animation = asset.animations?.[0] || '';
  }
  const parent = selected.value?.kind === 'group' ? selected.value.id : undefined;
  if (!parent) {
    n.transform.x = state.doc.designSize.width / 2;
    n.transform.y = state.doc.designSize.height / 2;
  }
  edit((doc) => {
    doc.nodes[n.id] = n;
    (parent ? doc.nodes[parent].children : doc.roots).push(n.id);
  });
  state.selected = n.id;
}
export function remove() {
  const id = state.selected;
  if (!state.doc.nodes[id]) return;
  edit((doc) => {
    const ids = new Set<string>();
    const walk = (id: string) => {
      ids.add(id);
      doc.nodes[id].children.forEach(walk);
    };
    walk(id);
    const p = parentOf(doc, id),
      list = p ? doc.nodes[p].children : doc.roots;
    list.splice(list.indexOf(id), 1);
    ids.forEach((id) => delete doc.nodes[id]);
    doc.animations.forEach((a) => (a.tracks = a.tracks.filter((t) => !ids.has(t.target))));
  });
  state.selected = '';
}
export function moveParent(parent: string) {
  const id = state.selected;
  edit((doc) => reparent(doc, id, parent || undefined));
}
export function reorder(offset: number) {
  const id = state.selected;
  edit((doc) => {
    const p = parentOf(doc, id),
      list = p ? doc.nodes[p].children : doc.roots,
      i = list.indexOf(id),
      to = i + offset;
    if (i >= 0 && to >= 0 && to < list.length) {
      list.splice(i, 1);
      list.splice(to, 0, id);
    }
  });
}
export function duplicate() {
  const source = state.selected;
  if (!state.doc.nodes[source]) return;
  let newId = '';
  edit((doc) => {
    const copy = (id: string): string => {
      const n = clone(doc.nodes[id]);
      n.id = crypto.randomUUID();
      n.children = n.children.map(copy);
      doc.nodes[n.id] = n;
      return n.id;
    };
    newId = copy(source);
    doc.nodes[newId].name += ' 복사';
    doc.nodes[newId].transform.x += 20;
    const p = parentOf(doc, source);
    (p ? doc.nodes[p].children : doc.roots).push(newId);
  });
  if (newId) state.selected = newId;
}
export function loadDocument(input: unknown) {
  const doc = validateDocument(input);
  stop();
  state.selection = [];
  state.doc = doc;
  state.selected = doc.roots[0] || '';
  state.animationId = doc.animations[0]?.id || '';
  past = [];
  future = [];
  state.saved = JSON.stringify(doc);
  changed();
  log('장면을 불러왔습니다.');
}
export function download() {
  const doc = validateDocument(state.doc),
    blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = `${doc.name.replace(/[<>:"/\\|?*]/g, '_')}.scene.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  state.saved = JSON.stringify(doc);
  state.dirty = false;
  log('에디터 작업을 .scene.json 파일로 저장했습니다.');
}
export async function importFile(file?: File, kind: 'work' | 'data' = 'work') {
  if (!file) return;
  if (state.dirty && !confirm('저장하지 않은 변경이 있습니다. 버리고 불러올까요?')) return;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('10MB 이하 문서만 열 수 있습니다.');
    const input = JSON.parse(await file.text());
    const isPackage = input?.format === 'phaser-editor/slot-layout';
    if (kind === 'work' && isPackage)
      throw new Error('게임 데이터 파일입니다. 데이터 Import를 사용하세요.');
    if (kind === 'data' && !isPackage)
      throw new Error(
        '지원하는 게임 데이터 패키지가 아닙니다. 에디터 문서는 작업 불러오기를 사용하세요.',
      );
    loadDocument(isPackage ? validateSlotPackage(input).editorDocument : input);
    if (kind === 'data') {
      state.saved = '';
      state.dirty = true;
      log('게임 데이터를 작업으로 가져왔습니다. 작업 저장으로 편집 문서를 보관하세요.');
    }
  } catch (e) {
    log((e as Error).message, '오류');
  }
}
export function downloadGamePackage() {
  try {
    const pack = exportSlotDocument(state.doc),
      url = URL.createObjectURL(
        new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' }),
      );
    const a = document.createElement('a');
    a.href = url;
    a.download = `editor.${pack.orientation}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    log(
      `게임용 내보내기 완료: ${pack.patches.length}개 배치 수정. SlotClient의 games/SLOT_1002/layout에 넣고 새로고침하세요.`,
    );
  } catch (error) {
    log((error as Error).message, '오류');
  }
}
export async function applyToSlotGame() {
  try {
    const pack = exportSlotDocument(state.doc);
    const r = await fetch('/api/slot-game-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Editor-Request': '1' },
        body: JSON.stringify(pack),
      }),
      data = await r.json();
    if (!r.ok) throw new Error(data.error);
    log(
      `SlotClient에 ${data.patches}개 수정 저장 완료. 게임을 새로고침하면 적용됩니다. 기존 파일은 .bak으로 보관합니다.`,
    );
  } catch (error) {
    log((error as Error).message, '오류');
  }
}
export async function importGamePackage() {
  if (state.dirty && !confirm('수정한 장면을 버리고 게임 적용본을 열까요?')) return;
  try {
    const orientation =
      state.doc.designSize.width >= state.doc.designSize.height ? 'landscape' : 'portrait';
    const r = await fetch(`/api/slot-game-package?orientation=${orientation}`),
      data = await r.json();
    if (!r.ok) throw new Error(data.error);
    loadDocument(validateSlotPackage(data).editorDocument);
    state.saved = '';
    state.dirty = true;
    log('게임 적용본을 작업으로 가져왔습니다. 작업 저장이 필요합니다.');
  } catch (error) {
    log((error as Error).message, '오류');
  }
}
export async function refreshAssets() {
  state.loading = true;
  try {
    const r = await fetch('/api/catalog');
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    state.assets = data.assets;
    state.project = data.root;
    log(`에셋 ${state.assets.length}개 연결 완료`);
  } catch (e) {
    log((e as Error).message, '오류');
  } finally {
    state.loading = false;
  }
}
export async function connectProject(root: string) {
  try {
    const r = await fetch('/api/project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Editor-Request': '1' },
      body: JSON.stringify({ root }),
    });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error);
    state.reset++;
    await refreshAssets();
  } catch (e) {
    log((e as Error).message, '오류');
  }
}
export async function importSlotLayout() {
  if (state.dirty && !confirm('수정한 장면을 버리고 SlotClient 배치를 불러올까요?')) return;
  try {
    const orientation =
      state.doc.designSize.width >= state.doc.designSize.height ? 'landscape' : 'portrait';
    const r = await fetch(`/api/slot-layout?orientation=${orientation}`),
      data = await r.json();
    if (!r.ok) throw new Error(data.error);
    loadDocument(convertSlotLayout(data));
    state.playing = true;
    log(
      'SlotClient 배치 가져오기 완료. 릴·금액은 샘플이며 메뉴·팝업·게임 이벤트·expand 화면 맞춤은 아직 연결되지 않았습니다.',
    );
  } catch (e) {
    log((e as Error).message, '오류');
  }
}
export async function openProjectScene(
  project: EditorProject | undefined,
  scene: ProjectScene | undefined,
  mode: 'original' | 'applied' | 'example' = 'original',
) {
  if (state.dirty && !confirm('저장하지 않은 변경이 있습니다. 버리고 선택한 화면을 열까요?'))
    return false;
  const previousRoot = state.project;
  try {
    let assets: Asset[] = [],
      root = '';
    if (scene) {
      const response = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Editor-Request': '1' },
        body: JSON.stringify({ root: scene.assetRoot }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const catalog = await fetch('/api/catalog'),
        data = await catalog.json();
      if (!catalog.ok) throw new Error(data.error);
      assets = data.assets;
      root = data.root;
    }
    let doc: SceneDocument;
    if (mode === 'example') doc = demoDocument();
    else if (scene?.kind === 'slot-layout') {
      const url = mode === 'applied' ? '/api/slot-game-package' : '/api/slot-layout';
      const response = await fetch(`${url}?orientation=${scene.orientation}`),
        data = await response.json();
      if (!response.ok) throw new Error(data.error);
      doc =
        mode === 'applied'
          ? validateDocument(validateSlotPackage(data).editorDocument)
          : convertSlotLayout(data);
    } else
      doc = {
        schemaVersion: 1,
        id: crypto.randomUUID(),
        name: `${project?.name || '새 프로젝트'} · 에셋 작업 화면`,
        designSize: { width: 1280, height: 720 },
        roots: [],
        nodes: {},
        animations: [],
      };
    if (mode === 'original' && scene?.kind === 'slot-layout' && project) {
      const screen = ensureScreen(doc);
      screen.modes[0].name = scene.orientation === 'landscape' ? '가로' : '세로';
      for (const other of project.scenes.filter(
        (s) => s.kind === 'slot-layout' && s.id !== scene.id,
      )) {
        try {
          const response = await fetch(`/api/slot-layout?orientation=${other.orientation}`);
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);
          screen.modes.push({
            id: other.id,
            name: other.orientation === 'landscape' ? '가로' : '세로',
            layout: layoutData(convertSlotLayout(data)),
          });
        } catch (error) {
          log(`추가 배치 모드를 열지 못했습니다: ${(error as Error).message}`, '경고');
        }
      }
      if (screen.modes.length > 1) screen.behavior = 'responsive';
    }
    loadDocument(doc);
    state.assets = assets;
    state.project = root;
    state.activeProject = project || null;
    state.activeScene = scene || null;
    state.hasOpenDocument = true;
    state.projectPickerOpen = false;
    state.playing = true;
    if (project)
      try {
        const recent: string[] = JSON.parse(localStorage.getItem('projects:recent') || '[]');
        localStorage.setItem(
          'projects:recent',
          JSON.stringify([project.root, ...recent.filter((p) => p !== project.root)].slice(0, 8)),
        );
      } catch {
        /* 최근 목록 오류는 프로젝트 열기를 막지 않습니다. */
      }
    log(
      `${project?.name || '예제'} · ${mode === 'example' ? '승자승 연출' : scene?.name || '빈 화면'} 열기 완료`,
    );
    return true;
  } catch (error) {
    if (previousRoot)
      await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Editor-Request': '1' },
        body: JSON.stringify({ root: previousRoot }),
      }).catch(() => {});
    throw error;
  }
}
export function playTimeline() {
  if (!animation.value) return;
  if (!state.timeline || state.time >= animation.value.duration) {
    state.time = 0;
    state.reset++;
  }
  state.timeline = true;
  state.playing = true;
}
export function advance(delta: number) {
  if (!state.playing || !state.timeline || !animation.value) return;
  const time = state.time + delta * state.speed;
  if (time >= animation.value.duration) {
    if (state.loop) {
      state.time = time % animation.value.duration;
      state.reset++;
    } else {
      state.time = animation.value.duration;
      state.playing = false;
    }
  } else state.time = time;
}
