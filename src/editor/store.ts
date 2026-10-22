import { computed, reactive } from 'vue';
import {
  clone,
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
});
let past: SceneDocument[] = [],
  future: SceneDocument[] = [];
export const selected = computed(() => state.doc.nodes[state.selected]);
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
    if (JSON.stringify(valid) === JSON.stringify(before)) return;
    past.push(before);
    if (past.length > 80) past.shift();
    future = [];
    state.doc = valid;
    changed();
  } catch (e) {
    log((e as Error).message, '오류');
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
  changed();
}
export function redo() {
  if (!future.length) return;
  stop();
  past.push(clone(state.doc));
  state.doc = future.pop()!;
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
  log('기본 Transform과 연출 정의를 JSON으로 내보냈습니다. 게임 연결 검증은 별도입니다.');
}
export async function importFile(file?: File) {
  if (!file) return;
  if (state.dirty && !confirm('저장하지 않은 변경이 있습니다. 버리고 불러올까요?')) return;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('10MB 이하 문서만 열 수 있습니다.');
    loadDocument(JSON.parse(await file.text()));
  } catch (e) {
    log((e as Error).message, '오류');
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
