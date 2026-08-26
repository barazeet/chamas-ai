import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { calculateLookAngles, dampAngle } from './look';

const degrees = THREE.MathUtils.degToRad;

describe('calculateLookAngles', () => {
  test('calculates yaw and upward-positive pitch from a local direction', () => {
    const angles = calculateLookAngles(
      new THREE.Vector3(1, 1, 1).normalize(),
      degrees(90),
      degrees(90),
    );

    expect(angles.yaw).toBeCloseTo(degrees(45));
    expect(angles.pitch).toBeCloseTo(Math.atan2(1, Math.sqrt(2)));
  });

  test('clamps positive and negative extreme directions symmetrically', () => {
    const positive = calculateLookAngles(
      new THREE.Vector3(1, 1, 0),
      degrees(30),
      degrees(25),
    );
    const negative = calculateLookAngles(
      new THREE.Vector3(-1, -1, 0),
      degrees(30),
      degrees(25),
    );

    expect(positive).toEqual({ yaw: degrees(30), pitch: degrees(25) });
    expect(negative).toEqual({ yaw: degrees(-30), pitch: degrees(-25) });
  });

  test('mutates and returns a supplied output object', () => {
    const output = { yaw: 0, pitch: 0 };

    const angles = calculateLookAngles(
      new THREE.Vector3(1, 1, 1).normalize(),
      degrees(90),
      degrees(90),
      output,
    );

    expect(angles).toBe(output);
    expect(output.yaw).toBeCloseTo(degrees(45));
    expect(output.pitch).toBeCloseTo(Math.atan2(1, Math.sqrt(2)));
  });
});

describe('dampAngle', () => {
  test('is frame-rate independent', () => {
    let stepped = 0;
    for (let frame = 0; frame < 60; frame += 1) {
      stepped = dampAngle(stepped, 1, 6, 1 / 60);
    }

    expect(stepped).toBeCloseTo(dampAngle(0, 1, 6, 1), 10);
  });

  test('leaves the current angle unchanged for zero delta', () => {
    expect(dampAngle(0.75, 1, 6, 0)).toBe(0.75);
  });
});
