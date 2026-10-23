import { _electron as electron, expect, test } from '@playwright/test';
import path from 'node:path';

test('독립 창에서 폴더 선택·화면 열기·미저장 닫기 보호', async () => {
  const env: Record<string, string> = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  env.EDITOR_DESKTOP_TEST = '1';
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: [path.resolve('desktop/main.mjs'), '--use-angle=swiftshader'],
    env,
  });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: '어떤 화면을 작업할까요?' })).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/desktop-home.png' });
    expect(await page.evaluate(() => typeof window.editorDesktop?.chooseProjectFolder)).toBe(
      'function',
    );
    expect(await page.evaluate(() => typeof (window as any).process)).toBe('undefined');
    expect(await page.evaluate(() => (window as any).require?.('node:fs'))).toBeUndefined();
    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [folder] })) as any;
    }, path.resolve('../SlotClient'));
    await page.getByRole('button', { name: '＋ 프로젝트 폴더 열기' }).click();
    await page.getByRole('button', { name: '화면 SLOT_1002 · 세로 화면', exact: true }).click();
    await page.getByRole('button', { name: '선택한 화면 열기 →' }).click();
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.locator('.document-name')).toContainText('세로');
    await page.locator('[data-node="background"]').click();
    const field = page.getByRole('spinbutton', { name: '위치 X', exact: true });
    await field.fill('10');
    await field.press('Tab');
    await expect(page.locator('.document-name')).toContainText('●');
    await app.evaluate(({ dialog, BrowserWindow }) => {
      dialog.showMessageBoxSync = () => 0;
      BrowserWindow.getAllWindows()[0].close();
    });
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
    await page.screenshot({ path: 'test-results/desktop-editor.png' });
  } finally {
    await app
      .evaluate(({ dialog }) => {
        dialog.showMessageBoxSync = () => 1;
      })
      .catch(() => {});
    await app.close();
  }
});
