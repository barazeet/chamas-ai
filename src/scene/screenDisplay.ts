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

export class ScreenDisplay {
  readonly texture: THREE.CanvasTexture;
  speed = 1;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private offset = 0;

  constructor(width = 512, height = 288) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
  }

  update(dt: number): void {
    this.offset = (this.offset + dt * 24 * this.speed) % 18;
    const { width: w, height: h } = this.canvas;
    this.ctx.fillStyle = '#0a0f14';
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.font = '13px monospace';
    this.ctx.textBaseline = 'top';
    for (let row = -1; row < h / 18 + 1; row++) {
      const lineIndex = ((row + Math.floor(this.offset / 18)) % CODE_LINES.length + CODE_LINES.length) % CODE_LINES.length;
      const y = row * 18 - (this.offset % 18);
      this.ctx.fillStyle = lineIndex % 3 === 0 ? '#7ee787' : '#4a90d9';
      this.ctx.fillText(CODE_LINES[lineIndex], 12, y);
    }
    this.texture.needsUpdate = true;
  }
}
