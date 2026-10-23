import { expect, it } from 'vitest';
import { createNode, validateDocument } from '../src/core/document';
import { replaceAsset, setNineSlice } from '../src/core/assetEditing';
import { edit, loadDocument, state, undo, redo } from '../src/editor/store';

it('Spine 교체는 atlas를 묶어 바꾸고 호환되지 않는 재생 설정을 정리한다', () => {
  const node = createNode('spine');
  node.animation = 'old';
  node.skin = 'old';
  replaceAsset(node, {
    kind: 'spine',
    file: 'new.json',
    atlas: 'new.atlas',
    animations: ['idle'],
    skins: ['default'],
  });
  expect(node).toMatchObject({
    asset: 'new.json',
    atlas: 'new.atlas',
    animation: 'idle',
    skin: '',
  });
  expect(() => replaceAsset(node, { kind: 'image', file: 'a.png' })).toThrow('종류');
  expect(() => replaceAsset(node, { kind: 'spine', file: 'a.json' })).toThrow('atlas');
});
it('9-slice 오류 입력을 거부하고 교체·설정의 undo와 저장 왕복을 보존한다', () => {
  const n = createNode('image');
  n.id = 'image';
  n.asset = 'old.png';
  loadDocument({
    schemaVersion: 1,
    id: 'test',
    name: 'test',
    designSize: { width: 800, height: 600 },
    roots: [n.id],
    nodes: { [n.id]: n },
    animations: [],
  });
  edit((doc) => {
    replaceAsset(doc.nodes.image, { kind: 'image', file: 'new.png' });
    setNineSlice(doc.nodes.image, true, [10, 20, 10, 20], 1);
  });
  expect(validateDocument(JSON.parse(JSON.stringify(state.doc))).nodes.image.slice).toEqual([
    10, 20, 10, 20,
  ]);
  undo();
  expect(state.doc.nodes.image.asset).toBe('old.png');
  expect(state.doc.nodes.image.slice).toBeUndefined();
  redo();
  expect(state.doc.nodes.image.asset).toBe('new.png');
  for (const borders of [
    [-1, 0, 0, 0],
    [NaN, 0, 0, 0],
    [0, 200, 0, 200],
  ])
    expect(() => setNineSlice(n, true, borders, 1)).toThrow();
  expect(() => setNineSlice(n, true, [0, 0, 0, 0], 0)).toThrow();
  setNineSlice(n, true, [10, 10, 10, 10], 1);
  setNineSlice(n, false, [], 1);
  expect(n.slice).toBeUndefined();
  expect(n.sliceScale).toBeUndefined();
});
