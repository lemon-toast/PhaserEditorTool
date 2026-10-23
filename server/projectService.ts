import type { Plugin } from 'vite';
import { createReadStream } from 'node:fs';
import {
  readdir,
  readFile,
  realpath,
  stat,
  lstat,
  writeFile,
  rename,
  unlink,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportSlotDocument } from '../src/integration/exportSlot';
import { applySlotPackage, validateSlotPackage } from '../src/integration/slotRuntime';
import { inspectProject, knownProjects } from './projects';

async function gameLayoutDirectory(slotRoot: string) {
  const game = await realpath(path.resolve(slotRoot, '..')),
    dir = await realpath(path.join(game, 'layout'));
  const relative = path.relative(game, dir);
  if (relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('게임 layout 폴더가 프로젝트 밖을 가리킵니다.');
  return dir;
}
export async function writeGamePackage(
  slotRoot: string,
  orientation: 'portrait' | 'landscape',
  content: string,
) {
  if (!['portrait', 'landscape'].includes(orientation)) throw new Error('잘못된 화면 방향입니다.');
  const dir = await gameLayoutDirectory(slotRoot);
  const destination = path.join(dir, `editor.${orientation}.json`),
    temp = path.join(dir, `.editor-${crypto.randomUUID()}.tmp`);
  let previous: string | undefined;
  try {
    const entry = await lstat(destination);
    if (entry.isSymbolicLink() || !entry.isFile())
      throw new Error('게임 적용 파일이 일반 파일이 아닙니다.');
    previous = await readFile(destination, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (previous !== undefined) {
    const backupTemp = temp + '.bak';
    try {
      await writeFile(backupTemp, previous, { flag: 'wx' });
      await rename(backupTemp, destination + '.bak');
    } finally {
      await unlink(backupTemp).catch(() => {});
    }
  }
  try {
    await writeFile(temp, content, { flag: 'wx' });
    await rename(temp, destination);
  } finally {
    await unlink(temp).catch(() => {});
  }
}

const imageTypes = new Set(['.png', '.jpg', '.jpeg', '.webp']);
export async function resolveAsset(root: string, relative: string) {
  if (
    !relative ||
    relative.includes('\\') ||
    relative.includes('\0') ||
    path.isAbsolute(relative) ||
    relative.split('/').includes('..')
  )
    throw new Error('허용되지 않는 에셋 경로입니다.');
  const base = await realpath(root),
    full = await realpath(path.resolve(base, relative));
  const rel = path.relative(base, full);
  if (rel.startsWith('..') || path.isAbsolute(rel) || !(await stat(full)).isFile())
    throw new Error('프로젝트 밖의 파일은 읽을 수 없습니다.');
  if (
    !imageTypes.has(path.extname(full).toLowerCase()) &&
    !['.json', '.atlas'].includes(path.extname(full).toLowerCase())
  )
    throw new Error('지원하지 않는 에셋입니다.');
  return full;
}
export function projectService(): Plugin {
  const slotRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../SlotClient/games/SLOT_1002/assets',
  );
  let root = process.env.SLOTCLIENT_ROOT || slotRoot;
  let writing = false;
  return {
    name: 'local-project-service',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        if (!url.pathname.startsWith('/api/')) return next();
        const origin = req.headers.origin;
        let allowedOrigin = !origin;
        try {
          if (origin) allowedOrigin = new URL(origin).host === req.headers.host;
        } catch {
          allowedOrigin = false;
        }
        if (!allowedOrigin) {
          res.statusCode = 403;
          return res.end('외부 요청은 허용하지 않습니다.');
        }
        const json = (data: unknown) => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(data));
        };
        try {
          if (url.pathname === '/api/projects' && req.method === 'GET')
            return json(await knownProjects(path.resolve(slotRoot, '../../../..')));
          if (url.pathname === '/api/projects/inspect' && req.method === 'POST') {
            if (req.headers['x-editor-request'] !== '1')
              throw new Error('잘못된 프로젝트 요청입니다.');
            let body = '';
            for await (const chunk of req) {
              body += chunk;
              if (body.length > 4096) throw new Error('요청이 너무 큽니다.');
            }
            return json(await inspectProject(JSON.parse(body).root));
          }
          if (url.pathname === '/api/slot-game-package') {
            if ((await realpath(root)) !== (await realpath(slotRoot)))
              throw new Error('SLOT_1002 에셋 폴더를 연결하세요.');
            if (req.method === 'GET') {
              const orientation =
                url.searchParams.get('orientation') === 'portrait' ? 'portrait' : 'landscape';
              try {
                const file = path.join(
                    await gameLayoutDirectory(slotRoot),
                    `editor.${orientation}.json`,
                  ),
                  entry = await lstat(file);
                if (entry.isSymbolicLink() || !entry.isFile())
                  throw new Error('일반 파일이 아닙니다.');
                return json(validateSlotPackage(JSON.parse(await readFile(file, 'utf8'))));
              } catch {
                throw new Error(
                  '저장된 게임 적용본이 없거나 잘못되었습니다. 먼저 슬롯에 적용하세요.',
                );
              }
            }
            if (req.method !== 'POST') {
              res.statusCode = 405;
              return res.end();
            }
            if (req.headers['x-editor-request'] !== '1') throw new Error('잘못된 적용 요청입니다.');
            if (writing) throw new Error('다른 저장이 진행 중입니다. 잠시 후 다시 시도하세요.');
            writing = true;
            try {
              let body = '';
              for await (const chunk of req) {
                body += chunk;
                if (body.length > 10 * 1024 * 1024)
                  throw new Error('10MB 이하 문서만 적용할 수 있습니다.');
              }
              const supplied = validateSlotPackage(JSON.parse(body)),
                pack = exportSlotDocument(supplied.editorDocument);
              const gameConfig = await readFile(
                path.resolve(slotRoot, '../../../src/config/gameConfig.ts'),
                'utf8',
              );
              if (!gameConfig.includes('applySlotPackage'))
                throw new Error('먼저 SlotClient 연결 설치 스크립트를 실행하세요.');
              const module = await server.ssrLoadModule(
                path
                  .resolve(slotRoot, `../layout/${pack.orientation}.ts`)
                  .split(path.sep)
                  .join('/'),
              );
              const base = module[pack.orientation]({
                orientation: pack.orientation,
                w: pack.designSize.width,
                h: pack.designSize.height,
              });
              applySlotPackage(base, pack, {
                gameCode: 'SLOT_1002',
                orientation: pack.orientation,
                width: pack.designSize.width,
                height: pack.designSize.height,
              });
              await writeGamePackage(
                slotRoot,
                pack.orientation,
                JSON.stringify(pack, null, 2) + '\n',
              );
              return json({ ok: true, patches: pack.patches.length });
            } finally {
              writing = false;
            }
          }
          if (url.pathname === '/api/project' && req.method === 'POST') {
            if (req.headers['x-editor-request'] !== '1')
              throw new Error('잘못된 프로젝트 요청입니다.');
            let body = '';
            for await (const chunk of req) {
              body += chunk;
              if (body.length > 4096) throw new Error('요청이 너무 큽니다.');
            }
            const selected = JSON.parse(body).root;
            if (typeof selected !== 'string' || !path.isAbsolute(selected))
              throw new Error('에셋 폴더의 절대 경로를 입력하세요.');
            const candidate = await realpath(selected);
            if (!(await stat(candidate)).isDirectory()) throw new Error('폴더가 아닙니다.');
            root = candidate;
            return json({ ok: true });
          }
          if (req.method !== 'GET') {
            res.statusCode = 405;
            return res.end();
          }
          if (url.pathname === '/api/slot-layout') {
            if ((await realpath(root)) !== (await realpath(slotRoot)))
              throw new Error('SLOT_1002 기본 에셋 폴더가 연결되어 있어야 합니다.');
            const orientation =
              url.searchParams.get('orientation') === 'portrait' ? 'portrait' : 'landscape';
            const width = orientation === 'portrait' ? 1080 : 1920,
              height = orientation === 'portrait' ? 1920 : 1080;
            const module = await server.ssrLoadModule(
              path.resolve(slotRoot, `../layout/${orientation}.ts`).split(path.sep).join('/'),
            );
            const layout = module[orientation]({ orientation, w: width, h: height });
            return json({ layout, designSize: { width, height } });
          }
          if (url.pathname === '/api/catalog') {
            const base = await realpath(root),
              files: string[] = [];
            const scan = async (dir: string, depth = 0) => {
              if (depth > 16) return;
              for (const entry of await readdir(dir, { withFileTypes: true })) {
                if (files.length >= 10000)
                  throw new Error('에셋이 10,000개를 초과합니다. 하위 폴더를 연결하세요.');
                if (entry.isSymbolicLink()) continue;
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) await scan(full, depth + 1);
                else if (
                  entry.isFile() &&
                  (imageTypes.has(path.extname(full).toLowerCase()) ||
                    ['.json', '.atlas'].includes(path.extname(full)))
                )
                  files.push(path.relative(base, full).split(path.sep).join('/'));
              }
            };
            await scan(base);
            const assets: object[] = files
              .filter((f) => imageTypes.has(path.extname(f).toLowerCase()))
              .map((file) => ({ kind: 'image', file, name: path.basename(file) }));
            for (const atlas of files.filter((f) => f.endsWith('.atlas'))) {
              const file = atlas.replace(/\.atlas$/, '.json');
              if (!files.includes(file)) continue;
              try {
                const skeleton = JSON.parse(await readFile(await resolveAsset(base, file), 'utf8'));
                if (!skeleton.skeleton || !skeleton.bones) continue;
                assets.push({
                  kind: 'spine',
                  file,
                  atlas,
                  name: path.basename(file, '.json'),
                  animations: Object.keys(skeleton.animations || {}),
                  skins: Array.isArray(skeleton.skins)
                    ? skeleton.skins.map((s: { name: string }) => s.name)
                    : Object.keys(skeleton.skins || {}),
                  version: skeleton.skeleton.spine,
                });
              } catch {
                /* 손상된 skeleton은 다른 에셋의 탐색을 막지 않습니다. */
              }
            }
            return json({ root: base, assets });
          }
          if (url.pathname === '/api/asset') {
            const full = await resolveAsset(root, url.searchParams.get('path') || '');
            const mime: Record<string, string> = {
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.webp': 'image/webp',
              '.json': 'application/json',
              '.atlas': 'text/plain',
            };
            res.setHeader(
              'Content-Type',
              mime[path.extname(full).toLowerCase()] || 'application/octet-stream',
            );
            createReadStream(full)
              .on('error', () => res.destroy())
              .pipe(res);
            return;
          }
          res.statusCode = 404;
          json({ error: '없는 API입니다.' });
        } catch (error) {
          res.statusCode = 400;
          json({
            error:
              error instanceof Error && !('code' in error)
                ? error.message
                : '에셋 폴더나 파일을 읽을 수 없습니다. 연결 경로를 확인하세요.',
          });
        }
      });
    },
  };
}
