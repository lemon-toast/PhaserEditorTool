import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveAsset } from '../server/projectService';
let folder: string;
beforeAll(async () => {
  folder = await mkdtemp(path.join(tmpdir(), 'phaser-editor-test-'));
  await mkdir(path.join(folder, 'assets'));
  await writeFile(path.join(folder, 'assets', '한글 이미지.png'), 'test');
  await writeFile(path.join(folder, 'secret.json'), '{}');
});
afterAll(async () => {
  const resolved = path.resolve(folder);
  if (
    path.dirname(resolved) !== path.resolve(tmpdir()) ||
    !path.basename(resolved).startsWith('phaser-editor-test-')
  )
    throw new Error('테스트 임시 경로가 아닙니다.');
  await rm(resolved, { recursive: true, force: true });
});
describe('로컬 에셋 경로', () => {
  it('한글·공백이 있는 폴더 내부 파일을 허용한다', async () => {
    expect(await resolveAsset(path.join(folder, 'assets'), '한글 이미지.png')).toContain(
      '한글 이미지.png',
    );
  });
  it('부모 경로·절대 경로·역슬래시를 거부한다', async () => {
    for (const p of ['../secret.json', path.join(folder, 'secret.json'), '..\\secret.json'])
      await expect(resolveAsset(path.join(folder, 'assets'), p)).rejects.toThrow();
  });
});
