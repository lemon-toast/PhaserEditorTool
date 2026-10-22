import {
  activeInHierarchy,
  clone,
  validateDocument,
  world,
  type SceneDocument,
  type SceneNode,
} from '../core/document';
import {
  bindingPath,
  validateSlotPackage,
  type Placement,
  type SlotPackage,
  type SlotPatch,
} from './slotRuntime';

function baked(doc: SceneDocument, n: SceneNode): Placement {
  const m = world(doc, n.id),
    sx = Math.hypot(m[0], m[1]);
  if (sx < 1e-9) throw new Error(`${n.name}: 배율 0은 게임 내보내기를 지원하지 않습니다.`);
  const sy = (m[0] * m[3] - m[1] * m[2]) / sx;
  if (Math.abs(sy) < 1e-9)
    throw new Error(`${n.name}: 배율 0은 게임 내보내기를 지원하지 않습니다.`);
  if (Math.abs(m[0] * m[2] + m[1] * m[3]) > 1e-6 * Math.max(1, sx * Math.abs(sy)))
    throw new Error(`${n.name}: 부모 변환에 기울어짐이 있습니다.`);
  let alpha = 1;
  for (const row of Object.values(doc.nodes)) {
    if (row.id === n.id || isAncestor(doc, row.id, n.id)) alpha *= row.transform.alpha;
  }
  return {
    x: m[4],
    y: m[5],
    scaleX: sx,
    scaleY: sy,
    rotation: (Math.atan2(m[1], m[0]) * 180) / Math.PI,
    alpha,
  };
}
function isAncestor(doc: SceneDocument, ancestor: string, id: string): boolean {
  return doc.nodes[ancestor]!.children.some((child) => child === id || isAncestor(doc, child, id));
}
export function exportSlotDocument(input: unknown): SlotPackage {
  const doc = validateDocument(input),
    source = doc.source;
  if (
    !source ||
    source.adapter !== 'slot-client' ||
    source.gameCode !== 'SLOT_1002' ||
    !['portrait', 'landscape'].includes(source.orientation) ||
    !source.baseline
  )
    throw new Error(
      '먼저 슬롯 배치를 가져오세요. 일반 장면의 게임 역적용은 아직 지원하지 않습니다.',
    );
  const base = validateDocument({
    ...doc,
    source: undefined,
    roots: source.baseline.roots,
    nodes: source.baseline.nodes,
    animations: [],
  });
  if (
    JSON.stringify(doc.roots) !== JSON.stringify(base.roots) ||
    Object.keys(doc.nodes).length !== Object.keys(base.nodes).length ||
    Object.values(base.nodes).some(
      (n) =>
        !doc.nodes[n.id] ||
        JSON.stringify(doc.nodes[n.id]!.children) !== JSON.stringify(n.children),
    )
  )
    throw new Error(
      '노드 추가·삭제·부모·형제 순서 변경은 현재 게임 적용 범위 밖입니다. 기본 계층을 유지하세요.',
    );
  if (doc.animations.length)
    throw new Error(
      '연출 트랙의 게임 실행 연결은 아직 구현 중입니다. 장면 저장은 사용할 수 있습니다.',
    );
  const patches: SlotPatch[] = [],
    unsupported: string[] = [];
  for (const n of Object.values(doc.nodes)) {
    if (n.kind === 'group') continue;
    const original = base.nodes[n.id]!,
      before = baked(base, original),
      after = baked(doc, n);
    const oldActive = activeInHierarchy(base, n.id),
      active = activeInHierarchy(doc, n.id);
    const visual = (node: SceneNode) => {
      const value = { ...node };
      delete (value as Partial<SceneNode>).name;
      return JSON.stringify(value);
    };
    if (
      visual(n) === visual(original) &&
      JSON.stringify(before) === JSON.stringify(after) &&
      oldActive === active
    )
      continue;
    try {
      bindingPath(n.id);
    } catch {
      unsupported.push(n.name);
      continue;
    }
    if (
      n.kind !== original.kind ||
      n.asset !== original.asset ||
      n.atlas !== original.atlas ||
      JSON.stringify(n.slice) !== JSON.stringify(original.slice) ||
      n.sliceScale !== original.sliceScale
    )
      throw new Error(`${n.name}: 에셋·9-slice 교체는 아직 게임 적용을 지원하지 않습니다.`);
    if (!oldActive && active)
      throw new Error(
        `${n.name}: 게임 상태가 관리하는 숨김 그룹 강제 표시는 아직 지원하지 않습니다.`,
      );
    const patch: SlotPatch = {
      target: n.id,
      kind: n.kind as 'image' | 'spine',
      asset: n.asset!,
      placement: after,
    };
    if (oldActive !== active) patch.active = active;
    if (n.kind === 'image')
      patch.image = {
        width: n.width,
        height: n.height,
        originX: n.originX,
        originY: n.originY,
        color: n.color,
      };
    else patch.spine = { animation: n.animation, skin: n.skin, loop: n.loop };
    patches.push(patch);
  }
  if (unsupported.length)
    throw new Error(
      `현재 게임 역적용은 장식 이미지·배경·캐릭터·릴 Spine을 지원합니다. 미지원 수정: ${unsupported.join(', ')}`,
    );
  const pack: SlotPackage = {
    format: 'phaser-editor/slot-layout',
    version: 1,
    gameCode: 'SLOT_1002',
    orientation: source.orientation,
    designSize: clone(doc.designSize),
    fingerprint: source.fingerprint,
    patches,
    editorDocument: doc,
  };
  return validateSlotPackage(pack);
}
