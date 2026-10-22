import Phaser from 'phaser';
import { SpinePlugin, type SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import {
  activeInHierarchy,
  flatten,
  inverse,
  parentOf,
  world,
  type SceneNode,
} from '../core/document';
import { log, patchNode, renderedDocument, state } from './store';

const assetUrl = (path: string) => `/api/asset?path=${encodeURIComponent(path)}`;
type Visual =
  | Phaser.GameObjects.Image
  | Phaser.GameObjects.NineSlice
  | Phaser.GameObjects.Text
  | Phaser.GameObjects.Rectangle
  | Phaser.GameObjects.Particles.ParticleEmitter
  | SpineGameObject;
interface Entry {
  container: Phaser.GameObjects.Container;
  visual?: Visual;
  signature: string;
  active: boolean;
}
function boundsOf(v: Visual) {
  if ('getBounds' in v) return v.getBounds();
  const m = v.getWorldTransformMatrix(),
    x = -v.displayOriginX,
    y = -v.displayOriginY;
  const points = [
    [x, y],
    [x + v.width, y],
    [x, y + v.height],
    [x + v.width, y + v.height],
  ].map(([x, y]) => m.transformPoint(x, y));
  const left = Math.min(...points.map((p) => p.x)),
    top = Math.min(...points.map((p) => p.y));
  return new Phaser.Geom.Rectangle(
    left,
    top,
    Math.max(...points.map((p) => p.x)) - left,
    Math.max(...points.map((p) => p.y)) - top,
  );
}
export class EditorScene extends Phaser.Scene {
  entries = new Map<string, Entry>();
  pending = new Map<string, Promise<void>>();
  failures = new Set<string>();
  overlay!: Phaser.GameObjects.Graphics;
  frame!: Phaser.GameObjects.Graphics;
  viewZoom = 1;
  resetVersion = -1;
  alive = true;
  drag?: { id: string; x: number; y: number; px: number; py: number };
  constructor() {
    super('editor');
  }
  create() {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffd785);
    g.fillCircle(8, 8, 6);
    g.generateTexture('__spark', 16, 16);
    g.destroy();
    this.frame = this.add.graphics().setDepth(-1000);
    this.overlay = this.add.graphics().setDepth(100000);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (state.timeline) return;
      const doc = renderedDocument(),
        rows = flatten(doc).reverse();
      for (const { node } of rows) {
        const id = node.id,
          entry = this.entries.get(id);
        if (!entry?.visual || !activeInHierarchy(doc, id)) continue;
        const bounds = boundsOf(entry.visual);
        if (bounds.contains(p.worldX, p.worldY)) {
          state.selected = id;
          let inv;
          try {
            inv = inverse(world(doc, parentOf(doc, id)));
          } catch (error) {
            log((error as Error).message, '오류');
            return;
          }
          const x = inv[0] * p.worldX + inv[2] * p.worldY + inv[4],
            y = inv[1] * p.worldX + inv[3] * p.worldY + inv[5];
          this.drag = {
            id,
            x: doc.nodes[id].transform.x,
            y: doc.nodes[id].transform.y,
            px: x,
            py: y,
          };
          return;
        }
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.drag || !p.isDown) return;
      const d = this.drag;
      if (!state.doc.nodes[d.id]) {
        this.drag = undefined;
        return;
      }
      let inv;
      try {
        inv = inverse(world(state.doc, parentOf(state.doc, d.id)));
      } catch {
        this.drag = undefined;
        return;
      }
      const e = this.entries.get(d.id);
      e?.container.setPosition(
        d.x + inv[0] * p.worldX + inv[2] * p.worldY + inv[4] - d.px,
        d.y + inv[1] * p.worldX + inv[3] * p.worldY + inv[5] - d.py,
      );
    });
    const end = () => {
      if (!this.drag) return;
      const d = this.drag,
        e = this.entries.get(d.id);
      this.drag = undefined;
      if (e)
        patchNode(d.id, (n) => {
          n.transform.x = Math.round(e.container.x * 10) / 10;
          n.transform.y = Math.round(e.container.y * 10) / 10;
        });
    };
    this.input.on('pointerup', end);
    this.input.on('pointerupoutside', end);
    this.input.on('wheel', (_p: unknown, _a: unknown, _dx: number, dy: number) => {
      this.viewZoom = Phaser.Math.Clamp(this.viewZoom * (dy > 0 ? 0.9 : 1.1), 0.15, 4);
    });
    this.events.once('shutdown', () => {
      this.alive = false;
    });
  }
  loadAssets(n: SceneNode): Promise<void> {
    const key = `${state.project}:${n.asset || ''}:${n.atlas || ''}`;
    if (this.pending.has(key)) return this.pending.get(key)!;
    const promise = (async () => {
      const image = async (key: string, url: string) => {
        if (this.textures.exists(key)) return;
        const element = new Image();
        element.src = url;
        await element.decode();
        if (this.alive && !this.textures.exists(key)) this.textures.addImage(key, element);
      };
      if (n.kind !== 'spine') {
        if (n.asset) await image(key, assetUrl(n.asset));
        return;
      }
      if (!n.asset || !n.atlas) throw new Error('Spine skeleton과 atlas를 지정하세요.');
      const [skeletonResponse, atlasResponse] = await Promise.all([
        fetch(assetUrl(n.asset)),
        fetch(assetUrl(n.atlas)),
      ]);
      if (!skeletonResponse.ok || !atlasResponse.ok)
        throw new Error('Spine 파일을 읽지 못했습니다.');
      const [skeleton, atlas] = await Promise.all([skeletonResponse.json(), atlasResponse.text()]);
      const pages = atlas
        .split(/\r?\n/)
        .filter(
          (line, i, lines) =>
            line.trim() && !line.includes(':') && (i === 0 || !lines[i - 1].trim()),
        );
      const prefix = n.atlas.slice(0, n.atlas.lastIndexOf('/') + 1);
      await Promise.all(
        pages.map((page) => image(`${key}:atlas!${page.trim()}`, assetUrl(prefix + page.trim()))),
      );
      if (!this.alive) return;
      this.cache.json.add(`${key}:data`, skeleton);
      this.cache.text.add(`${key}:atlas`, atlas);
    })();
    this.pending.set(key, promise);
    return promise;
  }
  async build(n: SceneNode, entry: Entry) {
    const signature = entry.signature,
      key = `${state.project}:${n.asset || ''}:${n.atlas || ''}`;
    try {
      if (n.kind === 'group') return;
      if (n.asset) await this.loadAssets(n);
      if (!this.alive || this.entries.get(n.id) !== entry || entry.signature !== signature) return;
      let visual: Visual;
      if (n.kind === 'image' && n.asset) {
        if (n.slice) {
          const [top, right, bottom, left] = n.slice,
            s = n.sliceScale || 1;
          visual = this.add
            .nineslice(0, 0, key, undefined, n.width / s, n.height / s, left, right, top, bottom)
            .setScale(s)
            .setOrigin(n.originX, n.originY)
            .setTint(Phaser.Display.Color.HexStringToColor(n.color).color);
        } else
          visual = this.add
            .image(0, 0, key)
            .setDisplaySize(n.width, n.height)
            .setOrigin(n.originX, n.originY)
            .setTint(Phaser.Display.Color.HexStringToColor(n.color).color);
      } else if (n.kind === 'spine' && n.asset && n.atlas) {
        const spine = this.add.spine(0, 0, `${key}:data`, `${key}:atlas`);
        spine.setActive(false);
        if (n.skin) {
          spine.skeleton.setSkin(n.skin);
          spine.skeleton.setupPoseSlots();
        }
        const name = n.animation || spine.skeleton.data.animations[0]?.name;
        if (name) spine.animationState.setAnimation(0, name, n.loop);
        spine.updatePose(0);
        visual = spine;
      } else if (n.kind === 'particle') {
        const p = n.particle;
        const emitter = this.add.particles(0, 0, n.asset ? key : '__spark', {
          frequency: p.frequency,
          quantity: p.quantity,
          lifespan: p.lifespan,
          speed: { min: p.speed * 0.4, max: p.speed },
          angle: { min: 0, max: 360 },
          gravityY: p.gravity,
          scale: { start: p.scale, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [0xffd47b, 0x7ddfce, 0xe982b3],
          maxParticles: 500,
        });
        emitter.setActive(false);
        visual = emitter;
      } else if (n.kind === 'text')
        visual = this.add
          .text(0, 0, n.text, {
            fontFamily: 'Segoe UI, sans-serif',
            fontSize: n.height,
            color: n.color,
            fontStyle: 'bold',
          })
          .setOrigin(n.originX, n.originY);
      else
        visual = this.add
          .rectangle(0, 0, n.width, n.height, 0x323b4a)
          .setStrokeStyle(2, 0xffb25a)
          .setOrigin(n.originX, n.originY);
      entry.visual = visual;
      entry.container.add(visual);
    } catch (e) {
      if (!this.alive || this.entries.get(n.id) !== entry || entry.signature !== signature) return;
      const message = `${n.name}: ${(e as Error).message}`;
      if (!this.failures.has(message)) {
        this.failures.add(message);
        log(message, '오류');
      }
      entry.visual = this.add.rectangle(0, 0, 100, 70, 0x582b3a).setStrokeStyle(2, 0xe98696);
      entry.container.add(entry.visual);
    }
  }
  update(_time: number, delta: number) {
    if (!this.overlay) return;
    const doc = renderedDocument();
    const fit =
      Math.min(this.scale.width / doc.designSize.width, this.scale.height / doc.designSize.height) *
      0.88 *
      this.viewZoom;
    this.cameras.main.setZoom(fit).centerOn(doc.designSize.width / 2, doc.designSize.height / 2);
    this.frame
      .clear()
      .fillStyle(0x171e2a)
      .fillRect(0, 0, doc.designSize.width, doc.designSize.height)
      .lineStyle(1, 0x465468)
      .strokeRect(0, 0, doc.designSize.width, doc.designSize.height);
    this.frame.lineStyle(0.5, 0x252e3d);
    for (let x = 80; x < doc.designSize.width; x += 80)
      this.frame.lineBetween(x, 0, x, doc.designSize.height);
    for (let y = 80; y < doc.designSize.height; y += 80)
      this.frame.lineBetween(0, y, doc.designSize.width, y);
    if (this.resetVersion !== state.reset) {
      this.resetVersion = state.reset;
      for (const entry of this.entries.values()) entry.container.destroy();
      this.entries.clear();
      this.failures.clear();
    }
    for (const [id, entry] of this.entries)
      if (!doc.nodes[id]) {
        entry.container.destroy();
        this.entries.delete(id);
      }
    let count = 0;
    const walk = (ids: string[], parent?: Phaser.GameObjects.Container) =>
      ids.forEach((id) => {
        const n = doc.nodes[id];
        const signature = JSON.stringify([
          state.project,
          n.kind,
          n.asset,
          n.atlas,
          n.width,
          n.height,
          n.originX,
          n.originY,
          n.animation,
          n.skin,
          n.loop,
          n.text,
          n.color,
          n.particle,
          n.slice,
          n.sliceScale,
        ]);
        let e = this.entries.get(id);
        if (!e) {
          e = { container: this.add.container(), signature, active: false };
          this.entries.set(id, e);
          if (parent) parent.add(e.container);
          void this.build(n, e);
        } else if (e.signature !== signature) {
          e.visual?.destroy();
          e.visual = undefined;
          e.signature = signature;
          void this.build(n, e);
        }
        if (e.container.parentContainer !== (parent || null)) {
          e.container.parentContainer?.remove(e.container);
          if (parent) parent.add(e.container);
          else this.add.existing(e.container);
        }
        const t = n.transform,
          active = activeInHierarchy(doc, id);
        e.container
          .setVisible(n.activeSelf)
          .setAlpha(t.alpha)
          .setScale(t.scaleX, t.scaleY)
          .setAngle(t.rotation);
        if (this.drag?.id !== id) e.container.setPosition(t.x, t.y);
        if (!parent) e.container.setDepth(count++);
        else parent.bringToTop(e.container);
        const v = e.visual;
        if (v && 'animationState' in v && state.playing && active)
          v.updatePose(delta * state.speed);
        if (v instanceof Phaser.GameObjects.Particles.ParticleEmitter) {
          if (!active && e.active) v.stop(true);
          if (active && !e.active) v.start();
          if (active && state.playing) v.preUpdate(_time, delta * state.speed);
        }
        e.active = active;
        walk(n.children, e.container);
      });
    walk(doc.roots);
    this.overlay.clear();
    const e = this.entries.get(state.selected);
    if (e && activeInHierarchy(doc, state.selected)) {
      const bounds = e.visual && boundsOf(e.visual);
      this.overlay.lineStyle(2 / fit, 0x80e0c7);
      if (bounds) this.overlay.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      const m = world(doc, state.selected);
      this.overlay
        .lineBetween(m[4] - 10 / fit, m[5], m[4] + 10 / fit, m[5])
        .lineBetween(m[4], m[5] - 10 / fit, m[4], m[5] + 10 / fit);
    }
  }
}
export function createStage(element: HTMLElement) {
  const scene = new EditorScene();
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: element,
    width: Math.max(1, element.clientWidth),
    height: Math.max(1, element.clientHeight),
    backgroundColor: '#10151e',
    transparent: false,
    scene: [scene],
    plugins: { scene: [{ key: 'SpinePlugin', plugin: SpinePlugin, mapping: 'spine' }] },
    render: { antialias: true },
  });
  const observer = new ResizeObserver(() => {
    if (element.clientWidth && element.clientHeight)
      game.scale.resize(element.clientWidth, element.clientHeight);
  });
  observer.observe(element);
  return {
    scene,
    destroy() {
      observer.disconnect();
      game.destroy(true);
    },
  };
}
