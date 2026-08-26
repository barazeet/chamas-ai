import { describe, expect, test } from 'vitest';
import source from './main.ts?raw';

describe('avatar camera tracking integration', () => {
  test('calculates swivel targets from the pivot and camera only', () => {
    expect(source).not.toContain('const headLocal =');
    expect(source).toMatch(
      /calculateSwivelTargets\(\s*pivotLocal,\s*cameraLocal,\s*startYaw,?\s*\)/,
    );
  });

  test('tracks the camera from the current mixed pose and rig yaw before rendering', () => {
    const rigYaw = source.indexOf('swivelRig.rotation.y = pose.rigYaw;');
    const mixerUpdate = source.lastIndexOf('avatar.mixer.update', rigYaw);
    const poseAdjustment = source.indexOf('applyPoseAdjustment(avatar, pose);', rigYaw);
    const cameraLook = source.indexOf(
      'applyCameraLook(avatar, camera, pose.lookWeight, dt);',
      poseAdjustment,
    );
    const render = source.indexOf('renderer.render(scene, camera);', cameraLook);

    expect(source).toMatch(/import \{[^}]*applyCameraLook[^}]*\} from '.\/avatar';/s);
    expect(mixerUpdate).toBeGreaterThan(-1);
    expect(rigYaw).toBeGreaterThan(mixerUpdate);
    expect(poseAdjustment).toBeGreaterThan(rigYaw);
    expect(cameraLook).toBeGreaterThan(poseAdjustment);
    expect(render).toBeGreaterThan(cameraLook);
  });
});
