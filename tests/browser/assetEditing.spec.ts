import { expect, test } from '@playwright/test';
import { createNode } from '../../src/core/document';

test('에셋 교체·9-slice 입력 오류·undo·저장 복원과 누락 참조', async ({ page }) => {
  await page.route('**/api/catalog', (route) =>
    route.fulfill({
      json: {
        root: 'test',
        assets: [
          { kind: 'image', file: 'a.png', name: '첫 이미지' },
          { kind: 'image', file: 'b.png', name: '둘째 이미지' },
          {
            kind: 'spine',
            file: 'hero.json',
            atlas: 'hero.atlas',
            name: '캐릭터',
            animations: ['idle'],
            skins: ['default'],
          },
        ],
      },
    }),
  );
  await page.route('**/api/asset?*', (route) => {
    const path = new URL(route.request().url()).searchParams.get('path');
    if (path === 'a.png' || path === 'b.png')
      return route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="red"/></svg>',
      });
    return route.fulfill({ status: 404, body: 'missing' });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '예제 연출 열기' }).click();
  await page.getByLabel('패널 열기', { exact: true }).selectOption('assets');
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  const image = createNode('image');
  image.id = 'image';
  image.asset = 'a.png';
  const spine = createNode('spine');
  spine.id = 'spine';
  await page.locator('input[type=file]').setInputFiles({
    name: 'assets.scene.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        id: 'assets',
        name: '에셋 검증',
        designSize: { width: 800, height: 600 },
        roots: ['image', 'spine'],
        nodes: { image, spine },
        animations: [],
      }),
    ),
  });
  await page.locator('[data-node="image"]').click();
  await page.getByLabel('교체 에셋', { exact: true }).selectOption('b.png');
  await expect(page.locator('.inspector > .asset-path')).toHaveText('b.png');
  await page.getByRole('button', { name: '↶ 실행 취소' }).click();
  await expect(page.getByLabel('교체 에셋', { exact: true })).toHaveValue('a.png');
  await page.getByRole('button', { name: '데이터 Import', exact: true }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles({
      name: 'wrong.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ schemaVersion: 1 })),
    });
  await expect(page.locator('.status-message')).toContainText('작업 불러오기');
  await expect(page.getByLabel('교체 에셋', { exact: true })).toHaveValue('a.png');
  // 파일 선택을 취소해도 다음 작업 불러오기는 작업 형식으로 전환됩니다.
  page.once('filechooser', () => {});
  await page.getByRole('button', { name: '작업 불러오기', exact: true }).click();
  await page.getByRole('checkbox', { name: '9-slice 사용', exact: true }).check();
  await page.getByLabel('9-slice 왼쪽', { exact: true }).fill('-1');
  await page.getByRole('button', { name: '9-slice 적용', exact: true }).click();
  await expect(page.getByRole('region', { name: '에셋 편집' }).getByRole('alert')).toContainText(
    '경계',
  );
  await page.getByLabel('9-slice 왼쪽', { exact: true }).fill('10');
  await page.getByLabel('9-slice 오른쪽', { exact: true }).fill('10');
  await page.getByRole('button', { name: '9-slice 적용', exact: true }).click();
  await expect(page.getByRole('region', { name: '에셋 편집' }).getByRole('alert')).toHaveCount(0);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '작업 저장' }).click();
  const download = await pending;
  await page.locator('input[type=file]').setInputFiles((await download.path())!);
  await expect(page.getByLabel('9-slice 왼쪽', { exact: true })).toHaveValue('10');
  await page.locator('[data-node="spine"]').click();
  await page.getByLabel('교체 에셋', { exact: true }).selectOption('hero.json');
  await expect(page.getByRole('region', { name: '에셋 편집' })).toContainText('hero.atlas');
  await expect(page.getByLabel('Spine 애니메이션')).toHaveValue('idle');
  await page.getByLabel('패널 열기', { exact: true }).selectOption('console');
  await expect(page.locator('.console-panel')).toContainText('Spine 파일을 읽지 못했습니다');
  await expect(page.locator('canvas')).toBeVisible();
});
