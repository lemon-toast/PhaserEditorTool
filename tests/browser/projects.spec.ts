import { test, expect } from '@playwright/test';

test('프로젝트 선택 오류·미저장 전환 취소·홀덤 공용 에셋 화면', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '어떤 화면을 작업할까요?' })).toBeVisible();
  await page.getByLabel('프로젝트 폴더 경로', { exact: true }).fill('존재하지 않는 경로');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('프로젝트 폴더를 선택하세요');
  await page.getByRole('button', { name: '예제 연출 열기' }).click();
  await page.locator('[data-node="money"]').click();
  const field = page.getByRole('spinbutton', { name: '위치 X', exact: true });
  await field.fill('42');
  await field.press('Tab');
  await page.getByRole('button', { name: '프로젝트 / 화면 선택', exact: true }).click();
  await page.getByRole('button', { name: '프로젝트 TemplateWebGame', exact: true }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '선택한 화면 열기 →' }).click();
  await expect(page.getByRole('heading', { name: '어떤 화면을 작업할까요?' })).toBeVisible();
  await page.getByRole('button', { name: '편집 화면으로 돌아가기' }).click();
  await expect(field).toHaveValue('42');
  await page.getByRole('button', { name: '프로젝트 / 화면 선택', exact: true }).click();
  await page.getByRole('button', { name: '프로젝트 TemplateWebGame', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '선택한 화면 열기 →' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.document-name')).toContainText('TemplateWebGame');
  await expect(page.getByRole('button', { name: '슬롯에 적용', exact: true })).toHaveCount(0);
});
