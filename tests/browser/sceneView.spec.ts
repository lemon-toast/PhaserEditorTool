import { expect, test } from '@playwright/test';
import { demoDocument } from '../../src/core/document';

test('휠 확대 후 화면 맞춤을 클릭하면 원래 화면으로 돌아온다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '예제 연출 열기' }).click();
  const doc = demoDocument();
  doc.animations = [];
  doc.nodes.fireworks.activeSelf = false;
  await page.locator('input[type=file]').setInputFiles({
    name: 'scene-view.scene.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(doc)),
  });
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('.scene-mode')).toHaveText('현재 모드: 배치 편집');
  await expect(page.locator('.scene-zoom')).toHaveText('맞춤 100%');
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const fitted = (await canvas.screenshot()).toString('base64');
  await canvas.hover();
  await page.mouse.wheel(0, -500);
  await expect.poll(async () => (await canvas.screenshot()).toString('base64')).not.toBe(fitted);
  await expect(page.locator('.scene-zoom')).not.toHaveText('맞춤 100%');
  await page.getByRole('button', { name: '화면 맞춤', exact: true }).click();
  await expect.poll(async () => (await canvas.screenshot()).toString('base64')).toBe(fitted);
  await expect(page.locator('.scene-zoom')).toHaveText('맞춤 100%');
  const viewStatus = page.locator('.scene-foot').getByRole('status');
  await expect(viewStatus).toHaveText('화면 맞춤 완료');
  await canvas.hover();
  await page.mouse.wheel(0, 500);
  await expect(viewStatus).toBeEmpty();
  const fitButton = page.getByRole('button', { name: '화면 맞춤', exact: true });
  await fitButton.focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await canvas.screenshot()).toString('base64')).toBe(fitted);
  await expect(viewStatus).toHaveText('화면 맞춤 완료');
});
