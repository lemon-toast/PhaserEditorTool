import { describe, expect, it } from 'vitest';
import {
  addLayoutMode,
  clone,
  demoDocument,
  ensureScreen,
  switchLayoutMode,
  validateDocument,
} from '../src/core/document';
import { convertSlotLayout } from '../src/adapters/slotClient';
import { exportSlotDocument } from '../src/integration/exportSlot';

describe('해상도와 배치 모드', () => {
  it('기존 단일 화면 문서를 유지하고, 한 모드만으로 작업할 수 있다', () => {
    const doc = demoDocument();
    expect(validateDocument(doc)).toEqual(doc);
    expect(ensureScreen(doc).modes).toHaveLength(1);
    expect(validateDocument(doc).screen?.behavior).toBe('fixed');
  });
  it('모드 전환과 JSON 왕복에서 해상도·계층·배치·트랙을 독립적으로 보존한다', () => {
    const doc = demoDocument(),
      before = clone(doc);
    const originalId = ensureScreen(doc).activeMode;
    addLayoutMode(doc, '세로', { width: 720, height: 1280 });
    const portraitId = doc.screen!.activeMode;
    doc.nodes.money.transform.x = 123;
    doc.nodes.popup.children.reverse();
    doc.animations[0].tracks[0].to = 0.5;
    const portrait = clone(doc);
    switchLayoutMode(doc, originalId);
    expect(doc.designSize).toEqual(before.designSize);
    expect(doc.nodes).toEqual(before.nodes);
    expect(doc.animations).toEqual(before.animations);
    const loaded = validateDocument(JSON.parse(JSON.stringify(doc)));
    switchLayoutMode(loaded, portraitId);
    expect(loaded.designSize).toEqual(portrait.designSize);
    expect(loaded.nodes).toEqual(portrait.nodes);
    expect(loaded.animations).toEqual(portrait.animations);
    expect(doc.nodes.money.transform.x).toBe(0);
  });
  it('비활성 모드도 검사하며 잘못된 해상도·노드·모드 이름·재귀 데이터를 거부한다', () => {
    const doc = demoDocument();
    addLayoutMode(doc, '세로', { width: 720, height: 1280 });
    const invalidSize = clone(doc);
    invalidSize.screen!.modes[0].layout!.designSize.width = 0;
    expect(() => validateDocument(invalidSize)).toThrow('해상도');
    const invalidNode = clone(doc);
    invalidNode.screen!.modes[0].layout!.nodes.money.transform.x = NaN;
    expect(() => validateDocument(invalidNode)).toThrow('Transform');
    expect(() => addLayoutMode(doc, '세로', { width: 720, height: 1280 })).toThrow('같은 이름');
    const recursive = clone(doc);
    Object.assign(recursive.screen!.modes[0].layout!, { screen: {} });
    expect(() => validateDocument(recursive)).toThrow('배치 모드 데이터');
    const missing = clone(doc);
    missing.screen!.activeMode = 'missing';
    expect(() => validateDocument(missing)).toThrow();
  });
  it('복사한 모드는 원본 역적용 연결을 제거하고 해상도를 바꾼 원본의 게임 적용을 거부한다', () => {
    const doc = convertSlotLayout({
      layout: { art: { back: [], front: [] }, hud: {}, reels: { x: 0, y: 0, width: 500, height: 300 } },
      designSize: { width: 1920, height: 1080 },
    });
    const originalId = ensureScreen(doc).activeMode;
    addLayoutMode(doc, '사용자 지정', { width: 1024, height: 768 });
    expect(doc.source).toBeUndefined();
    switchLayoutMode(doc, originalId);
    expect(doc.source?.orientation).toBe('landscape');
    expect(exportSlotDocument(doc).editorDocument).not.toHaveProperty('screen');
    doc.designSize = { width: 1280, height: 720 };
    expect(() => exportSlotDocument(doc)).toThrow('기준 해상도');
  });
});
