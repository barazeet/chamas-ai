import * as THREE from 'three';

export type ScreenMode = 'agents' | 'board';

// Palette: dark "product tool" UI (Linear dark mode), matching the real
// monitors in the reference photos which run dark themes.
const BG = '#14161b';
const PANEL = '#1d2026';
const BORDER = '#2c3038';
const TEXT = '#d7dae0';
const MUTED = '#6b7280';
const GREEN = '#34c759';
const ACCENT = '#5b8def';
const AMBER = '#e0a34a';

interface AgentTask {
  title: string;
  status: 'done' | 'active' | 'queued';
}

const AGENT_TASKS: string[] = [
  'triage 6 inbound issues',
  'draft v0.4 release notes',
  'review PR #142 · auth flow',
  'weekly metrics digest',
  'competitor watch · wk34',
  'reply to community threads',
  'roadmap cleanup · Q3',
];

const BOARD_CARDS = [
  'agent onboarding flow',
  'voice clone pass 2',
  'pricing page copy',
  'churn email sequence',
  'mobile nav polish',
  'analytics events spec',
  'beta invite batch 3',
  'docs: quickstart rewrite',
];

/**
 * One monitor's content. Two modes, both slowly alive on their own:
 *  - 'agents': a task list where agents check off work over time
 *  - 'board':  a kanban where cards drift from doing to done
 * `speed` scales the rate of progress (cranked while the character "thinks").
 */
export class ScreenDisplay {
  readonly texture: THREE.CanvasTexture;
  speed = 1;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private t: number;

  constructor(
    private mode: ScreenMode = 'agents',
    width = 512,
    height = 288,
    initialTime = 0,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.t = initialTime;
  }

  // Redrawn every frame on purpose: content itself evolves (task state,
  // pulsing indicators), which static UV tricks can't express.
  update(dt: number): void {
    this.t += dt * this.speed;
    if (this.mode === 'agents') this.drawAgents();
    else this.drawBoard();
    this.texture.needsUpdate = true;
  }

  // ---- agents mode: tasks complete on a cycle, one "active" at a time ----

  private agentTasks(): AgentTask[] {
    const n = AGENT_TASKS.length;
    // One task is active; it completes every ~6s and the queue rotates.
    const activeIdx = Math.floor(this.t / 6) % n;
    return AGENT_TASKS.map((title, i) => ({
      title,
      status: i === activeIdx ? 'active' : i < activeIdx ? 'done' : 'queued',
    }));
  }

  private drawAgents(): void {
    const { ctx } = this;
    const { width: w, height: h } = this.canvas;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = MUTED;
    ctx.fillText('AGENTS', 16, 22);
    ctx.font = '11px monospace';
    ctx.fillText(`${AGENT_TASKS.length} running`, w - 86, 22);

    const tasks = this.agentTasks();
    const activeIdx = tasks.findIndex((t) => t.status === 'active');
    const rowH = 30;
    let y = 44;
    for (const task of tasks) {
      ctx.fillStyle = PANEL;
      ctx.strokeStyle = BORDER;
      ctx.beginPath();
      ctx.roundRect(12, y, w - 24, rowH - 6, 5);
      ctx.fill();
      ctx.stroke();

      let icon = '○';
      let iconColor = MUTED;
      if (task.status === 'done') {
        icon = '●';
        iconColor = GREEN;
      } else if (task.status === 'active') {
        icon = '●';
        iconColor = ACCENT;
      }
      ctx.font = '12px monospace';
      ctx.fillStyle = iconColor;
      ctx.fillText(icon, 20, y + (rowH - 6) / 2);

      ctx.fillStyle = task.status === 'queued' ? MUTED : TEXT;
      ctx.fillText(task.title, 40, y + (rowH - 6) / 2);

      if (task.status === 'active') {
        // progress bar sweeping 0→1 over the task's 6s window
        const progress = (this.t % 6) / 6;
        ctx.fillStyle = BORDER;
        ctx.fillRect(w - 120, y + (rowH - 6) / 2 - 2, 88, 4);
        ctx.fillStyle = ACCENT;
        ctx.fillRect(w - 120, y + (rowH - 6) / 2 - 2, 88 * progress, 4);
      }
      y += rowH;
    }

    // subtle pulse on the active task's dot
    if (activeIdx >= 0 && Math.sin(this.t * 4) > 0) {
      ctx.fillStyle = ACCENT;
      ctx.fillText('●', 20, 44 + activeIdx * rowH + (rowH - 6) / 2);
    }
  }

  // ---- board mode: cards drift doing → done, new ones appear in next ----

  private drawBoard(): void {
    const { ctx } = this;
    const { width: w, height: h } = this.canvas;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = MUTED;
    ctx.fillText('BOARD', 16, 22);

    const n = BOARD_CARDS.length;
    // Every ~7s one card completes: done count grows, then resets.
    const doneCount = Math.floor(this.t / 7) % (n - 2);
    const columns: Array<{ name: string; color: string; cards: string[] }> = [
      { name: 'NEXT', color: MUTED, cards: BOARD_CARDS.slice(doneCount + 2, doneCount + 4) },
      { name: 'DOING', color: AMBER, cards: BOARD_CARDS.slice(doneCount, doneCount + 2) },
      { name: 'DONE', color: GREEN, cards: BOARD_CARDS.slice(Math.max(0, doneCount - 3), doneCount) },
    ];

    const colW = (w - 24 - 16) / 3;
    let x = 12;
    for (const col of columns) {
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = col.color;
      ctx.fillText(col.name, x + 6, 46);
      let y = 62;
      for (const card of col.cards) {
        ctx.fillStyle = PANEL;
        ctx.strokeStyle = BORDER;
        ctx.beginPath();
        ctx.roundRect(x, y, colW, 40, 5);
        ctx.fill();
        ctx.stroke();
        ctx.font = '10px monospace';
        ctx.fillStyle = TEXT;
        this.wrapText(card, x + 8, y + 14, colW - 16, 12);
        y += 48;
      }
      x += colW + 8;
    }

    // bottom roadmap strip: quarter progress
    const progress = (this.t % 30) / 30;
    ctx.fillStyle = BORDER;
    ctx.fillRect(12, h - 26, w - 24, 5);
    ctx.fillStyle = GREEN;
    ctx.fillRect(12, h - 26, (w - 24) * progress, 5);
    ctx.font = '10px monospace';
    ctx.fillStyle = MUTED;
    ctx.fillText('Q3 ROADMAP', 12, h - 38);
  }

  private wrapText(text: string, x: number, y: number, maxW: number, lineH: number): void {
    const words = text.split(' ');
    let line = '';
    let dy = 0;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (this.ctx.measureText(test).width > maxW && line) {
        this.ctx.fillText(line, x, y + dy);
        line = word;
        dy += lineH;
      } else {
        line = test;
      }
    }
    this.ctx.fillText(line, x, y + dy);
  }
}
