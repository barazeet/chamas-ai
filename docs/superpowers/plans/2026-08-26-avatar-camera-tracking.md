# Avatar Camera Tracking And Hand Clearance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the idle right wrist about 2cm and continuously track the moving camera with a smoothly damped head and conjugate eyes after the swivel begins.

**Architecture:** Replace fixed timeline head angles with a look activation weight. Keep camera-independent damping and angle calculations in a tested `look.ts` module, then apply dynamic post-mixer head and identical two-eye corrections from `avatar.ts` using the current animated pose each frame.

**Tech Stack:** TypeScript, three.js bones/quaternions, Vitest, Vite, Chrome DevTools MCP.

---

## File Structure

- Create `src/look.ts`: pure direction-to-angle, clamping, and exponential damping helpers.
- Create `src/look.test.ts`: frame-rate independence and clamp coverage.
- Modify `src/swivel.ts` and `src/swivel.test.ts`: timeline emits `lookWeight` instead of fixed head angles.
- Modify `src/avatar.ts` and `src/avatar.test.ts`: idle right-forearm correction and post-mixer head/conjugate-eye tracking.
- Modify `src/main.ts`: pass the live camera, activation weight, and frame delta to the look controller.

### Task 1: Replace Fixed Head Targets With Tested Live-Look Inputs

**Files:**
- Create: `src/look.ts`
- Create: `src/look.test.ts`
- Modify: `src/swivel.ts`
- Modify: `src/swivel.test.ts`

- [ ] **Step 1: Write failing tests for look math**

Create `src/look.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { calculateLookAngles, dampAngle } from './look';

const degrees = THREE.MathUtils.degToRad;

describe('calculateLookAngles', () => {
  test('returns yaw and upward-positive pitch for a local direction', () => {
    const result = calculateLookAngles(
      new THREE.Vector3(1, 1, 1).normalize(),
      degrees(90),
      degrees(90),
    );
    expect(result.yaw).toBeCloseTo(degrees(45));
    expect(result.pitch).toBeCloseTo(
      Math.atan2(1, Math.sqrt(2)),
    );
  });

  test('clamps both positive and negative yaw and pitch', () => {
    const positive = calculateLookAngles(
      new THREE.Vector3(10, 10, 0.01).normalize(),
      degrees(30),
      degrees(25),
    );
    const negative = calculateLookAngles(
      new THREE.Vector3(-10, -10, 0.01).normalize(),
      degrees(30),
      degrees(25),
    );
    expect(positive).toEqual({ yaw: degrees(30), pitch: degrees(25) });
    expect(negative).toEqual({ yaw: degrees(-30), pitch: degrees(-25) });
  });
});

describe('dampAngle', () => {
  test('is frame-rate independent over the same elapsed time', () => {
    let sixtySteps = 0;
    for (let i = 0; i < 60; i += 1) {
      sixtySteps = dampAngle(sixtySteps, 1, 6, 1 / 60);
    }
    const oneStep = dampAngle(0, 1, 6, 1);
    expect(sixtySteps).toBeCloseTo(oneStep, 10);
  });

  test('does not advance for zero delta', () => {
    expect(dampAngle(0.25, 1, 6, 0)).toBe(0.25);
  });
});
```

- [ ] **Step 2: Run the look test and verify red**

Run:

```bash
npm test -- src/look.test.ts
```

Expected: FAIL because `./look` does not exist.

- [ ] **Step 3: Implement the pure look helpers**

Create `src/look.ts`:

```ts
import * as THREE from 'three';

export interface LookAngles {
  yaw: number;
  pitch: number;
}

export function calculateLookAngles(
  localDirection: THREE.Vector3,
  maxYaw: number,
  maxPitch: number,
): LookAngles {
  const horizontal = Math.hypot(localDirection.x, localDirection.z);
  return {
    yaw: THREE.MathUtils.clamp(
      Math.atan2(localDirection.x, localDirection.z),
      -maxYaw,
      maxYaw,
    ),
    pitch: THREE.MathUtils.clamp(
      Math.atan2(localDirection.y, horizontal),
      -maxPitch,
      maxPitch,
    ),
  };
}

export function dampAngle(
  current: number,
  target: number,
  response: number,
  delta: number,
): number {
  const alpha = 1 - Math.exp(-response * Math.max(delta, 0));
  return THREE.MathUtils.lerp(current, target, alpha);
}
```

- [ ] **Step 4: Write failing timeline tests for `lookWeight`**

Update `src/swivel.test.ts` so `SwivelTargets` fixtures contain only `rigYaw`, remove fixed head-angle assertions, and assert:

```ts
expect(getSwivelPose(4.99, 0, target)).toEqual({
  phase: 'typing',
  rigYaw: 0,
  handWeight: 1,
  lookWeight: 0,
});

const turning = getSwivelPose(5.3, 0, target);
expect(turning.lookWeight).toBeGreaterThan(0);
expect(turning.lookWeight).toBeLessThan(1);

expect(getSwivelPose(6.4, 0, target)).toEqual({
  phase: 'idle',
  rigYaw: target.rigYaw,
  handWeight: 0,
  lookWeight: 1,
});
```

Change `calculateSwivelTargets` calls to omit the head argument:

```ts
calculateSwivelTargets(pivot, camera, startYaw)
```

Keep shortest-angle, zero-planar-direction, visible-delta, and transform-preservation tests unchanged.

- [ ] **Step 5: Run swivel tests and verify red**

Run:

```bash
npm test -- src/swivel.test.ts
```

Expected: FAIL because production types still expose fixed head angles and do not expose `lookWeight`.

- [ ] **Step 6: Implement the timeline model change**

In `src/swivel.ts`:

```ts
export interface SwivelTargets {
  rigYaw: number;
}

export interface SwivelPose extends SwivelTargets {
  phase: SwivelPhase;
  handWeight: number;
  lookWeight: number;
}
```

Change `calculateSwivelTargets` to calculate only the 80% rig yaw:

```ts
export function calculateSwivelTargets(
  pivot: THREE.Vector3,
  camera: THREE.Vector3,
  startYaw: number,
): SwivelTargets {
  const dx = camera.x - pivot.x;
  const dz = camera.z - pivot.z;
  const planarDistance = Math.hypot(dx, dz);
  const yawDelta =
    planarDistance <= 1e-10
      ? 0
      : shortestAngle(startYaw, Math.atan2(dx, dz));
  return { rigYaw: startYaw + yawDelta * 0.8 };
}
```

Return `lookWeight: 0` during typing, `lookWeight: swivelProgress` while turning, and `lookWeight: 1` in idle. Remove fixed head yaw/pitch constants and interpolation.

- [ ] **Step 7: Run tests and build**

Run:

```bash
npm test
npm run build
```

Expected: look/swivel tests PASS; build FAIL only where `main.ts` still passes the removed head argument and `avatar.ts` still expects fixed head angles. Record exact errors for Task 2.

- [ ] **Step 8: Commit the tested timeline foundation**

```bash
git add src/look.ts src/look.test.ts src/swivel.ts src/swivel.test.ts
git commit -m "refactor: expose live avatar look weight"
```

### Task 2: Add Idle Hand Clearance And Conjugate Camera Tracking

**Files:**
- Modify: `src/avatar.ts`
- Modify: `src/avatar.test.ts`

- [ ] **Step 1: Write failing idle-hand tests**

Replace fixed head fields in `PoseAdjustment` fixtures with only `handWeight`, and broaden the test helper so it can construct focused partial handles:

```ts
const noAdjustment: PoseAdjustment = { handWeight: 0 };

function avatarWith(values: Partial<AvatarHandle>): AvatarHandle {
  return values as AvatarHandle;
}
```

Delete the old fixed-head-pitch unit test; dynamic head direction is covered by the look-controller tests below. Add tests proving the right forearm transitions between corrections:

```ts
test('replaces typing correction with idle right-hand lift', () => {
  const left = new THREE.Bone();
  const right = new THREE.Bone();
  const axis = new THREE.Vector3(1, 0, 0);
  const avatar = avatarWith({
    handAdjust: [
      { bone: left, axis, angle: 0.2 },
      { bone: right, axis, angle: 0.2 },
    ],
    rightForearm: right,
  });

  applyPoseAdjustment(avatar, { handWeight: 0 });

  const expected = new THREE.Quaternion().setFromAxisAngle(axis, -0.15);
  expect(right.quaternion.angleTo(expected)).toBeCloseTo(0);
  expect(left.quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(0);
});

test('blends rather than stacks right-forearm corrections', () => {
  const right = new THREE.Bone();
  const axis = new THREE.Vector3(1, 0, 0);
  applyPoseAdjustment(
    avatarWith({
      handAdjust: [{ bone: right, axis, angle: 0.2 }],
      rightForearm: right,
    }),
    { handWeight: 0.5 },
  );
  const expectedAngle = 0.2 * 0.5 + -0.15 * 0.5;
  const expected = new THREE.Quaternion().setFromAxisAngle(axis, expectedAngle);
  expect(right.quaternion.angleTo(expected)).toBeCloseTo(0);
});
```

- [ ] **Step 2: Write failing conjugate-eye tests**

Add tests for a new exported `applyCameraLook`:

```ts
test('applies exactly the same correction to both eyes', () => {
  const root = new THREE.Group();
  const head = new THREE.Bone();
  const leftEye = new THREE.Bone();
  const rightEye = new THREE.Bone();
  head.add(leftEye, rightEye);
  root.add(head);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(2, 2, 4);
  root.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const avatar = avatarWith({
    root,
    head,
    leftEye,
    rightEye,
    lookState: { headYaw: 0, headPitch: 0, eyeYaw: 0, eyePitch: 0 },
  });

  applyCameraLook(avatar, camera, 1, 1);

  expect(leftEye.quaternion.angleTo(rightEye.quaternion)).toBeCloseTo(0);
});

test('does not rotate a lone eye', () => {
  const root = new THREE.Group();
  const head = new THREE.Bone();
  const leftEye = new THREE.Bone();
  head.add(leftEye);
  root.add(head);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(2, 2, 4);
  root.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const avatar = avatarWith({
    root,
    head,
    leftEye,
    rightEye: undefined,
    lookState: { headYaw: 0, headPitch: 0, eyeYaw: 0, eyePitch: 0 },
  });
  const before = leftEye.quaternion.clone();

  applyCameraLook(avatar, camera, 1, 1);

  expect(leftEye.quaternion.angleTo(before)).toBeCloseTo(0);
});
```

- [ ] **Step 3: Run avatar tests and verify red**

Run:

```bash
npm test -- src/avatar.test.ts
```

Expected: FAIL because the new avatar fields and `applyCameraLook` do not exist.

- [ ] **Step 4: Extend avatar state and loading**

In `src/avatar.ts`, add:

```ts
export interface LookState {
  headYaw: number;
  headPitch: number;
  eyeYaw: number;
  eyePitch: number;
}

export interface AvatarHandle {
  // existing fields
  rightForearm?: THREE.Bone;
  head?: THREE.Bone;
  leftEye?: THREE.Bone;
  rightEye?: THREE.Bone;
  lookState: LookState;
}

export interface PoseAdjustment {
  handWeight: number;
}
```

In `loadAvatar`, resolve `RightForeArm`, `Head`, `LeftEye`, and `RightEye`, then return zeroed `lookState`.

- [ ] **Step 5: Implement the right-forearm blend**

Keep the existing typing correction loop. Then apply the idle correction:

```ts
const IDLE_RIGHT_FOREARM_ANGLE = -0.15;

if (avatar.rightForearm) {
  avatar.rightForearm.quaternion.multiply(
    adjustQuat.setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      IDLE_RIGHT_FOREARM_ANGLE * (1 - adjustment.handWeight),
    ),
  );
}
```

Use a module-level X axis vector instead of allocating the vector shown inline.

- [ ] **Step 6: Implement post-mixer camera tracking**

Import `calculateLookAngles` and `dampAngle` from `./look`. Add module-level scratch vectors, quaternions, and Euler instances. Implement:

```ts
export function applyCameraLook(
  avatar: AvatarHandle,
  camera: THREE.Camera,
  lookWeight: number,
  delta: number,
): void
```

Required algorithm:

1. Return immediately if `avatar.head` is missing.
2. Obtain camera world position into a scratch vector.
3. Convert that point with `head.worldToLocal`, normalize it, and calculate head angles with 30-degree yaw and 25-degree pitch limits.
4. Multiply targets by `lookWeight`, damp state at response 6, and apply `Euler(-headPitch, headYaw, 0)` additively to the mixer-produced head quaternion.
5. Update head/eye world matrices after the head correction.
6. If either eye is missing, return without touching either eye.
7. Compute the midpoint of both eye world positions and camera direction in corrected-head local space.
8. Calculate shared eye angles with 12-degree yaw and 8-degree pitch limits, multiply targets by `lookWeight`, and damp at response 12.
9. Build one correction quaternion from `Euler(-eyePitch, eyeYaw, 0)` and multiply that exact quaternion into both eye bones.

Do not allocate objects inside this function.

- [ ] **Step 7: Run tests and build**

Run:

```bash
npm test
npm run build
```

Expected: all unit tests PASS; build still FAILS only until `main.ts` integrates the new signatures.

- [ ] **Step 8: Commit avatar tracking**

```bash
git add src/avatar.ts src/avatar.test.ts
git commit -m "feat: track camera with avatar head and eyes"
```

### Task 3: Integrate, Verify, Tune, And Push

**Files:**
- Modify: `src/main.ts`
- Modify only if visual tuning requires it: `src/avatar.ts`, `src/look.ts`

- [ ] **Step 1: Integrate the new target and pose APIs**

In `src/main.ts`:

```ts
import {
  applyCameraLook,
  applyPoseAdjustment,
  loadAvatar,
  loadClip,
} from './avatar';
```

Remove `headLocal` and call:

```ts
const targets = calculateSwivelTargets(pivotLocal, cameraLocal, startYaw);
```

After mixer update and rig yaw assignment:

```ts
applyPoseAdjustment(avatar, pose);
applyCameraLook(avatar, camera, pose.lookWeight, dt);
renderer.render(scene, camera);
```

Tracking must execute after mixer update and after the rig yaw for the current frame.

- [ ] **Step 2: Run automated verification**

Run:

```bash
npm test
npm run build
```

Expected: all tests and production build PASS.

- [ ] **Step 3: Verify hand clearance in the browser**

Reload `http://localhost:3000/`, wait for idle, then measure `RightHand` world Y and compare with the desk/keyboard plane.

Expected: right wrist rises from baseline `0.7287` to about `0.7472`, no longer intersecting the desk.

- [ ] **Step 4: Verify dynamic head and conjugate-eye tracking**

In final idle:

1. Measure head +Z world-forward against direction to camera; the angle must be visually aligned and materially lower than the 20.49-degree baseline.
2. Save both eye local quaternions and confirm their correction quaternions match.
3. Move the camera to at least two temporary positions through `window.__ctx.camera.position`, update its matrix, and confirm head/eye angles change toward each position.
4. Restore the original camera position.
5. Capture a final screenshot and inspect for natural head motion, parallel eyes, seat alignment, and desk clearance.

- [ ] **Step 5: Tune only within approved limits if necessary**

Allowed maxima:

```ts
head yaw: 30 degrees
head pitch: 25 degrees
eye yaw: 12 degrees
eye pitch: 8 degrees
head response: 6 per second
eye response: 12 per second
right forearm idle angle: -0.15 rad
```

Limits may be reduced, not increased. Any tuning change must retain or extend unit coverage.

- [ ] **Step 6: Commit integration and any approved tuning**

```bash
git add src/main.ts src/avatar.ts src/look.ts
git commit -m "feat: follow camera from seated idle"
```

Stage only files that actually changed.

- [ ] **Step 7: Final verification and push**

Run:

```bash
npm test
npm run build
git diff --check
git status --short
git log --oneline -10
```

After final code review approves the complete feature:

```bash
git push
```

Expected: local `HEAD` and upstream `main` match; worktree is clean.
