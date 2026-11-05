const radians = Math.PI / 180;
const fieldOfView = Math.tan(59 * radians / 2);

const vertexShader = `#version 300 es
  in vec3 position;
  in vec3 color;
  uniform vec3 eye;
  uniform vec2 yaw;
  uniform vec2 pitch;
  uniform float aspect;
  out vec3 paint;
  out float distanceToEye;
  void main() {
    vec3 p = position - eye;
    float forward = p.x * yaw.x - p.z * yaw.y;
    float across = p.x * yaw.y + p.z * yaw.x;
    float height = p.y * pitch.y - forward * pitch.x;
    float depth = forward * pitch.y + p.y * pitch.x;
    gl_Position = vec4(across / (${fieldOfView} * aspect), height / ${fieldOfView},
      depth * 1.0011 - 0.121, depth);
    paint = color;
    distanceToEye = length(p);
  }`;

const fragmentShader = `#version 300 es
  precision mediump float;
  in vec3 paint;
  in float distanceToEye;
  uniform vec3 haze;
  uniform float fog;
  out vec4 pixel;
  void main() {
    float mist = smoothstep(5.0, 66.0, distanceToEye) * fog;
    pixel = vec4(mix(paint, haze, mist), 1.0);
  }`;

function programFor(gl) {
  const program = gl.createProgram();
  for (const [kind, source] of [[gl.VERTEX_SHADER, vertexShader], [gl.FRAGMENT_SHADER, fragmentShader]]) {
    const shader = gl.createShader(kind);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  return program;
}

function palette(hex, shade) {
  const rgb = Number.parseInt(hex.replace('#', ''), 16);
  return [rgb >> 16, (rgb >> 8) & 255, rgb & 255].map(n => Math.min(1, n / 255 * shade));
}

export function mesh() {
  const data = [];
  function triangle(a, b, c, paint, shade = 1) {
    const rgb = palette(paint, shade);
    for (const point of [a, b, c]) data.push(...point, ...rgb);
  }
  function quad(a, b, c, d, paint, shade) {
    triangle(a, b, c, paint, shade);
    triangle(a, c, d, paint, shade);
  }
  function box(x, y, z, w, h, d, paint) {
    const l = x - w / 2, r = x + w / 2, n = z - d / 2, s = z + d / 2, t = y + h;
    const a = [l, y, n], b = [r, y, n], c = [r, y, s], e = [l, y, s];
    const A = [l, t, n], B = [r, t, n], C = [r, t, s], E = [l, t, s];
    quad(a, b, B, A, paint, .75);
    quad(b, c, C, B, paint, .88);
    quad(c, e, E, C, paint, 1);
    quad(e, a, A, E, paint, .79);
    quad(A, B, C, E, paint, 1.09);
    quad(a, b, c, e, paint, .56);
  }
  function taper(x, y, z, bottom, top, height, paint, sides = 6) {
    for (let i = 0; i < sides; i++) {
      const a = (i + .5) * Math.PI * 2 / sides, b = a + Math.PI * 2 / sides;
      const point = (angle, radius, altitude) => [x + Math.cos(angle) * radius, y + altitude, z + Math.sin(angle) * radius];
      quad(point(a, bottom, 0), point(b, bottom, 0), point(b, top, height), point(a, top, height),
        paint, .79 + .22 * Math.sin(a));
      triangle([x, y + height, z], point(a, top, height), point(b, top, height), paint, 1.05);
    }
  }
  return { data, box, quad, taper };
}

export function createGraphics(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: true });
  if (!gl) throw new Error('WebGL 2를 사용할 수 없어요.');
  const program = programFor(gl);
  const position = gl.getAttribLocation(program, 'position');
  const color = gl.getAttribLocation(program, 'color');
  const uniforms = Object.fromEntries(['eye', 'yaw', 'pitch', 'aspect', 'haze', 'fog']
    .map(name => [name, gl.getUniformLocation(program, name)]));
  gl.useProgram(program);
  gl.enable(gl.DEPTH_TEST);

  function upload(model) {
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(model.data), gl.STATIC_DRAW);
    for (const [index, offset] of [[position, 0], [color, 12]]) {
      gl.vertexAttribPointer(index, 3, gl.FLOAT, false, 24, offset);
      gl.enableVertexAttribArray(index);
    }
    return { vao, count: model.data.length / 6 };
  }

  function draw(camera, layers, { haze, fog }) {
    const scale = Math.min(devicePixelRatio || 1, 1.6);
    const width = Math.max(1, Math.round(canvas.clientWidth * scale));
    const height = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (width !== canvas.width || height !== canvas.height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform3f(uniforms.eye, camera.x, camera.y, camera.z);
    gl.uniform2f(uniforms.yaw, Math.sin(camera.yaw), Math.cos(camera.yaw));
    gl.uniform2f(uniforms.pitch, Math.sin(camera.pitch), Math.cos(camera.pitch));
    gl.uniform1f(uniforms.aspect, width / height);
    gl.uniform3fv(uniforms.haze, haze);
    gl.uniform1f(uniforms.fog, fog);
    for (const layer of layers) {
      if (!layer) continue;
      gl.bindVertexArray(layer.vao);
      gl.drawArrays(gl.TRIANGLES, 0, layer.count);
    }
  }

  function project(camera, x, y, z) {
    const dx = x - camera.x, dy = y - camera.y, dz = z - camera.z;
    const sy = Math.sin(camera.yaw), cy = Math.cos(camera.yaw);
    const sp = Math.sin(camera.pitch), cp = Math.cos(camera.pitch);
    const forward = dx * sy - dz * cy;
    const depth = forward * cp + dy * sp;
    if (depth < .1) return null;
    const factor = canvas.clientHeight / (2 * fieldOfView * depth);
    return { x: canvas.clientWidth / 2 + (dx * cy + dz * sy) * factor,
      y: canvas.clientHeight / 2 - (dy * cp - forward * sp) * factor };
  }

  return { upload, draw, project };
}
