import type { SceneNode } from './document';

export interface AssetReference {
  kind: 'image' | 'spine';
  file: string;
  atlas?: string;
  animations?: string[];
  skins?: string[];
}

export function replaceAsset(node: SceneNode, asset: AssetReference) {
  if (node.kind !== asset.kind) throw new Error('같은 종류의 에셋만 교체할 수 있습니다.');
  if (asset.kind === 'spine' && !asset.atlas) throw new Error('Spine atlas가 없는 에셋입니다.');
  node.asset = asset.file;
  if (asset.kind === 'spine') {
    node.atlas = asset.atlas;
    if (!asset.animations?.includes(node.animation)) node.animation = asset.animations?.[0] || '';
    if (!asset.skins?.includes(node.skin)) node.skin = '';
  } else delete node.atlas;
}

export function setNineSlice(node: SceneNode, enabled: boolean, borders: number[], scale: number) {
  if (node.kind !== 'image') throw new Error('9-slice는 이미지에서만 사용할 수 있습니다.');
  if (!enabled) {
    delete node.slice;
    delete node.sliceScale;
    return;
  }
  if (borders.length !== 4 || borders.some((v) => !Number.isFinite(v) || v < 0 || v > 8192))
    throw new Error('경계는 0~8192 사이의 숫자로 입력하세요.');
  if (!Number.isFinite(scale) || scale < 0.01 || scale > 100)
    throw new Error('경계 배율은 0.01~100 사이로 입력하세요.');
  const [top, right, bottom, left] = borders;
  if ((left + right) * scale > node.width || (top + bottom) * scale > node.height)
    throw new Error('경계 합계와 배율이 표시 너비·높이를 넘습니다.');
  node.slice = [top, right, bottom, left];
  node.sliceScale = scale;
}
