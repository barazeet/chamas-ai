# Avatar Swivel And Idle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After five visible seconds of typing, swivel the chair and avatar toward camera, crossfade into seated idle, complete the look with restrained head rotation, and remain idle.

**Architecture:** Add a small, testable swivel timeline module that owns timing and camera-facing math. Refactor avatar animation loading so both clips are prepared before the first frame, then coordinate a shared chair/avatar pivot, animation crossfade, hand-correction fade, and post-mixer head adjustment from `main.ts`.

**Tech Stack:** TypeScript, three.js `AnimationMixer`, Mixamo FBX retargeting, Vite, Vitest, Chrome DevTools MCP.

---

## File Structure

- Create `src/swivel.ts`: pure timing/yaw calculations plus shared-pivot construction.
- Create `src/swivel.test.ts`: unit tests for timing, angle wrapping, target allocation, and transform preservation.
- Modify `src/avatar.ts`: prepare animation actions without immediately playing them; weight hand correction; apply optional head correction after mixer updates.
- Modify `src/main.ts`: preload both actions, construct the shared swivel rig, start the first-frame timer, trigger the crossfade once, and drive the timeline.
- Modify `package.json` and `package-lock.json`: add Vitest and a test script.
- Add `public/models/anims/Seated Idle.fbx`: runtime idle asset copied from references.

### Task 1: Add Tested Swivel Timing And Math

**Files:**
- Create: `src/swivel.ts`
- Create: `src/swivel.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install and expose the test runner**

Run:

```bash
npm install --save-dev vitest
npm pkg set scripts.test="vitest run"
```

Expected: `package.json` has a `test` script and `vitest` in `devDependencies`; the lockfile records the installation.

- [ ] **Step 2: Write failing tests for timeline and camera-facing math**

Create `src/swivel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  calculateSwivelTargets,
  createSwivelRig,
  getSwivelPose,
  shortestAngle,
} from './swivel';

describe('shortestAngle', () => {
  it('crosses the -pi/pi boundary by the short route', () => {
    const from = THREE.MathUtils.degToRad(170);
    const to = THREE.MathUtils.degToRad(-170);
    expect(THREE.MathUtils.radToDeg(shortestAngle(from, to))).toBeCloseTo(20);
  });
});

describe('calculateSwivelTargets', () => {
  it('assigns 80 percent of yaw to the rig and the remainder to the head', () => {
    const targets = calculateSwivelTargets(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1.5, 0),
      new THREE.Vector3(1, 1.5, 1),
      0,
    );
    expect(targets.rigYaw).toBeCloseTo(THREE.MathUtils.degToRad(36));
    expect(targets.headYaw).toBeCloseTo(THREE.MathUtils.degToRad(9));
    expect(targets.headPitch).toBeCloseTo(0);
  });

  it('clamps head yaw and pitch to natural limits', () => {
    const targets = calculateSwivelTargets(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(10, 20, 0),
      0,
    );
    expect(Math.abs(targets.headYaw)).toBeLessThanOrEqual(
      THREE.MathUtils.degToRad(25),
    );
    expect(Math.abs(targets.headPitch)).toBeLessThanOrEqual(
      THREE.MathUtils.degToRad(10),
    );
  });
});

describe('getSwivelPose', () => {
  const target = {
    rigYaw: 1,
    headYaw: 0.2,
    headPitch: 0.1,
  };

  it('types unchanged for the first five visible seconds', () => {
    expect(getSwivelPose(4.99, 0, target)).toEqual({
      phase: 'typing',
      rigYaw: 0,
      headYaw: 0,
      headPitch: 0,
      handWeight: 1,
    });
  });

  it('starts turning and fading hand correction at five seconds', () => {
    const pose = getSwivelPose(5.3, 0, target);
    expect(pose.phase).toBe('turning');
    expect(pose.rigYaw).toBeGreaterThan(0);
    expect(pose.rigYaw).toBeLessThan(1);
    expect(pose.handWeight).toBeGreaterThan(0);
    expect(pose.handWeight).toBeLessThan(1);
  });

  it('ends in a stable idle pose after the 1.4 second swivel', () => {
    expect(getSwivelPose(6.4, 0, target)).toEqual({
      phase: 'idle',
      rigYaw: 1,
      headYaw: 0.2,
      headPitch: 0.1,
      handWeight: 0,
    });
  });
});

describe('createSwivelRig', () => {
  it('preserves chair and avatar world positions when reparenting', () => {
    const scene = new THREE.Scene();
    const office = new THREE.Group();
    const chair = new THREE.Group();
    const avatar = new THREE.Group();
    office.position.set(2, 0, 3);
    chair.position.set(0.15, 0.045, -0.62);
    avatar.position.set(0.15, 0, -0.55);
    office.add(chair);
    scene.add(office, avatar);
    scene.updateMatrixWorld(true);
    const chairBefore = chair.getWorldPosition(new THREE.Vector3());
    const avatarBefore = avatar.getWorldPosition(new THREE.Vector3());

    const rig = createSwivelRig(scene, chair, avatar);
    scene.updateMatrixWorld(true);

    expect(chair.parent).toBe(rig);
    expect(avatar.parent).toBe(rig);
    expect(
      chair.getWorldPosition(new THREE.Vector3()).distanceTo(chairBefore),
    ).toBeLessThan(1e-10);
    expect(
      avatar.getWorldPosition(new THREE.Vector3()).distanceTo(avatarBefore),
    ).toBeLessThan(1e-10);
  });
});
```

- [ ] **Step 3: Run the tests and verify the expected red state**

Run:

```bash
npm test -- src/swivel.test.ts
```

Expected: FAIL because `./swivel` does not exist.

- [ ] **Step 4: Implement the minimal swivel module**

Create `src/swivel.ts`:

```ts
import * as THREE from 'three';

export type SwivelPhase = 'typing' | 'turning' | 'idle';

export interface SwivelTargets {
  rigYaw: number;
  headYaw: number;
  headPitch: number;
}

export interface SwivelPose extends SwivelTargets {
  phase: SwivelPhase;
  handWeight: number;
}

const TYPING_SECONDS = 5;
const SWIVEL_SECONDS = 1.4;
const CROSSFADE_SECONDS = 0.6;
const HEAD_YAW_LIMIT = THREE.MathUtils.degToRad(25);
const HEAD_PITCH_LIMIT = THREE.MathUtils.degToRad(10);

const clamp01 = (value: number): number => THREE.MathUtils.clamp(value, 0, 1);
const ease = (value: number): number => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

export function shortestAngle(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function calculateSwivelTargets(
  pivot: THREE.Vector3,
  head: THREE.Vector3,
  camera: THREE.Vector3,
  startYaw: number,
): SwivelTargets {
  const dx = camera.x - pivot.x;
  const dz = camera.z - pivot.z;
  const desiredYaw = Math.atan2(dx, dz);
  const totalYaw = shortestAngle(startYaw, desiredYaw);
  const horizontal = Math.hypot(camera.x - head.x, camera.z - head.z);
  const pitch = Math.atan2(camera.y - head.y, horizontal);
  return {
    rigYaw: startYaw + totalYaw * 0.8,
    headYaw: THREE.MathUtils.clamp(totalYaw * 0.2, -HEAD_YAW_LIMIT, HEAD_YAW_LIMIT),
    headPitch: THREE.MathUtils.clamp(pitch, -HEAD_PITCH_LIMIT, HEAD_PITCH_LIMIT),
  };
}

export function getSwivelPose(
  elapsedSeconds: number,
  startYaw: number,
  target: SwivelTargets,
): SwivelPose {
  if (elapsedSeconds < TYPING_SECONDS) {
    return {
      phase: 'typing',
      rigYaw: startYaw,
      headYaw: 0,
      headPitch: 0,
      handWeight: 1,
    };
  }
  const turnElapsed = elapsedSeconds - TYPING_SECONDS;
  const turn = ease(turnElapsed / SWIVEL_SECONDS);
  const fade = ease(turnElapsed / CROSSFADE_SECONDS);
  return {
    phase: turnElapsed < SWIVEL_SECONDS ? 'turning' : 'idle',
    rigYaw: THREE.MathUtils.lerp(startYaw, target.rigYaw, turn),
    headYaw: target.headYaw * turn,
    headPitch: target.headPitch * turn,
    handWeight: 1 - fade,
  };
}

export function createSwivelRig(
  scene: THREE.Scene,
  chair: THREE.Object3D,
  avatar: THREE.Object3D,
): THREE.Group {
  scene.updateMatrixWorld(true);
  const rig = new THREE.Group();
  rig.name = 'swivelRig';
  rig.position.copy(chair.getWorldPosition(new THREE.Vector3()));
  scene.add(rig);
  rig.attach(chair);
  rig.attach(avatar);
  return rig;
}
```

- [ ] **Step 5: Run tests and build**

Run:

```bash
npm test -- src/swivel.test.ts
npm run build
```

Expected: all swivel tests PASS; TypeScript and Vite build PASS.

- [ ] **Step 6: Commit the tested foundation**

```bash
git add package.json package-lock.json src/swivel.ts src/swivel.test.ts
git commit -m "test: define avatar swivel timeline"
```

### Task 2: Prepare Both Avatar Actions And Weighted Pose Corrections

**Files:**
- Modify: `src/avatar.ts`
- Add: `public/models/anims/Seated Idle.fbx`

- [ ] **Step 1: Copy the approved seated-idle asset**

Run:

```bash
cp "references/animations/Seated Idle.fbx" "public/models/anims/Seated Idle.fbx"
```

Expected: the runtime asset exists beside `Typing.fbx`; the reference asset is unchanged.

- [ ] **Step 2: Refactor clip preparation so loading does not immediately play**

In `src/avatar.ts`, rename `playClip` to `loadClip`, keep its retargeting and seat correction intact, and replace the final three lines with:

```ts
  const action = avatar.mixer.clipAction(retargeted);
  action.setLoop(THREE.LoopRepeat, Infinity);
  return action;
```

The exported signature becomes:

```ts
export async function loadClip(
  avatar: AvatarHandle,
  url: string,
): Promise<THREE.AnimationAction> {
```

- [ ] **Step 3: Add weighted hand and head post-processing**

Extend `AvatarHandle`:

```ts
export interface AvatarHandle {
  root: THREE.Group;
  skin: THREE.SkinnedMesh;
  mixer: THREE.AnimationMixer;
  handAdjust: HandAdjust[];
  head?: THREE.Bone;
}
```

Return the head from `loadAvatar`:

```ts
  const head = root.getObjectByName('Head') as THREE.Bone | undefined;
  return { root, skin, mixer, handAdjust, head };
```

Replace `applyHandAdjust` with:

The avatar faces +Z, and positive local X pitches +Z downward, so positive
camera elevation must use negative local-X pitch.

```ts
export interface PoseAdjustment {
  handWeight: number;
  headYaw: number;
  headPitch: number;
}

const adjustQuat = new THREE.Quaternion();
const headQuat = new THREE.Quaternion();
const headEuler = new THREE.Euler();

/** Apply AFTER mixer.update because the mixer overwrites bone quaternions. */
export function applyPoseAdjustment(
  avatar: AvatarHandle,
  adjustment: PoseAdjustment,
): void {
  for (const a of avatar.handAdjust) {
    a.bone.quaternion.multiply(
      adjustQuat.setFromAxisAngle(a.axis, a.angle * adjustment.handWeight),
    );
  }
  if (!avatar.head) return;
  headEuler.set(-adjustment.headPitch, adjustment.headYaw, 0);
  avatar.head.quaternion.multiply(headQuat.setFromEuler(headEuler));
}
```

- [ ] **Step 4: Build to catch interface and binding errors**

Run:

```bash
npm run build
```

Expected: FAIL in `src/main.ts` because it still imports `playClip` and `applyHandAdjust`. This is the intentional integration red state.

- [ ] **Step 5: Commit the avatar-side refactor and idle asset**

```bash
git add src/avatar.ts "public/models/anims/Seated Idle.fbx"
git commit -m "refactor: prepare avatar animation transitions"
```

### Task 3: Integrate Shared Swivel, Crossfade, And First-Frame Timer

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Replace imports with the new runtime APIs**

Use:

```ts
import { loadAvatar, loadClip, applyPoseAdjustment } from './avatar';
import {
  calculateSwivelTargets,
  createSwivelRig,
  getSwivelPose,
  type SwivelPhase,
} from './swivel';
```

- [ ] **Step 2: Prepare both clips and construct the shared pivot**

Replace the current avatar setup block with:

```ts
  const avatar = await loadAvatar(scene);
  const typingAction = await loadClip(avatar, '/models/anims/Typing.fbx');
  const idleAction = await loadClip(avatar, '/models/anims/Seated Idle.fbx');
  const chair = gltf.scene.getObjectByName('chair');
  if (!chair) throw new Error('office chair object missing');
  const swivelRig = createSwivelRig(scene, chair, avatar.root);
  const startYaw = swivelRig.rotation.y;
  const pivotWorld = swivelRig.getWorldPosition(new THREE.Vector3());
  const headWorld = (avatar.head ?? avatar.root).getWorldPosition(new THREE.Vector3());
  const targets = calculateSwivelTargets(
    pivotWorld,
    headWorld,
    camera.position,
    startYaw,
  );

  typingAction.reset().setEffectiveWeight(1).play();
  avatar.mixer.update(0);
```

Keep `__tuneHands`, but make it update the base forearm angle only; it remains a development hook and does not control transition weight.

- [ ] **Step 3: Drive the one-time transition from visible time**

Replace the animation-loop state and avatar update with:

```ts
  let firstFrame = true;
  let visibleAt: number | undefined;
  let transitionStarted = false;
  let phase: SwivelPhase = 'typing';
  let last = performance.now();

  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const elapsed = visibleAt === undefined ? 0 : (now - visibleAt) / 1000;
    const pose = getSwivelPose(elapsed, startYaw, targets);

    if (pose.phase !== 'typing' && !transitionStarted) {
      transitionStarted = true;
      idleAction.reset().setEffectiveWeight(1).play();
      typingAction.crossFadeTo(idleAction, 0.6, true);
    }

    phase = pose.phase;
    swivelRig.rotation.y = pose.rigYaw;
    avatar.mixer.update(dt);
    applyPoseAdjustment(avatar, pose);
    renderer.render(scene, camera);

    if (firstFrame) {
      firstFrame = false;
      visibleAt = now;
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 500);
    }
  });
```

Expose the runtime state in the existing debug handle immediately after the animation-loop state declarations (`visibleAt`, `transitionStarted`, and `phase`) so browser verification can inspect it without changing production behavior:

```ts
  Object.assign(
    (window as unknown as { __ctx: Record<string, unknown> }).__ctx,
    {
      avatar,
      chair,
      swivelRig,
      typingAction,
      idleAction,
      getPhase: () => phase,
    },
  );
```

- [ ] **Step 4: Run unit tests and production build**

Run:

```bash
npm test
npm run build
```

Expected: all tests PASS; TypeScript and Vite build PASS.

- [ ] **Step 5: Commit the runtime integration**

```bash
git add src/main.ts
git commit -m "feat: swivel avatar from typing to idle"
```

### Task 4: Browser Verification And Visual Tuning

**Files:**
- Modify if required: `src/swivel.ts`
- Modify if required: `src/avatar.ts`
- Modify if required: `src/main.ts`

- [ ] **Step 1: Reload the existing Vite session and wait for the office**

Open `http://localhost:3000/`, reload without cache, and wait for the loading overlay to disappear.

Expected: avatar types normally with the approved seat, keyboard, and hand placement.

- [ ] **Step 2: Verify the timer starts after visibility**

Immediately after the first visible frame, evaluate:

```js
window.__ctx.getPhase()
```

Expected during the first five seconds: `"typing"`.

- [ ] **Step 3: Verify the completed transition numerically**

After seven visible seconds, evaluate:

```js
({
  phase: window.__ctx.getPhase(),
  rigYaw: window.__ctx.swivelRig.rotation.y,
  typingWeight: window.__ctx.typingAction.getEffectiveWeight(),
  idleWeight: window.__ctx.idleAction.getEffectiveWeight(),
  chairParent: window.__ctx.chair.parent.name,
  avatarParent: window.__ctx.avatar.root.parent.name,
})
```

Expected:

```js
{
  phase: 'idle',
  typingWeight: 0,
  idleWeight: 1,
  chairParent: 'swivelRig',
  avatarParent: 'swivelRig',
}
```

`rigYaw` must be non-zero and stable across repeated samples.

- [ ] **Step 4: Verify the visual acceptance criteria**

Capture screenshots before the turn, midway through the turn, and after idle settles. Confirm:

- chair and avatar remain aligned throughout the turn;
- butt remains on the seat and feet do not detach from the seated pose;
- no desk clipping or T-pose appears during crossfade;
- typing hand correction fades away rather than snapping;
- head rotation is restrained and faces the camera;
- the final idle pose remains stable and does not restart.

If visual tuning is needed, change only these approved constants and rerun Steps 1-4:

```ts
const SWIVEL_SECONDS = 1.4;
const CROSSFADE_SECONDS = 0.6;
const HEAD_YAW_LIMIT = THREE.MathUtils.degToRad(25);
const HEAD_PITCH_LIMIT = THREE.MathUtils.degToRad(10);
```

- [ ] **Step 5: Run final verification**

Run:

```bash
npm test
npm run build
git diff --check
git status --short
```

Expected: tests and build PASS; no whitespace errors; status contains only intentional tuning changes, if any.

- [ ] **Step 6: Commit visual tuning only if required**

```bash
git add src/swivel.ts src/avatar.ts src/main.ts
git commit -m "fix: tune avatar swivel and camera look"
```

Skip this commit if browser verification required no code changes.

- [ ] **Step 7: Push the completed feature**

Before pushing, inspect `git status --short`, `git diff`, and `git log --oneline -10`. Then run:

```bash
git push
```

Expected: local `HEAD` and upstream `main` resolve to the same commit.
