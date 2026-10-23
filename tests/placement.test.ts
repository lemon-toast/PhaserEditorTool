import { describe, expect, it } from 'vitest';
import { demoDocument, world } from '../src/core/document';
import { alignOrigins, selectionRoots, translatedPositions } from '../src/core/placement';
import {
  alignSelection,
  loadDocument,
  selectNode,
  selectedIds,
  state,
  undo,
} from '../src/editor/store';

describe('다중 객체 배치', () => {
  it('회전·배율이 있는 부모 아래에서도 화면 이동량을 보존한다', () => {
    const doc = demoDocument();
    doc.nodes.popup.transform.rotation = 35;
    doc.nodes.popup.transform.scaleX = 2;
    doc.nodes.popup.transform.scaleY = 0.7;
    const before = world(doc, 'title');
    const [pos] = translatedPositions(doc, ['title'], 60, -25);
    Object.assign(doc.nodes.title.transform, { x: pos.x, y: pos.y });
    const after = world(doc, 'title');
    expect(after[4] - before[4]).toBeCloseTo(60);
    expect(after[5] - before[5]).toBeCloseTo(-25);
  });
  it('부모·자식 동시 선택은 부모만 이동하며 다른 부모의 원점도 정렬한다', () => {
    const doc = demoDocument();
    expect(selectionRoots(doc, ['popup', 'title'])).toEqual(['popup']);
    doc.nodes.popup.transform.rotation = 30;
    alignOrigins(doc, ['title', 'fireworks'], 'x', 'fireworks');
    expect(world(doc, 'title')[4]).toBeCloseTo(world(doc, 'fireworks')[4]);
  });
  it('선택 토글과 정렬 전체 실행 취소, 문서 전환 시 선택 초기화', () => {
    loadDocument(demoDocument());
    selectNode('title');
    selectNode('money', true);
    expect(selectedIds.value).toEqual(['title', 'money']);
    const before = state.doc.nodes.title.transform.y;
    alignSelection('y');
    expect(world(state.doc, 'title')[5]).toBeCloseTo(world(state.doc, 'money')[5]);
    undo();
    expect(state.doc.nodes.title.transform.y).toBe(before);
    selectNode('money', true);
    expect(selectedIds.value).toEqual(['title']);
    loadDocument(demoDocument());
    expect(selectedIds.value.length).toBe(1);
  });
});
