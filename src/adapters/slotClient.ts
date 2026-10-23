import {
  clone,
  createNode,
  validateDocument,
  type SceneDocument,
  type SceneNode,
} from '../core/document';
import { layoutFingerprint } from '../integration/slotRuntime';

interface Art {
  file: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
  tint?: string;
  flipX?: boolean;
  flipY?: boolean;
  group?: string;
  slice?: [number, number, number, number];
  sliceScale?: number;
}
interface Spine {
  spine: string;
  x: number;
  y: number;
  scale?: number;
  animation?: string;
  idle?: string;
  flipX?: boolean;
}
interface Hud {
  x: number;
  y: number;
  width?: number;
  height?: number;
  skin?: {
    image?: string;
    icon?: string;
    iconSize?: number | [number, number];
    iconOffset?: [number, number];
    flipY?: boolean;
    slice?: [number, number, number, number];
  };
  effect?: Spine;
  meter?: {
    label: { text: string; x: number; y?: number; size: number; color?: string };
    value: { x: number; y?: number; size: number };
  };
}
interface SlotLayout {
  background?: Spine;
  featureBackground?: Spine;
  character?: Spine;
  art?: { back?: Art[]; front?: Art[] };
  reelSpines?: Spine[];
  hud: Record<string, Hud | number>;
  reels: { x: number; y: number; width: number; height: number };
  loading?: {
    art: Art[];
    texts: { text: string; x: number; y: number; size: number }[];
    button: Art[];
    bar: { track: Art; fill: Art };
  };
}
export function convertSlotLayout(raw: {
  layout: SlotLayout;
  designSize: { width: number; height: number };
}): SceneDocument {
  const doc: SceneDocument = {
    schemaVersion: 1,
    id: `SLOT_1002:${raw.designSize.width}`,
    name: `SLOT_1002 · ${raw.designSize.width > raw.designSize.height ? '가로' : '세로'} 배치`,
    designSize: raw.designSize,
    roots: [],
    nodes: {},
    animations: [],
  };
  const add = (n: SceneNode, id: string, parent?: string) => {
    n.id = id;
    n.sourcePath = id;
    doc.nodes[id] = n;
    (parent ? doc.nodes[parent].children : doc.roots).push(id);
    return n;
  };
  const group = (id: string, name: string, active = true) => {
    const n = createNode('group', name);
    n.activeSelf = active;
    return add(n, id);
  };
  const image = (a: Art, id: string, parent: string) => {
    const n = createNode('image', a.file.split('/').at(-1));
    n.asset = a.file;
    n.width = Math.max(1, a.width);
    n.height = Math.max(1, a.height);
    Object.assign(n.transform, {
      x: a.x,
      y: a.y,
      scaleX: a.flipX ? -1 : 1,
      scaleY: a.flipY ? -1 : 1,
      alpha: a.opacity ?? 1,
    });
    n.color = a.tint || '#ffffff';
    n.slice = a.slice;
    n.sliceScale = a.sliceScale;
    return add(n, id, parent);
  };
  const spine = (s: Spine, id: string, parent: string) => {
    const n = createNode('spine', s.spine.split('/').at(-1));
    n.asset = s.spine + '.json';
    n.atlas = s.spine + '.atlas';
    n.animation = s.animation || s.idle || '';
    Object.assign(n.transform, {
      x: s.x,
      y: s.y,
      scaleX: (s.scale ?? 1) * (s.flipX ? -1 : 1),
      scaleY: s.scale ?? 1,
    });
    return add(n, id, parent);
  };
  const text = (
    name: string,
    value: string,
    x: number,
    y: number,
    size: number,
    id: string,
    parent: string,
    color = '#ffffff',
  ) => {
    const n = createNode('text', name);
    n.text = value;
    n.transform.x = x;
    n.transform.y = y;
    n.height = size;
    n.color = color;
    return add(n, id, parent);
  };
  const l = raw.layout;
  group('background', '기본 배경');
  if (l.background) spine(l.background, 'background.spine', 'background');
  group('featureBackground', '프리스핀 배경', false);
  if (l.featureBackground)
    spine(l.featureBackground, 'featureBackground.spine', 'featureBackground');
  group('art.back', '릴 뒤 장식');
  l.art?.back?.forEach((a, i) => image(a, `art.back.${i}`, 'art.back'));
  group('reels', '릴 심볼 · 샘플');
  const symbols = [
    'symbols/H1.jpg',
    'symbols/H2.jpg',
    'symbols/H3.jpg',
    'symbols/H4.jpg',
    'symbols/BOOK.jpg',
  ];
  for (let col = 0; col < 5; col++)
    for (let row = 0; row < 3; row++) {
      const size = Math.min(l.reels.width / 5, l.reels.height / 3) * 0.85;
      image(
        {
          file: symbols[(col + row) % 5],
          x: l.reels.x + ((col - 2) * l.reels.width) / 5,
          y: l.reels.y + ((row - 1) * l.reels.height) / 3,
          width: size,
          height: size,
        },
        `reels.${col}.${row}`,
        'reels',
      );
    }
  group('character', '캐릭터');
  if (l.character) spine(l.character, 'character.spine', 'character');
  group('art.front', '릴 앞 장식');
  const feature = createNode('group', '프리스핀 제목');
  feature.activeSelf = false;
  add(feature, 'art.featureTitle', 'art.front');
  l.art?.front?.forEach((a, i) =>
    image(a, `art.front.${i}`, a.group === 'featureTitle' ? 'art.featureTitle' : 'art.front'),
  );
  group('reelSpines', '릴 Spine 효과');
  l.reelSpines?.forEach((s, i) => spine(s, `reelSpines.${i}`, 'reelSpines'));
  group('hud', 'HUD · 테스트 값');
  for (const [key, h] of Object.entries(l.hud)) {
    if (typeof h === 'number' || !h.skin?.image) continue;
    const g = createNode('group', key);
    g.transform.x = h.x;
    g.transform.y = h.y;
    add(g, `hud.${key}`, 'hud');
    image(
      {
        file: h.skin.image,
        x: 0,
        y: 0,
        width: h.width || 120,
        height: h.height || 100,
        flipY: h.skin.flipY,
        slice: h.skin.slice,
      },
      `hud.${key}.image`,
      g.id,
    );
    if (h.skin.icon) {
      const size = h.skin.iconSize || 80,
        offset = h.skin.iconOffset || [0, 0];
      image(
        {
          file: h.skin.icon,
          x: offset[0],
          y: offset[1],
          width: Array.isArray(size) ? size[0] : size,
          height: Array.isArray(size) ? size[1] : size,
        },
        `hud.${key}.icon`,
        g.id,
      );
    }
    if (h.meter) {
      const { label, value } = h.meter;
      text(
        '라벨',
        label.text,
        label.x,
        label.y || 0,
        label.size,
        `hud.${key}.label`,
        g.id,
        label.color,
      );
      text('테스트 금액', '1,000,000', value.x, value.y || 0, value.size, `hud.${key}.value`, g.id);
    }
    if (h.effect) spine(h.effect, `hud.${key}.effect`, 'hud');
  }
  if (l.loading) {
    group('loading', '로딩 화면', false);
    l.loading.art.forEach((a, i) => image(a, `loading.art.${i}`, 'loading'));
    image(l.loading.bar.track, 'loading.bar.track', 'loading');
    image(l.loading.bar.fill, 'loading.bar.fill', 'loading');
    l.loading.button.forEach((a, i) => image(a, `loading.button.${i}`, 'loading'));
    l.loading.texts.forEach((t, i) =>
      text('로딩 문구', t.text, t.x, t.y, t.size, `loading.text.${i}`, 'loading'),
    );
  }
  doc.source = {
    adapter: 'slot-client',
    gameCode: 'SLOT_1002',
    orientation: raw.designSize.width > raw.designSize.height ? 'landscape' : 'portrait',
    fingerprint: layoutFingerprint(raw.layout),
    designSize: clone(raw.designSize),
    baseline: clone({ roots: doc.roots, nodes: doc.nodes }),
  };
  return validateDocument(doc);
}
