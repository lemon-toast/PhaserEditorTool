import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const editorRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(process.argv[2] || path.join(editorRoot, '../SlotClient'));
const files = new Map();
async function change(relative, replacements) {
  const file = path.join(root, relative),
    original = await readFile(file, 'utf8');
  let text = original.replaceAll('\r\n', '\n');
  for (const [before, after] of replacements) {
    if (text.includes(after)) continue;
    const first = text.indexOf(before);
    if (first < 0 || text.indexOf(before, first + before.length) >= 0)
      throw new Error(`예상 코드가 다릅니다. 자동 설치 중단: ${relative}`);
    text = text.replace(before, after);
  }
  files.set(file, original.includes('\r\n') ? text.replaceAll('\n', '\r\n') : text);
}
await change('src/config/gameConfig.ts', [
  [
    'import type { FeatureEffect }',
    "import { applySlotPackage } from '../game/layout/editorRuntime.js';\nimport type { FeatureEffect }",
  ],
  [
    "const configLoaders = import.meta.glob<GameConfig>('../../games/*/game.config.ts', { import: 'default' });",
    "const configLoaders = import.meta.glob<GameConfig>('../../games/*/game.config.ts', { import: 'default' });\nconst editorLayouts = import.meta.glob<unknown>('../../games/*/layout/editor.*.json', { eager: true, import: 'default' });",
  ],
  [
    '  Object.assign(activeLayout, DEFAULT_LAYOUT, config.layout);',
    `  Object.assign(activeLayout, DEFAULT_LAYOUT, config.layout);
  for (const orientation of ['landscape', 'portrait'] as const) {
    const packageData = editorLayouts[\`../../games/\${gameCode}/layout/editor.\${orientation}.json\`];
    if (packageData === undefined) continue;
    const original = activeLayout[orientation];
    let reported = false;
    activeLayout[orientation] = (ctx) => {
      const base = original(ctx);
      try { return applySlotPackage(base, packageData, { gameCode, orientation, width: ctx.w, height: ctx.h }); }
      catch (error) {
        if (!reported) { reported = true; console.error('[화면 에디터] 적용 실패, 기본 배치를 사용합니다.', error); }
        return base;
      }
    };
  }`,
  ],
]);
await change('src/game/layout/layoutTypes.ts', [
  [
    'export interface ArtImage extends Box, Sliced {',
    `export interface ArtImage extends Box, Sliced {
  readonly rotation?: number;
  readonly originX?: number;
  readonly originY?: number;
  readonly editorTransform?: boolean;`,
  ],
  [
    'export interface SpineArt extends Point {',
    `export interface SpineArt extends Point {
  readonly scaleX?: number;
  readonly scaleY?: number;
  readonly rotation?: number;
  readonly opacity?: number;
  readonly skin?: string;
  readonly loop?: boolean;`,
  ],
  [
    'export interface SpineBackground extends Point {',
    'export interface SpineBackground extends SpineArt {',
  ],
]);
await change('src/game/artImage.ts', [
  [
    'export type ArtObject = Phaser.GameObjects.Image | Phaser.GameObjects.NineSlice;',
    `function applyEditorArt(object: ArtObject, art: ArtImage): ArtObject {
  object.setAngle(art.rotation ?? 0).setOrigin(art.originX ?? 0.5, art.originY ?? 0.5);
  if (art.editorTransform && object instanceof Phaser.GameObjects.Image) {
    object.setFlip(false, false).setScale(object.scaleX * (art.flipX ? -1 : 1), object.scaleY * (art.flipY ? -1 : 1));
  }
  return object;
}

export type ArtObject = Phaser.GameObjects.Image | Phaser.GameObjects.NineSlice;`,
  ],
  [
    '    return tint === undefined ? object : object.setTint(tint);',
    '    return applyEditorArt(tint === undefined ? object : object.setTint(tint), art);',
  ],
  [
    '  return tint === undefined ? object : object.setTint(tint);\n}',
    '  return applyEditorArt(tint === undefined ? object : object.setTint(tint), art);\n}',
  ],
]);
await change('src/game/spineArt.ts', [
  [
    '  return scene.add.spine(art.x, art.y, dataKey(art.spine), atlasKey(art.spine)).setScale(art.scale ?? 1);',
    `  const object = scene.add.spine(art.x, art.y, dataKey(art.spine), atlasKey(art.spine))
    .setScale(art.scaleX ?? art.scale ?? 1, art.scaleY ?? art.scale ?? 1)
    .setAngle(art.rotation ?? 0).setAlpha(art.opacity ?? 1).setData('editorAlpha', art.opacity ?? 1);
  if (art.skin) { object.skeleton.setSkin(art.skin); object.skeleton.setupPoseSlots(); }
  return object;`,
  ],
]);
await change('src/game/BackgroundScene.ts', [
  [
    '      .setScale((bg.scale ?? 1) * k)',
    `      .setScale((bg.scaleX ?? bg.scale ?? 1) * k, (bg.scaleY ?? bg.scale ?? 1) * k)
      .setAngle(bg.rotation ?? 0).setAlpha(bg.opacity ?? 1)`,
  ],
  [
    '    const animation = loop ?? bg.animation ?? spine.skeleton.data.animations[0]?.name;',
    `    if (bg.skin) { spine.skeleton.setSkin(bg.skin); spine.skeleton.setupPoseSlots(); }
    const animation = loop ?? bg.animation ?? spine.skeleton.data.animations[0]?.name;`,
  ],
  [
    '      spine.animationState.setAnimation(0, animation, true);',
    '      spine.animationState.setAnimation(0, animation, bg.loop ?? true);',
  ],
]);
await change('src/game/ForegroundScene.ts', [
  [
    '      character.setAlpha(visible ? 1 : 0).setVisible(visible);',
    "      character.setAlpha(visible ? (character.getData('editorAlpha') ?? 1) : 0).setVisible(visible);",
  ],
  [
    '      alpha: visible ? 1 : 0,',
    "      alpha: visible ? (character.getData('editorAlpha') ?? 1) : 0,",
  ],
  [
    '      if (this.#character === character && this.#characterVisible === visible) character.setAlpha(visible ? 1 : 0).setVisible(visible);',
    "      if (this.#character === character && this.#characterVisible === visible) character.setAlpha(visible ? (character.getData('editorAlpha') ?? 1) : 0).setVisible(visible);",
  ],
  [
    '    for (const spine of this.#reelSpines) spine.setAlpha(alpha).setVisible(alpha > 0);',
    "    for (const spine of this.#reelSpines) spine.setAlpha(alpha * (spine.getData('editorAlpha') ?? 1)).setVisible(alpha > 0);",
  ],
  [
    '    character.setAlpha(this.#characterVisible ? 1 : 0).setVisible(this.#characterVisible);',
    "    character.setAlpha(this.#characterVisible ? (character.getData('editorAlpha') ?? 1) : 0).setVisible(this.#characterVisible);",
  ],
  [
    '      if (art.flipX) spine.setScale(-(art.scale ?? 1), art.scale ?? 1);',
    '      if (art.flipX && art.scaleX === undefined) spine.setScale(-(art.scale ?? 1), art.scale ?? 1);',
  ],
  [
    '      playSpine(spine, art.idle, true);',
    '      playSpine(spine, art.idle, art.loop ?? true);',
  ],
  [
    '      spine.setDepth(DEPTH.art).setAlpha(this.#reelAlpha).setVisible(this.#reelAlpha > 0);',
    "      spine.setDepth(DEPTH.art).setAlpha(this.#reelAlpha * (spine.getData('editorAlpha') ?? 1)).setVisible(this.#reelAlpha > 0);",
  ],
  [
    '    if (this.#character !== null && art !== undefined) playSpine(this.#character, art.idle, true);',
    '    if (this.#character !== null && art !== undefined) playSpine(this.#character, art.idle, art.loop ?? true);',
  ],
]);
const runtime = await readFile(path.join(editorRoot, 'src/integration/slotRuntime.ts'), 'utf8');
await change('src/game/createSlotGame.ts', [
  [
    '  installTextureQuality(game);',
    `  installTextureQuality(game);
  // 개발 중 실제 렌더링 객체를 검증할 때만 노출합니다. 배포 빌드에는 포함되지 않습니다.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('editorInspect') === '1') {
    const debugWindow = window as unknown as { __slotEditorGame?: Phaser.Game };
    debugWindow.__slotEditorGame = game;
    game.events.once(Phaser.Core.Events.DESTROY, () => { if (debugWindow.__slotEditorGame === game) delete debugWindow.__slotEditorGame; });
  }`,
  ],
]);
files.set(
  path.join(root, 'src/game/layout/editorRuntime.ts'),
  '// 자동 배포 파일: PhaserEditorTool/src/integration/slotRuntime.ts\n' + runtime,
);
for (const [file, content] of files) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, 'utf8');
}
console.log('SlotClient 게임 역적용 연결 설치 완료 (원본 layout·에셋은 변경하지 않았습니다).');
