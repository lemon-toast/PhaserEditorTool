import { expect, test } from '@playwright/test';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

test('에디터 수정 → 실제 슬롯 import → resize 후 유지 → 재import', async ({ page, context }) => {
  const file = path.resolve('../SlotClient/games/SLOT_1002/layout/editor.landscape.json'),
    backup = file + '.bak';
  const previous = await readFile(file).catch((e) => {
      if (e.code !== 'ENOENT') throw e;
      return undefined;
    }),
    previousBackup = await readFile(backup).catch((e) => {
      if (e.code !== 'ENOENT') throw e;
      return undefined;
    });
  try {
    await page.goto('/');
    await page.getByRole('button', { name: '슬롯 배치', exact: true }).click();
    await page.locator('[data-node="art.front.0"]').click();
    const field = page.getByRole('spinbutton', { name: '위치 X', exact: true });
    await field.fill('777.5');
    await field.press('Tab');
    const rotation = page.getByRole('spinbutton', { name: '회전 °', exact: true });
    await rotation.fill('17');
    await rotation.press('Tab');
    await page.locator('[data-node="character.spine"]').click();
    for (const [name, value] of [
      ['위치 X', '400'],
      ['회전 °', '12'],
      ['투명도', '0.55'],
    ]) {
      const field = page.getByRole('spinbutton', { name, exact: true });
      await field.fill(value!);
      await field.press('Tab');
    }
    await page.getByRole('checkbox', { name: '반복 재생', exact: true }).uncheck();
    await page.getByRole('button', { name: '슬롯에 적용', exact: true }).click();
    await expect(page.locator('.status-message')).toContainText('2개 수정 저장 완료');
    const pack = JSON.parse(await readFile(file, 'utf8'));
    expect(pack.patches).toHaveLength(2);
    expect(pack.patches.find((p: any) => p.target === 'art.front.0').placement.x).toBe(777.5);
    const game = await context.newPage();
    const errors: string[] = [];
    game.on('pageerror', (e) => errors.push(e.message));
    await game.goto('http://127.0.0.1:5174/?mock=1&gameId=1002&editorInspect=1');
    await expect(game.getByRole('button', { name: '시작', exact: true })).toBeVisible({
      timeout: 30000,
    });
    await game.getByRole('button', { name: '시작', exact: true }).click();
    const position = () =>
      game.evaluate(() => {
        const g = (window as any).__slotEditorGame,
          scene = g?.scene.getScene('foreground');
        const object = scene?.children
          .getChildren()
          .find(
            (n: any) =>
              n.texture?.key === 'art:image/sheet/bg/bg-img_04_4.png' &&
              Math.abs(n.x - 777.5) < 0.01,
          );
        return object ? { x: object.x, angle: object.angle, alpha: object.alpha } : null;
      });
    await expect.poll(position).toEqual({ x: 777.5, angle: 17, alpha: 1 });
    const character = () =>
      game.evaluate(() => {
        const object = (window as any).__slotEditorGame?.scene
          .getScene('foreground')
          .children.getChildren()
          .find((n: any) => n.skeleton && Math.abs(n.x - 400) < 0.01);
        return object
          ? {
              x: object.x,
              angle: object.angle,
              alpha: object.alpha,
              loop: object.animationState.getTrack(0)?.loop,
            }
          : null;
      });
    await expect.poll(character).toEqual({ x: 400, angle: 12, alpha: 0.55, loop: false });
    await game.setViewportSize({ width: 1400, height: 850 });
    await expect.poll(position).toEqual({ x: 777.5, angle: 17, alpha: 1 });
    await expect.poll(character).toEqual({ x: 400, angle: 12, alpha: 0.55, loop: false });
    await game.setViewportSize({ width: 900, height: 1400 });
    await expect.poll(position).toBeNull();
    await game.setViewportSize({ width: 1400, height: 850 });
    await expect.poll(position).toEqual({ x: 777.5, angle: 17, alpha: 1 });
    await game.screenshot({ path: 'test-results/game-applied.png', fullPage: true });
    expect(errors).toEqual([]);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '게임 적용본', exact: true }).click();
    await page.locator('[data-node="art.front.0"]').click();
    await expect(page.getByRole('spinbutton', { name: '위치 X', exact: true })).toHaveValue(
      '777.5',
    );
    await game.close();
  } finally {
    // 테스트가 만진 두 파일만 정확한 절대 경로로 복원합니다.
    if (previous) await writeFile(file, previous);
    else
      await unlink(file).catch((e) => {
        if (e.code !== 'ENOENT') throw e;
      });
    if (previousBackup) await writeFile(backup, previousBackup);
    else
      await unlink(backup).catch((e) => {
        if (e.code !== 'ENOENT') throw e;
      });
  }
});
