// 게임과 에디터에서 공유합니다. 설치 스크립트로 SlotClient에 같은 파일을 배포합니다.
export interface Placement {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  alpha: number;
}
export interface SlotPatch {
  target: string;
  kind: 'image' | 'spine';
  asset: string;
  placement: Placement;
  active?: boolean;
  image?: { width: number; height: number; originX: number; originY: number; color: string };
  spine?: { animation: string; skin: string; loop: boolean };
}
export interface SlotPackage {
  format: 'phaser-editor/slot-layout';
  version: 1;
  gameCode: 'SLOT_1002';
  orientation: 'landscape' | 'portrait';
  designSize: { width: number; height: number };
  fingerprint: string;
  patches: SlotPatch[];
  editorDocument?: unknown;
}
type RecordValue = Record<string, unknown>;
function record(v: unknown): v is RecordValue {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
export function layoutFingerprint(input: unknown): string {
  const normalize = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(normalize);
    if (record(v))
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .filter((k) => v[k] !== undefined && typeof v[k] !== 'function')
          .map((k) => [k, normalize(v[k])]),
      );
    return v;
  };
  const text = JSON.stringify(normalize(input));
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16)}`;
}
export function bindingPath(target: string): (string | number)[] {
  const art = /^art\.(back|front)\.(\d+)$/.exec(target);
  if (art) return ['art', art[1]!, Number(art[2])];
  const reel = /^reelSpines\.(\d+)$/.exec(target);
  if (reel) return ['reelSpines', Number(reel[1])];
  if (target === 'background.spine') return ['background'];
  if (target === 'featureBackground.spine') return ['featureBackground'];
  if (target === 'character.spine') return ['character'];
  throw new Error(`현재 게임 적용을 지원하지 않는 대상입니다: ${target}`);
}
function at(input: unknown, path: (string | number)[]): RecordValue {
  let current: unknown = input;
  for (const k of path) {
    if ((!record(current) && !Array.isArray(current)) || !Object.hasOwn(current, k))
      throw new Error('원본 layout 대상이 없습니다.');
    current = (current as RecordValue)[k];
  }
  if (!record(current)) throw new Error('잘못된 layout 대상입니다.');
  return current;
}
export function validateSlotPackage(input: unknown): SlotPackage {
  if (
    !record(input) ||
    input.format !== 'phaser-editor/slot-layout' ||
    input.version !== 1 ||
    input.gameCode !== 'SLOT_1002' ||
    !['landscape', 'portrait'].includes(String(input.orientation))
  )
    throw new Error('지원하지 않는 게임 패키지입니다.');
  const size = input.designSize;
  if (
    !record(size) ||
    !['width', 'height'].every(
      (k) =>
        typeof size[k] === 'number' &&
        Number.isFinite(size[k]) &&
        (size[k] as number) > 0 &&
        (size[k] as number) <= 8192,
    ) ||
    typeof input.fingerprint !== 'string' ||
    !/^fnv1a:[0-9a-f]+$/.test(input.fingerprint) ||
    !Array.isArray(input.patches) ||
    input.patches.length > 1000
  )
    throw new Error('게임 패키지 크기 또는 버전 정보가 잘못되었습니다.');
  const seen = new Set<string>();
  for (const p of input.patches) {
    if (
      !record(p) ||
      typeof p.target !== 'string' ||
      seen.has(p.target) ||
      !['image', 'spine'].includes(String(p.kind)) ||
      typeof p.asset !== 'string' ||
      !p.asset ||
      p.asset.includes('..') ||
      /[\\:#?]/.test(p.asset) ||
      p.asset.startsWith('/')
    )
      throw new Error('잘못된 게임 바인딩입니다.');
    seen.add(p.target);
    bindingPath(p.target);
    const t = p.placement;
    if (
      !record(t) ||
      !['x', 'y', 'scaleX', 'scaleY', 'rotation', 'alpha'].every(
        (k) => typeof t[k] === 'number' && Number.isFinite(t[k]) && Math.abs(t[k] as number) <= 1e6,
      ) ||
      (t.alpha as number) < 0 ||
      (t.alpha as number) > 1 ||
      (p.active !== undefined && typeof p.active !== 'boolean')
    )
      throw new Error('게임 Transform이 잘못되었습니다.');
    if (p.kind === 'image') {
      const i = p.image;
      if (
        !record(i) ||
        !['width', 'height'].every(
          (k) =>
            typeof i[k] === 'number' &&
            Number.isFinite(i[k]) &&
            (i[k] as number) > 0 &&
            (i[k] as number) <= 8192,
        ) ||
        !['originX', 'originY'].every(
          (k) => typeof i[k] === 'number' && (i[k] as number) >= 0 && (i[k] as number) <= 1,
        ) ||
        typeof i.color !== 'string' ||
        !/^#[0-9a-f]{6}$/i.test(i.color) ||
        !p.target.startsWith('art.')
      )
        throw new Error('이미지 적용 정보가 잘못되었습니다.');
    } else {
      const s = p.spine;
      if (
        !record(s) ||
        typeof s.animation !== 'string' ||
        typeof s.skin !== 'string' ||
        typeof s.loop !== 'boolean' ||
        p.target.startsWith('art.')
      )
        throw new Error('Spine 적용 정보가 잘못되었습니다.');
    }
  }
  return input as unknown as SlotPackage;
}
function setCopy(root: RecordValue, path: (string | number)[], value: unknown): RecordValue {
  const [head, ...rest] = path;
  if (head === undefined) return root;
  const child = root[head];
  const copy: RecordValue = Array.isArray(root)
    ? ([...root] as unknown as RecordValue)
    : { ...root };
  copy[head] = rest.length ? setCopy(child as RecordValue, rest, value) : value;
  return copy;
}
export function applySlotPackage<T>(
  base: T,
  input: unknown,
  context: { gameCode: string; orientation: string; width: number; height: number },
): T {
  const pack = validateSlotPackage(input);
  if (
    pack.gameCode !== context.gameCode ||
    pack.orientation !== context.orientation ||
    pack.designSize.width !== context.width ||
    pack.designSize.height !== context.height
  )
    throw new Error('게임 또는 화면 방향·기준 해상도가 일치하지 않습니다.');
  if (layoutFingerprint(base) !== pack.fingerprint)
    throw new Error('원본 layout이 변경되었습니다. 에디터에서 다시 가져와 적용하세요.');
  // 모든 항목을 먼저 검증하여 잘못된 패키지의 부분 적용을 막습니다.
  const updates = pack.patches.map((p) => {
    const path = bindingPath(p.target),
      previous = at(base, path);
    if ((p.kind === 'image' ? previous.file : `${previous.spine}.json`) !== p.asset)
      throw new Error('원본 에셋 바인딩이 일치하지 않습니다.');
    const t = p.placement;
    if (p.kind === 'image')
      return {
        path,
        value: {
          ...previous,
          x: t.x,
          y: t.y,
          width: p.image!.width * Math.abs(t.scaleX),
          height: p.image!.height * Math.abs(t.scaleY),
          flipX: t.scaleX < 0,
          flipY: t.scaleY < 0,
          opacity: p.active === false ? 0 : t.alpha,
          tint: p.image!.color,
          rotation: t.rotation,
          originX: p.image!.originX,
          originY: p.image!.originY,
          editorTransform: true,
        },
      };
    if (p.active === false) return { path, value: undefined };
    const s = p.spine!;
    return {
      path,
      value: {
        ...previous,
        x: t.x,
        y: t.y,
        scaleX: t.scaleX,
        scaleY: t.scaleY,
        rotation: t.rotation,
        opacity: t.alpha,
        skin: s.skin,
        loop: s.loop,
        ...(p.target === 'background.spine' || p.target === 'featureBackground.spine'
          ? { animation: s.animation }
          : { idle: s.animation }),
      },
    };
  });
  let result = base as RecordValue;
  for (const u of updates) result = setCopy(result, u.path, u.value);
  if (Array.isArray(result.reelSpines))
    result = { ...result, reelSpines: result.reelSpines.filter(Boolean) };
  return result as T;
}
