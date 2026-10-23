import { realpath, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { EditorProject, ProjectScene } from '../src/core/projects';

async function exists(file: string) {
  try {
    return (await stat(file)).isDirectory();
  } catch {
    return false;
  }
}
async function isFile(file: string) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}
async function assetDirectory(root: string, relative: string) {
  const full = await realpath(path.join(root, relative)),
    rel = path.relative(root, full);
  if (rel.startsWith('..') || path.isAbsolute(rel))
    throw new Error('에셋 폴더가 선택한 프로젝트 밖을 가리킵니다.');
  return full;
}
export async function inspectProject(input: string): Promise<EditorProject> {
  if (typeof input !== 'string' || !path.isAbsolute(input) || input.length > 2000)
    throw new Error('프로젝트 폴더를 선택하세요.');
  const root = await realpath(input);
  if (!(await stat(root)).isDirectory()) throw new Error('프로젝트 폴더가 아닙니다.');
  const slotAssets = path.join(root, 'games/SLOT_1002/assets');
  if (await exists(slotAssets)) {
    const assets = await assetDirectory(root, 'games/SLOT_1002/assets'),
      scenes: ProjectScene[] = [];
    for (const orientation of ['landscape', 'portrait'] as const) {
      if (!(await isFile(path.join(root, `games/SLOT_1002/layout/${orientation}.ts`)))) continue;
      scenes.push({
        id: `SLOT_1002:${orientation}`,
        name: `SLOT_1002 · ${orientation === 'landscape' ? '가로' : '세로'} 화면`,
        description:
          orientation === 'landscape'
            ? '1920 × 1080 · 슬롯 기본 배치'
            : '1080 × 1920 · 슬롯 기본 배치',
        assetRoot: assets,
        kind: 'slot-layout',
        orientation,
        hasApplied: await isFile(
          path.join(root, `games/SLOT_1002/layout/editor.${orientation}.json`),
        ),
      });
    }
    return {
      id: root,
      name: path.basename(root),
      root,
      kind: 'slot',
      description: '슬롯 게임 · 화면 편집 및 이미지·Spine 배치 역적용',
      scenes,
    };
  }
  const client = (await exists(path.join(root, 'GameClient/public/assets')))
    ? 'GameClient/public/assets'
    : (await exists(path.join(root, 'public/assets')))
      ? 'public/assets'
      : undefined;
  if (client) {
    const assetRoot = await assetDirectory(root, client);
    const template = await exists(
      path.join(
        root,
        client === 'public/assets' ? 'src/game/scenes_holdem' : 'GameClient/src/game/scenes_holdem',
      ),
    );
    return {
      id: root,
      name: path.basename(root),
      root,
      kind: template ? 'template' : 'assets',
      description: template
        ? '홀덤·맞고 · 공용 에셋 탐색 가능, 게임 화면 어댑터 연결 예정'
        : '게임 에셋 탐색',
      scenes: [
        {
          id: 'assets',
          name: template ? '홀덤·맞고 공용 에셋' : '프로젝트 에셋',
          description: '빈 화면에 이미지·Spine을 선택하여 배치합니다.',
          assetRoot,
          kind: 'assets',
          orientation: 'landscape',
          hasApplied: false,
        },
      ],
    };
  }
  // 에셋 폴더 자체도 열 수 있지만 디스크 전체를 재귀 탐색하지 않습니다.
  const entries = await readdir(root, { withFileTypes: true });
  if (!entries.some((e) => e.isFile() && /\.(png|jpe?g|webp|atlas|json)$/i.test(e.name)))
    throw new Error(
      '지원하는 게임 프로젝트나 에셋 폴더가 아닙니다. SlotClient, TemplateWebGame 또는 에셋 폴더를 선택하세요.',
    );
  return {
    id: root,
    name: path.basename(root),
    root,
    kind: 'assets',
    description: '이미지·Spine 에셋 폴더',
    scenes: [
      {
        id: 'assets',
        name: '빈 화면에서 에셋 탐색',
        description: '이미지·Spine을 에셋 패널에서 추가하세요.',
        assetRoot: root,
        kind: 'assets',
        orientation: 'landscape',
        hasApplied: false,
      },
    ],
  };
}
export async function knownProjects(workspace: string) {
  const results = await Promise.allSettled(
    ['SlotClient', 'TemplateWebGame'].map((name) => inspectProject(path.join(workspace, name))),
  );
  return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
}
