import { describe, expect, it } from 'vitest';
import { convertSlotLayout } from '../src/adapters/slotClient';
import { clone } from '../src/core/document';
import { exportSlotDocument } from '../src/integration/exportSlot';
import {
  applySlotPackage,
  layoutFingerprint,
  validateSlotPackage,
} from '../src/integration/slotRuntime';

function fixture() {
  return {
    layout: {
      orientation: 'landscape',
      art: { back: [], front: [{ file: 'image/title.png', x: 20, y: 30, width: 100, height: 60 }] },
      hud: {},
      background: { spine: 'spine/bg', x: 10, y: 15, animation: 'idle' },
      reels: { x: 200, y: 200, width: 300, height: 200 },
    },
    designSize: { width: 1920, height: 1080 },
  };
}
const context = { gameCode: 'SLOT_1002', orientation: 'landscape', width: 1920, height: 1080 };
describe('슬롯 게임 데이터 역적용', () => {
  it('기본 숨김 프리셋은 게임 상태를 덮어쓰지 않는다', () => {
    const raw = fixture(),
      doc = convertSlotLayout(raw),
      pack = exportSlotDocument(doc);
    expect(pack.patches).toEqual([]);
    expect(applySlotPackage(raw.layout, pack, context)).toEqual(raw.layout);
  });
  it('부모 Transform·투명도를 합산하고 실제 layout에 적용한다', () => {
    const raw = fixture(),
      doc = convertSlotLayout(raw);
    doc.nodes['art.front'].transform.x = 100;
    doc.nodes['art.front'].transform.alpha = 0.5;
    doc.nodes['art.front.0'].transform.rotation = 15;
    const pack = exportSlotDocument(doc),
      output = applySlotPackage(raw.layout, pack, context),
      image = output.art.front[0] as any;
    expect(image.x).toBe(120);
    expect(image.opacity).toBe(0.5);
    expect(image.rotation).toBeCloseTo(15);
    expect(raw.layout.art.front[0].x).toBe(20);
  });
  it('이미지 비활성은 해당 이미지에만 반영한다', () => {
    const raw = fixture(),
      doc = convertSlotLayout(raw);
    doc.nodes['art.front.0'].activeSelf = false;
    const output = applySlotPackage(raw.layout, exportSlotDocument(doc), context);
    expect((output.art.front[0] as any).opacity).toBe(0);
    expect(output.background).toEqual(raw.layout.background);
  });
  it('Spine 위치·비균등 배율·회전·애니메이션을 반영한다', () => {
    const raw = fixture(),
      doc = convertSlotLayout(raw),
      n = doc.nodes['background.spine'];
    n.transform.x = 150;
    n.transform.scaleX = 1.5;
    n.transform.scaleY = 0.8;
    n.transform.rotation = 12;
    n.animation = 'win';
    n.skin = 'gold';
    const bg = applySlotPackage(raw.layout, exportSlotDocument(doc), context).background as any;
    expect(bg).toMatchObject({
      x: 150,
      scaleX: 1.5,
      rotation: 12,
      animation: 'win',
      skin: 'gold',
    });
    expect(bg.scaleY).toBeCloseTo(0.8);
  });
  it('내보낸 게임 파일을 재import해 같은 패키지를 복원한다', () => {
    const doc = convertSlotLayout(fixture());
    doc.nodes['art.front.0'].transform.x = 333;
    const pack = exportSlotDocument(doc),
      parsed = validateSlotPackage(JSON.parse(JSON.stringify(pack)));
    expect(exportSlotDocument(parsed.editorDocument)).toEqual(pack);
  });
  it('원본 변경·게임·방향 불일치 및 바인딩 위조는 적용 전에 거부한다', () => {
    const raw = fixture(),
      doc = convertSlotLayout(raw);
    doc.nodes['art.front.0'].transform.x = 44;
    const pack = exportSlotDocument(doc),
      saved = clone(raw.layout);
    expect(() => applySlotPackage({ ...raw.layout, changed: true }, pack, context)).toThrow('원본');
    expect(() =>
      applySlotPackage(raw.layout, pack, { ...context, gameCode: 'SLOT_OTHER' }),
    ).toThrow('게임');
    pack.patches[0]!.asset = 'image/other.png';
    expect(() => applySlotPackage(raw.layout, pack, context)).toThrow('에셋');
    expect(raw.layout).toEqual(saved);
    expect(() =>
      validateSlotPackage({ ...pack, patches: [{ ...pack.patches[0], target: '__proto__.x' }] }),
    ).toThrow();
  });
  it('미지원 노드·계층·연출 수정은 조용히 누락시키지 않는다', () => {
    const doc = convertSlotLayout(fixture());
    doc.nodes['reels.0.0'].transform.x++;
    expect(() => exportSlotDocument(doc)).toThrow('미지원');
    const other = convertSlotLayout(fixture());
    other.roots.reverse();
    expect(() => exportSlotDocument(other)).toThrow('계층');
    const last = convertSlotLayout(fixture());
    last.animations.push({ id: 'test', name: 'test', duration: 10, tracks: [] });
    expect(() => exportSlotDocument(last)).toThrow('연출');
  });
  it('함수와 JSON 키 순서의 차이는 원본 fingerprint에 영향을 주지 않는다', () => {
    expect(layoutFingerprint({ b: 2, a: 1, callback: () => 0 })).toBe(
      layoutFingerprint({ a: 1, b: 2 }),
    );
  });
});
