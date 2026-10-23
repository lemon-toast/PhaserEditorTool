import { expect, test } from '@playwright/test';
import { createNode, type SceneDocument } from '../../src/core/document';

test('다중 선택·격자 이동·정렬과 한 번의 실행 취소', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '예제 연출 열기' }).click();
  const a = createNode('image', '첫 객체'),
    b = createNode('image', '둘째 객체');
  a.id = 'a';
  b.id = 'b';
  Object.assign(a.transform, { x: 203, y: 203 });
  Object.assign(b.transform, { x: 403, y: 303 });
  const doc: SceneDocument = {
    schemaVersion: 1,
    id: 'placement',
    name: '배치 검증',
    designSize: { width: 800, height: 600 },
    roots: ['a', 'b'],
    nodes: { a, b },
    animations: [],
  };
  await page
    .locator('input[type=file]')
    .setInputFiles({
      name: 'placement.scene.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(doc)),
    });
  await page.locator('[data-node="a"]').click();
  await page.locator('[data-node="b"]').click({ modifiers: ['Control'] });
  await expect(page.getByRole('treeitem', { selected: true })).toHaveCount(2);
  await page.getByRole('checkbox', { name: '격자 스냅' }).check();
  await page.getByLabel('스냅 간격').fill('20');
  await page.getByLabel('스냅 간격').press('Tab');
  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  const fit = Math.min(box.width / 800, box.height / 600) * 0.88;
  const x = box.x + box.width / 2 + (403 - 400) * fit;
  const y = box.y + box.height / 2 + (303 - 300) * fit;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 47 * fit, y + 47 * fit, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByRole('spinbutton', { name: '위치 X', exact: true })).toHaveValue('460');
  await expect(page.getByRole('treeitem', { selected: true })).toHaveCount(2);
  await page.locator('[data-node="a"]').click();
  await expect(page.getByRole('spinbutton', { name: '위치 X', exact: true })).toHaveValue('260');
  await page.locator('[data-node="b"]').click({ modifiers: ['Control'] });
  await page.getByRole('button', { name: '↶ 실행 취소' }).click();
  await expect(page.getByRole('spinbutton', { name: '위치 X', exact: true })).toHaveValue('403');
  await page.getByRole('button', { name: '원점 Y 맞춤' }).click();
  await page.locator('[data-node="a"]').click();
  await expect(page.getByRole('spinbutton', { name: '위치 Y', exact: true })).toHaveValue('303');
  await page.getByRole('button', { name: '↶ 실행 취소' }).click();
  await expect(page.getByRole('spinbutton', { name: '위치 Y', exact: true })).toHaveValue('203');
});
