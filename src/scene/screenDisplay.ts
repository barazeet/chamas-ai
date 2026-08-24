import * as THREE from 'three';

export type ScreenMode = 'code' | 'blank';

const CODE_LINES = [
  'const agent = await session.spawn("coder");',
  'agent.review(diff).then(applyPatches);',
  '$ wrangler dev --local',
  'SELECT topic, answer FROM entries_fts',
  '  WHERE entries_fts MATCH ? LIMIT 5;',
  'fn lip_sync(visemes: &[Viseme]) {',
  '  jaw.target = amplitude * 0.8;',
  '}',
  'const reply = await llm.generate(prompt);',
  'scene.traverse(updateBlendshapes);',
  '// TODO: teach the avatar to make coffee',
  'git commit -m "feat: it lives"',
];

const LINE_HEIGHT = 18;
const SCROLL_PX_PER_SEC = 24;

export class ScreenDisplay {
  readonly texture: THREE.CanvasTexture;
  speed = 1;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private offset: number;

  constructor(width = 512, height = 288, initialOffset = 0) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.font = '13px monospace';
    this.ctx.textBaseline = 'top';
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.offset = initialOffset;
  }

  // Note: we redraw the whole canvas every frame on purpose. A cheaper static
  // texture + UV-scroll trick was considered, but Phase 2 mutates the content
  // per frame (menu typing, meeting tiles), which static UVs can't express.
  update(dt: number): void {
    // Wrap by the full content height so the line→row mapping advances and the
    // seam repeats exactly (offset % LINE_HEIGHT is continuous across the wrap).
    this.offset = (this.offset + dt * SCROLL_PX_PER_SEC * this.speed) % (CODE_LINES.length * LINE_HEIGHT);
    const { width: w, height: h } = this.canvas;
    this.ctx.fillStyle = '#0a0f14';
    this.ctx.fillRect(0, 0, w, h);
    for (let row = -1; row < h / LINE_HEIGHT + 1; row++) {
      const lineIndex = ((row + Math.floor(this.offset / LINE_HEIGHT)) % CODE_LINES.length + CODE_LINES.length) % CODE_LINES.length;
      const y = row * LINE_HEIGHT - (this.offset % LINE_HEIGHT);
      this.ctx.fillStyle = lineIndex % 3 === 0 ? '#7ee787' : '#4a90d9';
      this.ctx.fillText(CODE_LINES[lineIndex], 12, y);
    }
    this.texture.needsUpdate = true;
  }
}
