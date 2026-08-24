import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Palette matched to the reference photos: white sit-stand desk, black
// leather/mat, warm beige tile, dark screens, golden-hour light.
const WHITE_DESK = new THREE.MeshStandardMaterial({ color: 0xe9e7e3, roughness: 0.6 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.85 });
const PLASTIC = new THREE.MeshStandardMaterial({ color: 0x232529, roughness: 0.5 });
const MAT = new THREE.MeshStandardMaterial({ color: 0x241c15, roughness: 0.98 });
const LEATHER = new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.45 });
const RED_MIC = new THREE.MeshStandardMaterial({ color: 0xa8282a, roughness: 0.5 });
const FOAM = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 1 });
const MESH_NET = new THREE.MeshStandardMaterial({ color: 0x24402e, wireframe: true });
const PVC = new THREE.MeshStandardMaterial({ color: 0xe5e2dc, roughness: 0.5 });
const LED = new THREE.MeshStandardMaterial({
  color: 0x001133, emissive: 0x2266ff, emissiveIntensity: 2.0,
});
const RGB_STRIP = new THREE.MeshStandardMaterial({
  color: 0x111111, emissive: 0x33ff88, emissiveIntensity: 1.6,
});
const CABLE_DARK = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.9 });
const CABLE_WHITE = new THREE.MeshStandardMaterial({ color: 0xd8d5d0, roughness: 0.8 });
const CABLE_BLUE = new THREE.MeshStandardMaterial({ color: 0x2b5f9e, roughness: 0.8 });
const WALL = new THREE.MeshStandardMaterial({ color: 0xf5e8d4, roughness: 1 });
const RED_CAN = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 });
const BOTTLE = new THREE.MeshStandardMaterial({ color: 0xf0ece4, roughness: 0.4 });
// Template for screen materials — always .clone() it, never mutate in place:
const SCREEN_OFF = new THREE.MeshStandardMaterial({
  color: 0x0a0c10, emissive: 0x12161d, emissiveIntensity: 0.8,
});

// Golden-hour window view: warm gradient sky with building silhouettes
// (canvas unavailable in the node test env, hence the guard).
function makeWindowTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 216;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 216);
  grad.addColorStop(0, '#ffd9a0');
  grad.addColorStop(0.6, '#ffbe78');
  grad.addColorStop(1, '#f0a05f');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 216);
  // neighboring apartment blocks in silhouette (per the photos)
  g.fillStyle = 'rgba(88,74,66,0.85)';
  g.fillRect(8, 60, 62, 156);
  g.fillRect(84, 30, 58, 186);
  g.fillStyle = 'rgba(70,58,52,0.9)';
  g.fillRect(156, 84, 52, 132);
  g.fillRect(216, 52, 40, 164);
  // lit windows on the silhouettes
  g.fillStyle = 'rgba(255,220,150,0.7)';
  for (const [bx, by] of [[20, 76], [44, 108], [96, 48], [118, 92], [168, 100], [226, 68]] as const) {
    g.fillRect(bx, by, 8, 10);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Beige ceramic floor tiles with grout lines.
function makeTileTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  const TONES = ['#c9bda9', '#c4b7a3', '#cec1ad', '#c2b5a0'];
  const PER = 4;
  const size = 512 / PER;
  for (let y = 0; y < PER; y++) {
    for (let x = 0; x < PER; x++) {
      g.fillStyle = TONES[(x + y * PER) % TONES.length];
      g.fillRect(x * size, y * size, size, size);
      g.fillStyle = 'rgba(120,105,88,0.06)';
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.arc(x * size + ((i * 37) % size), y * size + ((i * 53) % size), 12 + (i % 3) * 8, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = '#ab9d88';
      g.lineWidth = 3;
      g.strokeRect(x * size + 1.5, y * size + 1.5, size - 3, size - 3);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Key-cap grid for the keyboard (same node-env guard).
function makeKeyTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1c1e22';
  g.fillRect(0, 0, 256, 96);
  g.fillStyle = '#2e3238';
  const cols = 14;
  const rows = 5;
  const kw = 256 / cols;
  const kh = 96 / rows;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      g.beginPath();
      g.roundRect(k * kw + 2, r * kh + 2, kw - 4, kh - 4, 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(
  name: string,
  w: number, h: number, d: number,
  x: number, y: number, z: number,
  material: THREE.Material,
): THREE.Mesh {
  // Soft real-world edges: small bevel on every box (razor-sharp edges are
  // the #1 "low-poly toy" tell).
  const radius = Math.min(0.015, w / 4, h / 4, d / 4);
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, radius), material);
  mesh.position.set(x, y, z);
  mesh.name = name;
  return mesh;
}

function cable(
  name: string,
  points: Array<[number, number, number]>,
  material: THREE.Material,
  radius = 0.008,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 6), material);
  mesh.name = name;
  return mesh;
}

function buildMonitor(name: string, x: number, angle: number): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  // slim bezel frame behind the panel
  group.add(box('bezel', 0.64, 0.38, 0.02, 0, 0.28, -0.01, DARK));
  // NOTE: plain BoxGeometry for the screen — RoundedBoxGeometry's +z face UVs
  // are mirrored, which flips the CanvasTexture content.
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 0.015), SCREEN_OFF.clone());
  screen.position.set(0, 0.28, 0.002);
  screen.name = 'screen';
  group.add(screen);
  group.add(box('arm-mount', 0.08, 0.08, 0.06, 0, 0.22, -0.06, DARK));
  group.position.set(x, 0.86, -0.3);
  group.rotation.y = angle;
  return group;
}

// One RTX 3090 hanging off the rig: chunky 3-fan card, RGB edge strip.
function buildGpu(): THREE.Group {
  const gpu = new THREE.Group();
  gpu.add(box('gpu-card', 0.27, 0.12, 0.05, 0, 0, 0, PLASTIC));
  for (const fx of [-0.085, 0, 0.085]) {
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.055, 20), DARK);
    fan.rotation.x = Math.PI / 2;
    fan.position.set(fx, 0, 0.005);
    gpu.add(fan);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.058, 10), PLASTIC);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(fx, 0, 0.005);
    gpu.add(hub);
  }
  gpu.add(box('gpu-rgb', 0.27, 0.012, 0.012, 0, 0.066, 0, RGB_STRIP));
  // backplate bracket
  gpu.add(box('gpu-bracket', 0.012, 0.14, 0.06, -0.145, 0, 0, DARK));
  return gpu;
}

// The crazy build: a sideways open frame inside the DIY cage, with FOUR
// RTX 3090s hanging off it on risers, mesh netting over a white PVC frame.
function buildCagedPc(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'tower';

  const W = 0.5, H = 0.62, D = 0.62;
  // white PVC frame: 4 verticals, 8 horizontals
  for (const [px, pz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]] as const) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, H, 10), PVC);
    pipe.position.set(px, H / 2, pz);
    group.add(pipe);
  }
  for (const py of [0.014, H - 0.014]) {
    for (const pz of [-D / 2, D / 2]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, W, 10), PVC);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, py, pz);
      group.add(pipe);
    }
    for (const px of [-W / 2, W / 2]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, D, 10), PVC);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(px, py, 0);
      group.add(pipe);
    }
  }

  // open frame, flipped sideways: white tray + motherboard + PSU at bottom
  group.add(box('tray', 0.42, 0.02, 0.54, 0, 0.1, 0, PVC));
  group.add(box('motherboard', 0.3, 0.03, 0.34, -0.03, 0.14, -0.05, DARK));
  group.add(box('psu', 0.34, 0.12, 0.2, 0, 0.22, -0.2, DARK));

  // four 3090s on risers, spilling out the front of the frame at a tilt
  for (let i = 0; i < 4; i++) {
    const gpu = buildGpu();
    gpu.position.set(-0.14 + i * 0.095, 0.34, 0.18 + (i % 2) * 0.03);
    gpu.rotation.x = -0.5 - (i % 2) * 0.12; // hanging outward
    gpu.rotation.z = (i - 1.5) * 0.04;
    gpu.name = `gpu-${i}`;
    group.add(gpu);
    // riser cable from the motherboard area up to each card
    const riser = cable(`gpu-riser-${i}`, [
      [-0.05 + i * 0.03, 0.16, 0.05],
      [-0.1 + i * 0.06, 0.24, 0.12],
      [-0.14 + i * 0.095, 0.3, 0.16],
    ], CABLE_DARK, 0.004);
    group.add(riser);
  }

  // blue LED glow from inside the build
  for (const fanY of [0.16, 0.44]) {
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 24), LED);
    fan.rotation.x = Math.PI / 2;
    fan.position.set(-0.16, fanY, 0.28);
    group.add(fan);
  }

  // dark green mesh draped over the frame
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, H + 0.02, D + 0.02), MESH_NET);
  mesh.position.y = H / 2;
  mesh.name = 'cage';
  group.add(mesh);

  return group;
}

export function buildOffice(): THREE.Group {
  const office = new THREE.Group();
  office.name = 'office';

  // White sit-stand desk, T-legs, height control panel under the right edge
  office.add(box('desk', 1.9, 0.04, 0.8, 0, 0.76, -0.05, WHITE_DESK));
  office.add(box('desk-controls', 0.14, 0.02, 0.06, 0.68, 0.735, 0.3, DARK));
  for (const [side, label] of [[-1, 'left'], [1, 'right']] as const) {
    office.add(box(`desk-column-${label}`, 0.08, 0.72, 0.08, side * 0.8, 0.38, -0.05, WHITE_DESK));
    office.add(box(`desk-foot-${label}`, 0.08, 0.03, 0.6, side * 0.8, 0.015, -0.05, WHITE_DESK));
  }

  // Large worn dark-brown desk mat
  office.add(box('deskmat', 1.25, 0.006, 0.55, -0.1, 0.783, 0.02, MAT));

  // Central monitor arm (pole + horizontal bar)
  const arm = new THREE.Group();
  arm.name = 'monitor-arm';
  arm.add(box('arm-pole', 0.05, 0.4, 0.05, 0, 0.2, 0, DARK));
  arm.add(box('arm-bar', 0.75, 0.04, 0.04, 0, 0.38, 0, DARK));
  arm.position.set(0, 0.78, -0.32);
  office.add(arm);

  office.add(buildMonitor('monitor-left', -0.36, 0.18));
  office.add(buildMonitor('monitor-right', 0.36, -0.18));

  // Webcam perched on the right monitor
  office.add(box('webcam', 0.09, 0.035, 0.035, 0.36, 1.245, -0.3, DARK));

  // Red mic with black foam cap in a red-elastic shock mount, round base,
  // left of the keyboard (per the close-up)
  const mic = new THREE.Group();
  mic.name = 'mic';
  const micBody = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 16), RED_MIC);
  micBody.position.y = 0.1;
  mic.add(micBody);
  const micCap = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.045, 16), FOAM);
  micCap.position.y = 0.175;
  mic.add(micCap);
  const mount = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.005, 8, 24), DARK);
  mount.rotation.x = Math.PI / 2;
  mount.position.y = 0.06;
  mic.add(mount);
  for (const a of [0, Math.PI / 2]) {
    const elastic = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.1, 6), RED_MIC);
    elastic.rotation.z = Math.PI / 2;
    elastic.rotation.y = a;
    elastic.position.y = 0.06;
    mic.add(elastic);
  }
  const micBase = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.015, 24), DARK);
  micBase.position.y = 0.008;
  mic.add(micBase);
  const micPost = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 8), DARK);
  micPost.position.y = 0.03;
  mic.add(micPost);
  mic.position.set(-0.32, 0.785, 0.06);
  office.add(mic);

  // Low-profile keyboard with key-cap texture and a slight typing tilt
  const keyTexture = makeKeyTexture();
  const keyboardMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: keyTexture ?? undefined,
    roughness: 0.6,
  });
  if (!keyTexture) keyboardMaterial.color.set(0x232529);
  const keyboard = box('keyboard', 0.4, 0.015, 0.14, -0.05, 0.795, 0.16, keyboardMaterial);
  keyboard.rotation.x = -0.06;
  office.add(keyboard);

  // Rounded mouse (squashed sphere)
  const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 12), PLASTIC);
  mouse.scale.set(0.7, 0.35, 1.1);
  mouse.position.set(0.28, 0.795, 0.18);
  mouse.name = 'mouse';
  office.add(mouse);

  office.add(box('controller', 0.14, 0.05, 0.1, -0.62, 0.81, 0.08, PLASTIC));

  // Desk clutter from the photos: alcohol bottle, red sketchbook, red can,
  // white power strip, scrunchie
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 16), BOTTLE);
  bottle.position.set(-0.44, 0.865, -0.16);
  bottle.name = 'bottle';
  office.add(bottle);
  const bottleLabel = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.05, 16), RED_CAN);
  bottleLabel.position.set(-0.44, 0.85, -0.16);
  office.add(bottleLabel);
  office.add(box('red-box', 0.12, 0.05, 0.08, 0.14, 0.81, -0.2, RED_CAN));
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.09, 16), RED_CAN);
  can.position.set(-0.52, 0.83, -0.05);
  can.name = 'can';
  office.add(can);
  office.add(box('power-strip', 0.16, 0.035, 0.06, 0.46, 0.8, -0.22, WHITE_DESK));
  const scrunchie = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.012, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0xb9a5a0, roughness: 1 }));
  scrunchie.rotation.x = Math.PI / 2;
  scrunchie.position.set(-0.5, 0.795, 0.14);
  scrunchie.name = 'scrunchie';
  office.add(scrunchie);

  // Laptop on an elevated stand, to the right, dark screen
  const laptop = new THREE.Group();
  laptop.name = 'laptop';
  laptop.add(box('laptop-stand', 0.26, 0.12, 0.2, 0, 0.06, 0, DARK));
  laptop.add(box('laptop-base', 0.33, 0.015, 0.23, 0, 0.13, 0, PLASTIC));
  laptop.add(box('laptop-lid', 0.33, 0.22, 0.012, 0, 0.23, -0.11, SCREEN_OFF.clone()));
  laptop.position.set(0.72, 0.785, 0.02);
  laptop.rotation.y = 0.7;
  office.add(laptop);

  // The caged open-frame PC, front-left of the desk
  const cagedPc = buildCagedPc();
  cagedPc.position.set(-1.1, 0, 0.35);
  cagedPc.rotation.y = 0.15;
  office.add(cagedPc);

  // UPS on the floor under the right side, blue LCD
  const ups = new THREE.Group();
  ups.name = 'ups';
  ups.add(box('ups-body', 0.18, 0.32, 0.34, 0, 0.16, 0, DARK));
  ups.add(box('ups-lcd', 0.08, 0.03, 0.01, 0, 0.26, 0.176, LED));
  ups.position.set(0.92, 0, 0.25);
  office.add(ups);

  // Cable runs + spaghetti hanging behind the desk (visible in the photos)
  office.add(cable('cable-monitor-left', [
    [-0.36, 1.05, -0.33], [-0.44, 0.85, -0.38], [-0.42, 0.5, -0.36], [-0.5, 0.05, -0.3],
  ], CABLE_DARK));
  office.add(cable('cable-monitor-right', [
    [0.36, 1.05, -0.33], [0.44, 0.82, -0.38], [0.42, 0.4, -0.36], [0.5, 0.05, -0.28],
  ], CABLE_DARK));
  office.add(cable('cable-hang-1', [
    [0.1, 0.95, -0.36], [0.14, 0.6, -0.38], [0.12, 0.2, -0.36],
  ], CABLE_DARK, 0.007));
  office.add(cable('cable-hang-2', [
    [0.2, 0.9, -0.35], [0.26, 0.55, -0.4], [0.22, 0.1, -0.34],
  ], CABLE_DARK, 0.006));
  office.add(cable('cable-hang-3', [
    [-0.15, 0.92, -0.36], [-0.2, 0.6, -0.34], [-0.18, 0.25, -0.36],
  ], CABLE_DARK, 0.006));
  office.add(cable('cable-mic', [
    [-0.32, 0.79, 0.04], [-0.38, 0.6, -0.2], [-0.44, 0.1, -0.32],
  ], CABLE_DARK, 0.006));
  office.add(cable('cable-laptop', [
    [0.74, 0.86, 0.05], [0.86, 0.78, 0.14], [0.9, 0.4, 0.18], [0.88, 0.04, 0.22],
  ], CABLE_WHITE, 0.006));
  // loose cable coil lying on the floor (photo detail)
  const floorCoil = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.01, 8, 32), CABLE_DARK);
  floorCoil.rotation.x = Math.PI / 2;
  floorCoil.position.set(-0.35, 0.012, 0.85);
  floorCoil.name = 'floor-coil';
  office.add(floorCoil);

  // High-back black leather chair: seat, curved back, armrests, 5-star base
  const chair = new THREE.Group();
  chair.name = 'chair';
  chair.add(box('chair-seat', 0.5, 0.08, 0.46, 0, 0.46, 0, LEATHER));
  const chairBack = box('chair-back', 0.46, 0.66, 0.08, 0, 0.98, 0.28, LEATHER);
  chairBack.rotation.x = -0.14;
  chair.add(chairBack);
  for (const side of [-1, 1]) {
    chair.add(box(`armrest-post-${side}`, 0.04, 0.16, 0.04, side * 0.26, 0.56, 0.02, DARK));
    chair.add(box(`armrest-pad-${side}`, 0.06, 0.03, 0.22, side * 0.26, 0.66, 0.04, LEATHER));
  }
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.36, 12), DARK);
  post.position.set(0, 0.22, 0);
  post.name = 'chair-post';
  chair.add(post);
  for (let i = 0; i < 5; i++) {
    const leg = new THREE.Group();
    const legBar = box('leg', 0.05, 0.025, 0.3, 0, 0, 0.12, DARK);
    const caster = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 8), DARK);
    caster.position.set(0, -0.015, 0.26);
    leg.add(legBar, caster);
    leg.position.y = 0.05;
    leg.rotation.y = (i / 5) * Math.PI * 2;
    leg.name = `chair-leg-${i}`;
    chair.add(leg);
  }
  chair.position.set(0.15, 0, 0.62);
  // Backrest faces the desk (-z); chair angled slightly, like the photo
  chair.rotation.y = Math.PI - 0.25;
  office.add(chair);

  // ONE wall behind the desk, with the window in it (left of the desk)
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), WALL);
  backWall.position.set(0, 1.7, -1.6);
  backWall.name = 'back-wall';
  office.add(backWall);
  office.add(box('baseboard-back', 9, 0.08, 0.02, 0, 0.04, -1.59, WHITE_DESK));

  const windowGroup = new THREE.Group();
  windowGroup.name = 'window';
  const windowTexture = makeWindowTexture();
  const skyMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: windowTexture ?? undefined,
    emissive: 0xffffff,
    emissiveMap: windowTexture ?? undefined,
    emissiveIntensity: 0.9,
  });
  if (!windowTexture) skyMaterial.color.set(0xffd9a0);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), skyMaterial);
  windowGroup.add(sky);
  const frame = [
    box('frame-top', 1.42, 0.06, 0.04, 0, 0.58, 0.02, DARK),
    box('frame-bottom', 1.42, 0.06, 0.04, 0, -0.58, 0.02, DARK),
    box('frame-left', 0.06, 1.22, 0.04, -0.68, 0, 0.02, DARK),
    box('frame-right', 0.06, 1.22, 0.04, 0.68, 0, 0.02, DARK),
    box('frame-mid-h', 1.3, 0.03, 0.03, 0, 0.1, 0.02, DARK),
  ];
  for (const f of frame) windowGroup.add(f);
  windowGroup.position.set(-1.6, 1.75, -1.58);
  office.add(windowGroup);

  // Coiled blue ethernet cable hanging on the wall under the window
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 8, 32), CABLE_BLUE);
  coil.position.set(-1.6, 1.0, -1.57);
  coil.name = 'cable-coil';
  office.add(coil);
  office.add(cable('cable-coil-tail', [
    [-1.6, 0.92, -1.57], [-1.62, 0.6, -1.55], [-1.58, 0.3, -1.5], [-1.3, 0.06, -0.9],
  ], CABLE_BLUE, 0.01));

  const tileTexture = makeTileTexture();
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tileTexture ?? undefined,
    roughness: 0.55,
  });
  if (!tileTexture) floorMaterial.color.set(0xc9bda9);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.name = 'floor';
  office.add(floor);

  return office;
}
