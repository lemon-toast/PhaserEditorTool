import { inverse, parentOf, world, type SceneDocument } from './document';

export function selectionRoots(doc: SceneDocument, ids: string[]) {
  const selected = new Set(ids.filter((id) => doc.nodes[id]));
  return [...selected].filter((id) => {
    for (let p = parentOf(doc, id); p; p = parentOf(doc, p)) if (selected.has(p)) return false;
    return true;
  });
}

// 화면 좌표의 이동량을 각 부모의 로컬 좌표로 변환합니다.
export function translatedPositions(doc: SceneDocument, ids: string[], dx: number, dy: number) {
  return selectionRoots(doc, ids).map((id) => {
    const inv = inverse(world(doc, parentOf(doc, id)));
    const t = doc.nodes[id].transform;
    return { id, x: t.x + inv[0] * dx + inv[2] * dy, y: t.y + inv[1] * dx + inv[3] * dy };
  });
}

export function alignOrigins(doc: SceneDocument, ids: string[], axis: 'x' | 'y', anchor: string) {
  const roots = selectionRoots(doc, ids);
  if (!doc.nodes[anchor] || !roots.includes(anchor)) anchor = roots[roots.length - 1];
  if (!anchor) return;
  const target = world(doc, anchor)[axis === 'x' ? 4 : 5];
  // 모든 좌표를 먼저 계산해 부모 변환 오류 시 부분 수정하지 않습니다.
  const updates = roots.flatMap((id) => {
    const value = world(doc, id)[axis === 'x' ? 4 : 5];
    return translatedPositions(
      doc,
      [id],
      axis === 'x' ? target - value : 0,
      axis === 'y' ? target - value : 0,
    );
  });
  for (const p of updates) Object.assign(doc.nodes[p.id].transform, { x: p.x, y: p.y });
}
