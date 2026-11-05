import { mesh } from './graphics.js';

const outdoors = { haze: [.70, .75, .67], fog: .90 };
const indoors = { haze: [.21, .28, .29], fog: .28 };
const target = (id, name, action, x, z, labelY, reach = 2.5) => ({ id, name, action, x, z, labelY, reach });

function person(g, x, z, { coat, pants, hair, skin, badge }) {
  const { box } = g;
  box(x, .015, z + .03, .69, .008, .50, '#3b4946');
  for (const side of [-1, 1]) {
    box(x + side * .14, .09, z, .23, .56, .26, pants);
    box(x + side * .14, 0, z + .05, .24, .12, .39, '#3b3834');
    box(x + side * .33, .73, z, .15, .51, .24, coat);
    box(x + side * .33, .64, z + .01, .13, .16, .20, skin);
  }
  box(x, .64, z, .53, .62, .34, coat);
  box(x, 1.19, z + .01, .17, .15, .18, skin);
  box(x, 1.32, z + .01, .37, .39, .35, skin);
  box(x, 1.64, z, .44, .14, .40, hair);
  box(x, 1.40, z - .153, .41, .28, .12, hair);
  box(x - .18, 1.53, z + .02, .09, .15, .34, hair);
  box(x + .11, 1.52, z + .19, .048, .043, .012, '#332927');
  box(x - .08, 1.52, z + .19, .048, .043, .012, '#332927');
  box(x + .01, 1.40, z + .194, .085, .016, .013, '#a7665b');
  box(x + .14, 1.03, z + .18, .105, .086, .014, badge);
}

function pine(g, x, z, size, colors) {
  g.taper(x, .06, z, .16 * size, .105 * size, 2.05 * size, '#7a5c45');
  for (let i = 0; i < 3; i++) {
    g.taper(x + .05 * i, (1.10 + i * .62) * size, z, (1.0 - .2 * i) * size,
      .12 * size, (1.32 - .12 * i) * size, colors[i], 7);
  }
}

function deciduous(g, x, z, size, colors) {
  g.taper(x, 0, z, .22 * size, .12 * size, 2.8 * size, '#806149', 7);
  g.taper(x, 2.05 * size, z, .78 * size, 1.32 * size, 1.03 * size, colors[0], 7);
  g.taper(x, 3.08 * size, z, 1.32 * size, .16 * size, 1.44 * size, colors[1], 7);
}

function windows(g, x, z, levels, rows, { pane = '#879f9e', wood = '#5c7775', facing = 1 } = {}) {
  for (const y of levels) for (const offset of rows) {
    g.box(x, y, z + offset, .15, .97, 1.36, wood);
    g.box(x + facing * .085, y + .075, z + offset, .04, .80, 1.18, pane);
    g.box(x + facing * .12, y + .07, z + offset, .045, .83, .045, wood);
    g.box(x + facing * .14, y - .04, z + offset, .30, .08, 1.48, '#e0ca9f');
  }
}

function street() {
  const g = mesh();
  const { box, taper } = g;
  const obstacles = [];
  const solid = (x, z, w, d) => obstacles.push({ x, z, w, d });
  box(0, -.28, -11, 90, .27, 115, '#7e916e');
  box(0, -.1, -8, 5.7, .10, 53, '#536363');
  for (let z = 16; z > -32; z -= 3.6) box(0, .003, z, .085, .009, 1.60, '#c8b47d');
  for (const side of [-1, 1]) {
    box(side * 3.57, -.06, -7.5, 1.47, .14, 51.0, '#c7bda1');
    box(side * 2.86, -.04, -7.5, .13, .15, 51.0, '#e5d5b0');
    for (let z = 14; z > -22; z -= 1.02) box(side * 3.61, .0801, z, 1.32, .003, .021, '#a59881');
  }
  box(-6.1, -.09, -5.7, 5.2, .13, 14.2, '#b8a98a');
  box(6.5, -.08, -7.5, 6, .125, 8.8, '#b0af96');
  for (let i = 0; i < 6; i++) box(-2.28 + i * .88, .011, 2.1, .46, .011, 2.2, '#e8d8aa');

  box(-8.65, 0, 8.25, 5.9, 3.02, 5.4, '#e2c49b');
  box(-8.65, 2.96, 8.25, 6.28, .24, 5.8, '#7d6655');
  box(-8.65, 3.17, 8.25, 5.8, .28, 5.36, '#b17d60');
  box(-5.59, .02, 8.46, .18, 2.10, 1.24, '#79634d');
  box(-5.485, .10, 8.46, .06, 1.87, .98, '#b58661');
  box(-5.441, 1.43, 8.46, .04, .33, .69, '#d6a978');
  box(-5.434, .96, 8.75, .04, .065, .09, '#e1b978');
  box(-5.35, 0, 8.46, .65, .12, 1.54, '#bc9c72');
  windows(g, -5.65, 8.3, [1.06], [-1.59, 1.78], { pane: '#cfac78', wood: '#a48260' });
  box(-7.98, 3.37, 6.85, .52, .80, .47, '#8e7259');
  solid(-8.65, 8.25, 5.9, 5.4);

  box(-9.03, 0, -9.45, 6.65, 5.4, 9.1, '#ccae83');
  box(-9.03, 3.06, -9.45, 6.72, .18, 9.17, '#efe0b9');
  box(-9.03, 5.38, -9.45, 6.87, .32, 9.34, '#846f55');
  box(-5.62, 0, -6.65, .22, 2.60, 2.0, '#6c8483');
  box(-5.46, 0, -6.65, .08, 2.39, 1.78, '#96aeab');
  box(-5.42, .0, -6.65, .08, 2.40, .09, '#5c7775');
  windows(g, -5.66, -9.45, [1.55, 3.87], [-3.45, -1.62, .24, 2.09, 3.74]);
  box(-5.03, 2.55, -6.65, 1.41, .18, 2.47, '#b88b5c');
  for (const z of [-7.69, -5.61]) box(-4.42, .1, z, .12, 2.55, .13, '#a78764');
  box(-4.95, .09, -6.65, 1.55, .12, 2.44, '#c9b698');
  solid(-9.03, -9.45, 6.65, 9.1);

  box(8.95, 0, -8.30, 7.70, 4.04, 9.0, '#a1a595');
  box(8.95, 3.99, -8.30, 8.0, .32, 9.25, '#4e7773');
  box(5.07, 2.70, -7.45, .20, .64, 3.66, '#487c79');
  box(4.67, 2.55, -7.45, 1.04, .16, 3.08, '#7c9d91');
  box(5.01, .045, -7.45, .18, 2.43, 2.05, '#496c6a');
  box(4.889, .09, -7.45, .07, 2.13, 1.77, '#9db2ac');
  box(4.835, .09, -7.45, .045, 2.17, .087, '#4c6d6b');
  box(4.84, 1.12, -7.17, .13, .045, .26, '#f5dba1');
  windows(g, 5.06, -8.3, [1.3], [-3.15, -1.45, 3.20], { facing: -1, pane: '#718b88' });
  solid(8.95, -8.3, 7.70, 9.0);

  for (const [x, z] of [[-4.08, 4.08], [4.31, -.62], [-4.47, -11.8], [4.57, -13.92]]) {
    box(x, 0, z, .18, 3.76, .19, '#536c68');
    box(x - Math.sign(x) * .29, 3.63, z, .64, .11, .27, '#536c68');
    box(x - Math.sign(x) * .58, 3.54, z, .38, .12, .33, '#e6c994');
    solid(x, z, .16, .16);
  }
  for (const [x, z, size] of [[-5.05, 4.7, .84], [6.36, 1.3, 1.04], [4.75, -11.1, .90], [-4.72, -13.4, 1.13]]) {
    deciduous(g, x, z, size, ['#b49957', '#cdb775']);
    solid(x, z, .37, .37);
  }
  for (const [i, z] of [-22, -27, -33, -41, -47, -55, -60].entries()) {
    for (const side of [-1, 1]) pine(g, (3.2 + i * 1.65) * side, z, .92 + i % 3 * .30, ['#587d6c', '#688b73', '#789784']);
  }
  for (const [x, z, r, height] of [[-25, -62, 18, 9], [-6, -74, 20, 10.5], [16, -63, 17, 11.5], [34, -70, 16, 13]]) {
    taper(x, -.1, z, r, r * .18, height, '#839b8b', 7);
  }
  box(4.93, .32, -3.39, 1.50, .10, .52, '#b38761');
  box(4.93, .57, -3.61, 1.51, .25, .09, '#b38761');
  for (const x of [4.32, 5.54]) box(x, .03, -3.40, .12, .32, .46, '#61716b');
  solid(4.93, -3.39, 1.5, .54);
  person(g, -3.84, -1.78, { coat: '#b26b55', pants: '#4d5968', hair: '#4b3532', skin: '#dfaa86', badge: '#ead6ae' });
  solid(-3.84, -1.78, .59, .40);

  return {
    art: g, obstacles, colors: outdoors, bounds: [-11.8, 11.8, -16.9, 13.5],
    spawn: { x: -.14, z: 10.75, yaw: -.17 }, arrival: { x: 3.48, z: -7.38, yaw: .98 },
    targets: [
      target('friend', '민서', '민서에게 말 걸기', -3.84, -1.78, 2.11),
      target('home', '우리 집', '집 앞에 멈추기', -5.49, 8.46, 2.42),
      target('center', '진로체험 교육장', '교육장 문 살펴보기', 4.83, -7.45, 3.15),
      target('bench', '골목 벤치', '벤치에 앉기', 4.93, -3.39, 1.17, 2.0),
    ],
    signs: [{ name: '해솔기술고등학교', x: -4.33, z: -6.65, labelY: 3.18, range: 17 }],
  };
}

function workshop() {
  const g = mesh();
  const { box } = g;
  const obstacles = [];
  const solid = (x, z, w, d) => obstacles.push({ x, z, w, d });
  box(0, -.19, 0, 15.7, .18, 16.7, '#667976');
  box(0, 3.7, 0, 15.7, .19, 16.7, '#809089');
  box(0, 0, -8.20, 15.7, 3.80, .30, '#8ea29b');
  box(0, 0, 8.2, 15.7, 3.80, .30, '#7e9189');
  for (const x of [-7.74, 7.74]) box(x, 0, 0, .26, 3.8, 16.7, '#98a79a');
  for (let x = -7; x <= 7; x++) box(x, -.002, 0, .018, .005, 16.2, '#526561');
  for (let z = -8; z <= 8; z++) box(0, -.001, z, 15.2, .006, .018, '#526561');
  for (const z of [-5.6, -1.0, 4.3]) {
    box(0, 3.49, z, 7.1, .17, .21, '#556864');
    box(0, 3.44, z, 5.84, .07, .17, '#efe5bb');
  }
  windows(g, -7.54, -1.2, [1.36], [-4.2, -2.61, -1.02, .57, 2.16, 3.75, 5.34], { pane: '#b6c7af', wood: '#617c76' });
  for (let i = 0; i < 4; i++) {
    const x = -5.67 + i * 1.50;
    box(x, .03, -7.37, 1.34, 2.56, .85, '#4c6866');
    box(x, .22, -6.917, 1.17, 2.20, .12, '#77978d');
    box(x + .43, 1.04, -6.83, .075, .28, .067, '#d4b782');
    box(x, 1.94, -6.84, .56, .14, .05, '#bfc7ab');
    solid(x, -7.37, 1.34, .85);
  }
  for (const x of [-.88, -4.47]) {
    box(x, .011, -1.89, .043, .01, 4.25, '#e9bd72');
    box(x, .011, -4.02, 3.55, .01, .039, '#e9bd72');
  }
  const boardX = -2.78, boardZ = -2.79;
  box(boardX, .04, boardZ, 2.82, .81, 1.18, '#446a66');
  box(boardX, .84, boardZ, 2.97, .16, 1.32, '#759489');
  box(boardX, 1, boardZ - .20, 2.24, .91, .52, '#475e5d');
  box(boardX, 1.15, boardZ + .073, 1.64, .61, .053, '#243c3f');
  for (const x of [boardX - 1.12, boardX + 1.12]) box(x, .93, boardZ + .44, .17, .16, .18, '#d4c594');
  solid(boardX, boardZ, 2.92, 1.30);

  box(3.41, .05, -4.38, 1.19, 1.04, .79, '#496a68');
  box(3.41, 1.09, -4.38, 1.29, .12, .90, '#c2ac7f');
  g.taper(3.41, 1.21, -4.28, .19, .162, .16, '#b26c54', 8);
  solid(3.41, -4.38, 1.19, .79);
  person(g, 2.73, -1.30, { coat: '#d2c397', pants: '#465759', hair: '#574537', skin: '#cfa285', badge: '#728f87' });
  solid(2.73, -1.3, .64, .44);

  box(0, 0, 8.011, 2.31, 2.70, .23, '#536c67');
  box(0, .09, 7.867, 1.99, 2.45, .11, '#96a79c');
  box(0, .12, 7.791, .10, 2.43, .067, '#627d76');
  const readings = {};
  for (const [status, tint] of Object.entries({ normal: '#8cddb3', attention: '#ffc17d', idle: '#547b76' })) {
    const indicator = mesh();
    indicator.box(boardX, 1.34, boardZ + .116, 1.21, .20, .021, tint);
    indicator.box(boardX - .60, 1.20, boardZ + .118, .11, .06, .02, tint);
    indicator.box(boardX - .42, 1.20, boardZ + .118, .11, .06, .02, tint);
    readings[status] = indicator;
  }
  return {
    art: g, readings, obstacles, colors: indoors, bounds: [-7.3, 7.3, -7.8, 7.8],
    spawn: { x: .14, z: 5.7, yaw: 0 },
    targets: [
      target('mentor', '교육 담당자', '담당자에게 말 걸기', 2.73, -1.30, 2.10),
      target('board', '상태표', '상태표 가까이 보기', boardX, boardZ + .14, 2.17, 2.40),
      target('power', '전원 패널', '전원 패널 살펴보기', 3.41, -4.38, 1.65, 1.80),
      target('exit', '교육장 밖', '골목으로 나가기', 0, 7.78, 2.8, 2.05),
    ],
    signs: [],
  };
}

export function makeWorlds(graphics) {
  const worlds = { street: street(), workshop: workshop() };
  for (const world of Object.values(worlds)) {
    world.layer = graphics.upload(world.art);
    if (world.readings) {
      world.layers = Object.fromEntries(Object.entries(world.readings).map(([status, art]) => [status, graphics.upload(art)]));
    }
  }
  return worlds;
}

export function walkable(world, x, z) {
  const [left, right, back, front] = world.bounds;
  const radius = .28;
  if (x < left || x > right || z < back || z > front) return false;
  return !world.obstacles.some(o => Math.abs(x - o.x) < o.w / 2 + radius && Math.abs(z - o.z) < o.d / 2 + radius);
}
