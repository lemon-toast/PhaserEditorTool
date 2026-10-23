import { test, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inspectProject, knownProjects } from '../server/projects';

test('프로젝트 구조에서 화면과 적용본을 발견하고 잘못된 폴더는 거부', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'phaser-project-picker-'));
  try {
    const slot = path.join(root, 'SlotClient');
    await mkdir(path.join(slot, 'games/SLOT_1002/assets'), { recursive: true });
    await mkdir(path.join(slot, 'games/SLOT_1002/layout'), { recursive: true });
    await writeFile(path.join(slot, 'games/SLOT_1002/layout/landscape.ts'), '');
    await writeFile(path.join(slot, 'games/SLOT_1002/layout/editor.landscape.json'), '{}');
    const project = await inspectProject(slot);
    expect(project.kind).toBe('slot');
    expect(project.scenes).toHaveLength(1);
    expect(project.scenes[0]).toMatchObject({ orientation: 'landscape', hasApplied: true });
    expect(await knownProjects(root)).toHaveLength(1);
    await expect(inspectProject('relative/path')).rejects.toThrow('프로젝트 폴더');
    await expect(inspectProject(root)).rejects.toThrow('지원하는 게임 프로젝트');
    const template = path.join(root, 'TemplateWebGame');
    await mkdir(path.join(template, 'GameClient/public/assets'), { recursive: true });
    await mkdir(path.join(template, 'GameClient/src/game/scenes_holdem'), { recursive: true });
    expect(await inspectProject(template)).toMatchObject({
      kind: 'template',
      scenes: [{ kind: 'assets', hasApplied: false }],
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
