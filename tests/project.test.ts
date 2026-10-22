import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveAsset, writeGamePackage } from '../server/projectService';
let folder: string;
beforeAll(async () => {
  folder = await mkdtemp(path.join(tmpdir(), 'phaser-editor-test-'));
  await mkdir(path.join(folder, 'assets'));
  await mkdir(path.join(folder, 'layout'));
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
describe('게임 적용 파일 저장', () => {
  it('기존 파일을 백업하고 새 패키지로 교체한다', async () => {
    const file = path.join(folder, 'layout', 'editor.landscape.json');
    await writeFile(file, '이전 문서');
    await writeGamePackage(path.join(folder, 'assets'), 'landscape', '새 문서');
    expect(await readFile(file, 'utf8')).toBe('새 문서');
    expect(await readFile(file + '.bak', 'utf8')).toBe('이전 문서');
  });
  it('잘못된 방향으로 파일 경로를 만들지 않는다', async () => {
    await expect(
      writeGamePackage(path.join(folder, 'assets'), '../other' as any, '문서'),
    ).rejects.toThrow('방향');
  });
});
