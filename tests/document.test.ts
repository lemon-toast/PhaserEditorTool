import { describe, expect, it } from 'vitest';
import {
  activeInHierarchy,
  clone,
  createNode,
  demoDocument,
  evaluate,
  reparent,
  validateDocument,
  world,
} from '../src/core/document';

describe('계층과 데이터 교환', () => {
  it('부모 활성 전환은 자식의 activeSelf를 바꾸지 않는다', () => {
    const d = demoDocument();
    d.nodes.winner.activeSelf = false;
    expect(activeInHierarchy(d, 'money')).toBe(false);
    expect(d.nodes.money.activeSelf).toBe(true);
    d.nodes.winner.activeSelf = true;
    expect(activeInHierarchy(d, 'money')).toBe(true);
    d.nodes.money.activeSelf = false;
    d.nodes.winner.activeSelf = false;
    d.nodes.winner.activeSelf = true;
    expect(activeInHierarchy(d, 'money')).toBe(false);
  });
  it('부모 변경 후 월드 위치와 회전·배율을 보존한다', () => {
    const d = demoDocument();
    d.nodes.winner.transform.rotation = 25;
    d.nodes.winner.transform.scaleX = 2;
    d.nodes.winner.transform.scaleY = 2;
    const before = world(d, 'money');
    reparent(d, 'money', 'winner');
    world(d, 'money').forEach((v, i) => expect(v).toBeCloseTo(before[i], 7));
  });
  it('자손으로 이동하거나 shear가 필요한 이동을 거부하고 문서를 보존한다', () => {
    const d = demoDocument(),
      before = clone(d);
    expect(() => reparent(d, 'winner', 'money')).toThrow();
    expect(d).toEqual(before);
    const p = createNode('group');
    p.transform.rotation = 30;
    p.transform.scaleX = 2;
    d.nodes[p.id] = p;
    d.roots.push(p.id);
    const saved = clone(d);
    expect(() => reparent(d, 'money', p.id)).toThrow('기울어짐');
    expect(d).toEqual(saved);
  });
  it('게임용 JSON 왕복 시 ID·계층·연출을 보존한다', () => {
    const d = demoDocument();
    expect(validateDocument(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
  it('순환·고아·중복 부모·없는 트랙 타깃·NaN을 거부한다', () => {
    const a = demoDocument();
    a.nodes.money.children.push('winner');
    expect(() => validateDocument(a)).toThrow();
    const b = demoDocument();
    b.roots.push('money');
    expect(() => validateDocument(b)).toThrow();
    const c = demoDocument();
    c.nodes.orphan = { ...createNode('group'), id: 'orphan' };
    expect(() => validateDocument(c)).toThrow();
    const d = demoDocument();
    d.animations[0].tracks[0].target = 'unknown';
    expect(() => validateDocument(d)).toThrow();
    const e = demoDocument();
    e.nodes.money.transform.x = NaN;
    expect(() => validateDocument(e)).toThrow();
  });
  it('시점 평가가 편집 원본을 변경하지 않는다', () => {
    const d = demoDocument(),
      saved = clone(d),
      middle = evaluate(d, 'winner', 2450);
    expect(middle.nodes.money.transform.x).toBeCloseTo(195);
    expect(d).toEqual(saved);
    expect(evaluate(d, 'winner', 3600).nodes.money.transform.alpha).toBe(0);
  });
  it('경로 이탈·겹치는 트랙·알 수 없는 버전을 거부한다', () => {
    const d = demoDocument();
    d.nodes.money.asset = '../secret.png';
    expect(() => validateDocument(d)).toThrow();
    const e = demoDocument();
    e.animations[0].tracks.push({ ...e.animations[0].tracks[0] });
    expect(() => validateDocument(e)).toThrow('겹칩니다');
    expect(() => validateDocument({ schemaVersion: 42 })).toThrow('버전');
  });
});
