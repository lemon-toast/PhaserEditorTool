export type Kind = 'group' | 'image' | 'spine' | 'particle' | 'text';
export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  alpha: number;
}
export interface SceneNode {
  id: string;
  name: string;
  kind: Kind;
  children: string[];
  activeSelf: boolean;
  transform: Transform;
  asset?: string;
  atlas?: string;
  width: number;
  height: number;
  originX: number;
  originY: number;
  animation: string;
  skin: string;
  loop: boolean;
  text: string;
  color: string;
  slice?: [number, number, number, number];
  sliceScale?: number;
  sourcePath?: string;
  particle: {
    frequency: number;
    quantity: number;
    lifespan: number;
    speed: number;
    gravity: number;
    scale: number;
  };
}
export type Property = 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation' | 'alpha';
export interface Track {
  target: string;
  property: Property;
  start: number;
  duration: number;
  from: number;
  to: number;
}
export interface Animation {
  id: string;
  name: string;
  duration: number;
  tracks: Track[];
}
export interface SceneDocument {
  schemaVersion: 1;
  id: string;
  name: string;
  designSize: { width: number; height: number };
  roots: string[];
  nodes: Record<string, SceneNode>;
  animations: Animation[];
}
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export function createNode(kind: Kind, name = ''): SceneNode {
  return {
    id: crypto.randomUUID(),
    name:
      name ||
      {
        group: '새 그룹',
        image: '새 이미지',
        spine: '새 Spine',
        particle: '새 파티클',
        text: '새 텍스트',
      }[kind],
    kind,
    children: [],
    activeSelf: true,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1 },
    width: 240,
    height: 160,
    originX: 0.5,
    originY: 0.5,
    animation: '',
    skin: '',
    loop: true,
    text: 'WINNER',
    color: kind === 'image' ? '#ffffff' : '#f6d78b',
    particle: { frequency: 65, quantity: 3, lifespan: 1400, speed: 170, gravity: 100, scale: 0.6 },
  };
}
export function demoDocument(): SceneDocument {
  const group = createNode('group', '승자승 이벤트');
  group.id = 'winner';
  const sparks = createNode('particle', '폭죽');
  sparks.id = 'fireworks';
  sparks.transform.x = 640;
  sparks.transform.y = 240;
  const popup = createNode('group', '승리 팝업');
  popup.id = 'popup';
  popup.transform.x = 640;
  popup.transform.y = 330;
  const title = createNode('text', '승리 문구');
  title.id = 'title';
  title.text = 'WINNER';
  title.height = 64;
  const amount = createNode('text', '획득 머니');
  amount.id = 'money';
  amount.text = '+ 1,000,000';
  amount.transform.y = 85;
  amount.height = 36;
  group.children = [sparks.id, popup.id];
  popup.children = [title.id, amount.id];
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: '승자승 연출 작업실',
    designSize: { width: 1280, height: 720 },
    roots: [group.id],
    nodes: Object.fromEntries([group, sparks, popup, title, amount].map((n) => [n.id, n])),
    animations: [
      {
        id: 'winner',
        name: '승자승 · 팝업과 획득 머니 이동',
        duration: 3600,
        tracks: [
          { target: 'popup', property: 'alpha', start: 0, duration: 600, from: 0, to: 1 },
          { target: 'popup', property: 'scaleX', start: 0, duration: 600, from: 0.7, to: 1 },
          { target: 'popup', property: 'scaleY', start: 0, duration: 600, from: 0.7, to: 1 },
          { target: 'money', property: 'x', start: 1800, duration: 1300, from: 0, to: 390 },
          { target: 'money', property: 'y', start: 1800, duration: 1300, from: 85, to: 280 },
          { target: 'money', property: 'alpha', start: 2900, duration: 500, from: 1, to: 0 },
        ],
      },
    ],
  };
}
export function parentOf(doc: SceneDocument, id: string) {
  return Object.values(doc.nodes).find((n) => n.children.includes(id))?.id;
}
export function activeInHierarchy(doc: SceneDocument, id: string): boolean {
  const n = doc.nodes[id];
  if (!n?.activeSelf) return false;
  const parent = parentOf(doc, id);
  return !parent || activeInHierarchy(doc, parent);
}
export function flatten(doc: SceneDocument): { node: SceneNode; depth: number }[] {
  const rows: { node: SceneNode; depth: number }[] = [];
  const walk = (ids: string[], depth: number) =>
    ids.forEach((id) => {
      rows.push({ node: doc.nodes[id], depth });
      walk(doc.nodes[id].children, depth + 1);
    });
  walk(doc.roots, 0);
  return rows;
}
function fail(message: string): never {
  throw new Error(`문서 오류: ${message}`);
}
function finite(value: unknown, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function safeAsset(value: unknown) {
  return (
    value === undefined ||
    (typeof value === 'string' &&
      !value.includes('..') &&
      !/^[\\/]|:|\\|[?#]/.test(value) &&
      value.length < 1000)
  );
}
export function validateDocument(value: unknown): SceneDocument {
  const d = value as SceneDocument;
  if (!d || d.schemaVersion !== 1) fail('지원하지 않는 버전입니다.');
  if (
    typeof d.id !== 'string' ||
    typeof d.name !== 'string' ||
    !d.designSize ||
    !finite(d.designSize.width, 1, 8192) ||
    !finite(d.designSize.height, 1, 8192)
  )
    fail('문서 이름 또는 해상도가 잘못되었습니다.');
  if (
    !d.nodes ||
    typeof d.nodes !== 'object' ||
    Array.isArray(d.nodes) ||
    !Array.isArray(d.roots) ||
    !Array.isArray(d.animations)
  )
    fail('장면 구성이 잘못되었습니다.');
  const ids = Object.keys(d.nodes);
  if (ids.length > 5000) fail('노드는 5,000개까지 지원합니다.');
  for (const id of ids) {
    const n = d.nodes[id];
    if (
      !n ||
      id !== n.id ||
      !id ||
      ['__proto__', 'constructor', 'prototype'].includes(id) ||
      !['group', 'image', 'spine', 'particle', 'text'].includes(n.kind)
    )
      fail('노드 ID 또는 타입이 잘못되었습니다.');
    if (
      typeof n.name !== 'string' ||
      typeof n.activeSelf !== 'boolean' ||
      !Array.isArray(n.children) ||
      !n.transform
    )
      fail(`${id}의 기본 속성이 잘못되었습니다.`);
    const t = n.transform;
    if (
      !['x', 'y', 'scaleX', 'scaleY', 'rotation'].every((k) =>
        finite(t[k as keyof Transform], -1e6, 1e6),
      ) ||
      !finite(t.alpha, 0, 1)
    )
      fail(`${id}의 Transform이 잘못되었습니다.`);
    if (
      !finite(n.width, 1, 8192) ||
      !finite(n.height, 1, 8192) ||
      !finite(n.originX, 0, 1) ||
      !finite(n.originY, 0, 1)
    )
      fail(`${id}의 크기 또는 원점이 잘못되었습니다.`);
    if (!safeAsset(n.asset) || !safeAsset(n.atlas)) fail('에셋은 프로젝트 상대 경로여야 합니다.');
    if (
      n.slice &&
      (!Array.isArray(n.slice) || n.slice.length !== 4 || !n.slice.every((v) => finite(v, 0, 8192)))
    )
      fail('9-slice 값이 잘못되었습니다.');
    if (n.sliceScale !== undefined && !finite(n.sliceScale, 0.01, 100))
      fail('9-slice 배율이 잘못되었습니다.');
    if (
      ![n.animation, n.skin, n.text].every((v) => typeof v === 'string') ||
      typeof n.loop !== 'boolean' ||
      !/^#[0-9a-f]{6}$/i.test(n.color)
    )
      fail(`${id}의 표시 속성이 잘못되었습니다.`);
    const p = n.particle;
    if (
      !p ||
      !finite(p.frequency, 1, 10000) ||
      !finite(p.quantity, 1, 100) ||
      !Number.isInteger(p.quantity) ||
      !finite(p.lifespan, 1, 10000) ||
      !finite(p.speed, 0, 2000) ||
      !finite(p.gravity, -2000, 2000) ||
      !finite(p.scale, 0.01, 10)
    )
      fail(`${id}의 파티클 설정이 잘못되었습니다.`);
  }
  const seen = new Set<string>();
  const walk = (list: string[], depth: number) => {
    if (depth > 100) fail('계층은 100단계까지 지원합니다.');
    for (const id of list) {
      if (typeof id !== 'string' || !Object.hasOwn(d.nodes, id)) fail('없는 노드를 참조합니다.');
      if (seen.has(id)) fail('순환 참조 또는 중복 부모가 있습니다.');
      seen.add(id);
      walk(d.nodes[id].children, depth + 1);
    }
  };
  walk(d.roots, 0);
  if (seen.size !== ids.length) fail('계층에 속하지 않은 노드가 있습니다.');
  const animationIds = new Set<string>();
  for (const a of d.animations) {
    if (
      !a ||
      typeof a.id !== 'string' ||
      !a.id ||
      animationIds.has(a.id) ||
      typeof a.name !== 'string' ||
      !finite(a.duration, 1, 60000) ||
      !Array.isArray(a.tracks) ||
      a.tracks.length > 5000
    )
      fail('연출 정의가 잘못되었습니다.');
    animationIds.add(a.id);
    for (const t of a.tracks) {
      if (
        !t ||
        !Object.hasOwn(d.nodes, t.target) ||
        !['x', 'y', 'scaleX', 'scaleY', 'rotation', 'alpha'].includes(t.property) ||
        !finite(t.start, 0, a.duration) ||
        !finite(t.duration, 1, a.duration) ||
        t.start + t.duration > a.duration ||
        !finite(t.from, -1e6, 1e6) ||
        !finite(t.to, -1e6, 1e6)
      )
        fail('연출 타깃 또는 시간이 잘못되었습니다.');
      if (t.property === 'alpha' && (!finite(t.from, 0, 1) || !finite(t.to, 0, 1)))
        fail('연출 투명도는 0~1이어야 합니다.');
    }
    for (let i = 0; i < a.tracks.length; i++)
      for (let j = i + 1; j < a.tracks.length; j++) {
        const x = a.tracks[i],
          y = a.tracks[j];
        if (
          x.target === y.target &&
          x.property === y.property &&
          Math.max(x.start, y.start) < Math.min(x.start + x.duration, y.start + y.duration)
        )
          fail('같은 속성의 연출 트랙이 겹칩니다.');
      }
  }
  return clone(d);
}
export function evaluate(doc: SceneDocument, animationId: string, time: number): SceneDocument {
  const result = clone(doc),
    a = result.animations.find((a) => a.id === animationId);
  if (a)
    for (const t of [...a.tracks].sort((a, b) => a.start - b.start)) {
      if (time < t.start) continue;
      const p = Math.max(0, Math.min(1, (time - t.start) / t.duration));
      const eased = p * p * (3 - 2 * p);
      result.nodes[t.target].transform[t.property] = t.from + (t.to - t.from) * eased;
    }
  return result;
}
export type Matrix = [number, number, number, number, number, number];
export function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
export function inverse(m: Matrix): Matrix {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-9) throw new Error('배율이 0인 부모로는 이동할 수 없습니다.');
  return [
    m[3] / det,
    -m[1] / det,
    -m[2] / det,
    m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det,
    (m[1] * m[4] - m[0] * m[5]) / det,
  ];
}
export function world(doc: SceneDocument, id?: string): Matrix {
  if (!id) return [1, 0, 0, 1, 0, 0];
  const t = doc.nodes[id].transform,
    r = (t.rotation * Math.PI) / 180;
  return multiply(world(doc, parentOf(doc, id)), [
    Math.cos(r) * t.scaleX,
    Math.sin(r) * t.scaleX,
    -Math.sin(r) * t.scaleY,
    Math.cos(r) * t.scaleY,
    t.x,
    t.y,
  ]);
}
export function reparent(doc: SceneDocument, id: string, parent?: string) {
  if (!doc.nodes[id] || (parent && !doc.nodes[parent])) throw new Error('없는 노드입니다.');
  for (let p = parent; p; p = parentOf(doc, p))
    if (p === id) throw new Error('자신이나 자손 아래로 이동할 수 없습니다.');
  const m = multiply(inverse(world(doc, parent)), world(doc, id));
  const sx = Math.hypot(m[0], m[1]);
  if (sx < 1e-9) throw new Error('배율이 0인 노드는 부모를 변경할 수 없습니다.');
  const sy = (m[0] * m[3] - m[1] * m[2]) / sx;
  if (Math.abs(m[0] * m[2] + m[1] * m[3]) > 1e-6 * Math.max(1, sx * Math.abs(sy)))
    throw new Error('이 변환은 기울어짐이 생겨 화면 위치를 보존할 수 없습니다.');
  const previous = parentOf(doc, id),
    list = previous ? doc.nodes[previous].children : doc.roots;
  list.splice(list.indexOf(id), 1);
  (parent ? doc.nodes[parent].children : doc.roots).push(id);
  Object.assign(doc.nodes[id].transform, {
    x: m[4],
    y: m[5],
    scaleX: sx,
    scaleY: sy,
    rotation: (Math.atan2(m[1], m[0]) * 180) / Math.PI,
  });
}
