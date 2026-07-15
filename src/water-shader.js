const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_day;
uniform vec3 u_shallow;
uniform vec3 u_deep;
uniform float u_waveScale;
uniform float u_waveSpeed;
uniform float u_waveStrength;
uniform float u_sparkle;

float waveField(vec2 p) {
  float scale = max(0.25, u_waveScale);
  float t = u_time * u_waveSpeed;
  float a = sin((p.x * 8.4 + p.y * 3.1) * scale + t * 0.52);
  float b = sin((p.x * -5.2 + p.y * 9.3) * scale - t * 0.41);
  float c = sin((p.x + p.y) * 14.0 * scale + t * 0.27);
  float d = sin((p.x * 21.0 - p.y * 17.0) * scale - t * 0.18);
  return 0.5 + (a * 0.34 + b * 0.29 + c * 0.23 + d * 0.14) * 0.5 * u_waveStrength;
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float epsilon = 2.0 / max(u_resolution.y, 1.0);
  float height = waveField(p);
  float heightX = waveField(p + vec2(epsilon, 0.0));
  float heightY = waveField(p + vec2(0.0, epsilon));
  vec3 normal = normalize(vec3((height - heightX) * 19.0, (height - heightY) * 19.0, 1.0));

  float bankDistance = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float basin = smoothstep(0.0, 0.38, bankDistance);
  float depthVariation = sin(p.x * 2.2 - p.y * 1.7) * 0.055 + sin(p.y * 3.6 + 1.2) * 0.035;
  float depth = clamp(basin + depthVariation, 0.0, 1.0);

  vec3 shallow = mix(u_shallow * vec3(0.35, 0.42, 0.62), u_shallow, u_day);
  vec3 deep = mix(u_deep * vec3(0.32, 0.38, 0.62), u_deep, u_day);
  vec3 color = mix(shallow, deep, smoothstep(0.05, 0.95, depth));

  vec3 lightDir = normalize(vec3(-0.35, -0.46, 0.82));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  float diffuse = max(dot(normal, lightDir), 0.0);
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.2);
  float specular = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 28.0);

  vec2 refracted = p + normal.xy * 0.045;
  float causticLines = abs(sin(refracted.x * 19.0 + u_time * 0.34) * sin(refracted.y * 23.0 - u_time * 0.29));
  float crossing = abs(sin((refracted.x + refracted.y) * 17.0 + u_time * 0.2));
  float caustics = pow(clamp(causticLines * 0.65 + crossing * 0.35, 0.0, 1.0), 12.0) * depth;
  float edgeFoam = (1.0 - smoothstep(0.006, 0.035, bankDistance)) * (0.035 + height * 0.025);

  color += vec3(0.04, 0.16, 0.18) * diffuse * 0.28;
  color += vec3(0.15, 0.55, 0.52) * caustics * (0.025 + u_day * 0.02);
  color += vec3(0.45, 0.76, 0.78) * specular * u_sparkle * (0.16 + u_day * 0.12);
  color = mix(color, vec3(0.045, 0.235, 0.29), fresnel * 0.28);
  color += vec3(0.1, 0.32, 0.34) * edgeFoam;
  color *= 0.965 + height * 0.055;
  float vignette = 1.0 - smoothstep(0.28, 0.95, length((uv - 0.5) * vec2(1.0, 0.8)));
  color *= 0.82 + vignette * 0.2;
  gl_FragColor = vec4(color, 1.0);
}`;

const SURFACE_FRAGMENT_SHADER = `
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_waveScale;
uniform float u_waveSpeed;
uniform float u_waveStrength;
uniform float u_sparkle;
uniform float u_refraction;
uniform float u_opacity;
uniform vec3 u_tint;

vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

float voronoi(vec2 x, float t) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float nearest = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(n + g);
      o = 0.5 + 0.34 * sin(t + 6.2831 * o);
      nearest = min(nearest, length(g + o - f));
    }
  }
  return nearest;
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(1.0, u_resolution.y);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float t = u_time * u_waveSpeed;
  float scale = max(0.25, u_waveScale);
  float a = sin((p.x * 9.0 + p.y * 4.5) * scale + t * 0.72);
  float b = sin((p.x * -5.5 + p.y * 11.0) * scale - t * 0.58);
  float c = sin((p.x + p.y) * 15.0 * scale + t * 0.34);
  vec2 distortion = vec2(a + c * 0.35, b - c * 0.32) * 0.012 * u_waveStrength * u_refraction;
  float cells = voronoi((uv + distortion) * vec2(aspect, 1.0) * (5.5 + scale * 3.5), t * 0.46);
  float cellularLine = 1.0 - smoothstep(0.012, 0.043, abs(cells - 0.47));
  float crest = smoothstep(0.72, 0.98, (a + b + c + 3.0) / 6.0);
  float crossing = pow(max(0.0, sin((p.x - p.y) * 19.0 * scale - t * 0.25)), 10.0);
  float bank = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float edge = 1.0 - smoothstep(0.0, 0.07, bank);
  float brokenCells = cellularLine * smoothstep(-0.2, 0.78, sin((p.x + p.y) * 8.0 - t * 0.32));
  float shine = brokenCells * u_sparkle * 0.58 + crest * 0.16 + crossing * 0.12;
  float alpha = u_opacity * (0.016 + shine * 0.16 + edge * 0.07);
  vec3 color = mix(u_tint, vec3(0.68, 0.9, 0.91), clamp(shine * 0.62, 0.0, 1.0));
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.3));
}`;

const hexToRgb = (hex, fallback) => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  return match ? [parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255] : fallback;
};

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Water shader compile failed:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export class WaterShader {
  constructor(canvas) {
    this.canvas = canvas;
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.ready = false;
      this.canvas.style.visibility = 'hidden';
    });
    this.gl = canvas.getContext('webgl', { alpha: false, antialias: true, depth: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    this.ready = false;
    if (!this.gl) return;
    const gl = this.gl;
    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertex || !fragment) return;
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Water shader link failed:', gl.getProgramInfoLog(program));
      return;
    }
    this.program = program;
    this.position = gl.getAttribLocation(program, 'a_position');
    this.time = gl.getUniformLocation(program, 'u_time');
    this.resolution = gl.getUniformLocation(program, 'u_resolution');
    this.day = gl.getUniformLocation(program, 'u_day');
    this.shallow = gl.getUniformLocation(program, 'u_shallow');
    this.deep = gl.getUniformLocation(program, 'u_deep');
    this.waveScale = gl.getUniformLocation(program, 'u_waveScale');
    this.waveSpeed = gl.getUniformLocation(program, 'u_waveSpeed');
    this.waveStrength = gl.getUniformLocation(program, 'u_waveStrength');
    this.sparkle = gl.getUniformLocation(program, 'u_sparkle');
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    this.buffer = buffer;
    this.ready = true;
  }

  resize() {
    if (!this.ready) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  render(time, isDay, settings = {}) {
    if (!this.ready) return;
    if (this.gl.isContextLost()) {
      this.ready = false;
      this.canvas.style.visibility = 'hidden';
      return;
    }
    this.resize();
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.position);
    gl.vertexAttribPointer(this.position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(this.time, time);
    gl.uniform2f(this.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.day, typeof isDay === 'number' ? Math.max(0, Math.min(1, isDay)) : (isDay ? 1 : 0));
    gl.uniform3fv(this.shallow, hexToRgb(settings.shallowColor, [0.035, 0.205, 0.245]));
    gl.uniform3fv(this.deep, hexToRgb(settings.deepColor, [0.008, 0.072, 0.115]));
    gl.uniform1f(this.waveScale, settings.waveScale ?? 1);
    gl.uniform1f(this.waveSpeed, settings.waveSpeed ?? 1);
    gl.uniform1f(this.waveStrength, settings.waveStrength ?? 1);
    gl.uniform1f(this.sparkle, settings.sparkle ?? 1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

export class SurfaceWaterShader {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    this.gl = gl;
    this.ready = false;
    if (!gl) return;
    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, SURFACE_FRAGMENT_SHADER);
    if (!vertex || !fragment) return;
    const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { console.error('Surface water shader link failed:', gl.getProgramInfoLog(program)); return; }
    this.program = program;
    this.uniforms = {};
    ['resolution','time','waveScale','waveSpeed','waveStrength','sparkle','refraction','opacity','tint'].forEach((name) => { this.uniforms[name] = gl.getUniformLocation(program, `u_${name}`); });
    this.position = gl.getAttribLocation(program, 'a_position');
    this.buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    this.ready = true;
  }

  resize(width, height) {
    if (!this.ready) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(width * dpr)); this.canvas.height = Math.max(1, Math.round(height * dpr));
  }

  render(time, settings = {}) {
    if (!this.ready || this.gl.isContextLost()) { this.ready = false; return; }
    const gl = this.gl; gl.viewport(0, 0, this.canvas.width, this.canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer); gl.enableVertexAttribArray(this.position); gl.vertexAttribPointer(this.position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height); gl.uniform1f(this.uniforms.time, time);
    gl.uniform1f(this.uniforms.waveScale, settings.waveScale ?? 1); gl.uniform1f(this.uniforms.waveSpeed, settings.waveSpeed ?? 1); gl.uniform1f(this.uniforms.waveStrength, settings.waveStrength ?? .65);
    gl.uniform1f(this.uniforms.sparkle, settings.sparkle ?? .65); gl.uniform1f(this.uniforms.refraction, settings.refraction ?? .6); gl.uniform1f(this.uniforms.opacity, settings.surfaceOpacity ?? .36);
    gl.uniform3fv(this.uniforms.tint, hexToRgb(settings.surfaceColor, [.18, .58, .62])); gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
