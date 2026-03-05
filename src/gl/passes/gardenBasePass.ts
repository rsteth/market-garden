/**
 * Garden base pass — instanced flowers + ground plane → fboBase (RGBA + depth).
 */

import type REGL from 'regl';
import type { FlowerMesh } from '../meshFlower';
import type { InstanceData } from '../gardenInstances';
import gardenVert from '../shaders/gardenBase.vert';
import gardenFrag from '../shaders/gardenBase.frag';

type Draw = (props: Record<string, unknown>) => void;

const BACKDROP_VERT = `
precision highp float;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const BACKDROP_FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uDayPhase;
uniform float uSunHeight;
void main() {
  float phase = clamp(uDayPhase, 0.0, 1.0);
  float midday = 1.0 - abs(phase * 2.0 - 1.0);
  float morningRamp = smoothstep(0.0, 0.18, phase);
  float eveningRamp = 1.0 - smoothstep(0.78, 1.0, phase);
  float dayWindow = min(morningRamp, eveningRamp);

  vec3 skyDawn = vec3(0.13, 0.10, 0.09);
  vec3 skyNoon = vec3(0.18, 0.27, 0.43);
  float sunLift = smoothstep(0.0, 0.75, uSunHeight);
  float lowSun = 1.0 - smoothstep(0.12, 0.68, uSunHeight);
  vec3 sunTintWarm = vec3(1.00, 0.58, 0.30);
  vec3 sunTintNoon = vec3(0.90, 0.93, 0.98);
  vec3 sunTint = mix(sunTintWarm, sunTintNoon, sunLift);
  vec3 skyBase = mix(skyDawn, skyNoon, smoothstep(0.0, 1.0, midday));
  float skyExposure = mix(0.28, 1.0, dayWindow);
  skyBase *= mix(0.62, 0.95, sunLift) * skyExposure;
  skyBase = mix(skyBase, skyBase * sunTint, 0.20 + lowSun * 0.34);

  vec3 soilBrownDawn = vec3(0.038, 0.028, 0.020);
  vec3 soilBrownNoon = vec3(0.035, 0.025, 0.016);
  vec3 soilBrown = mix(soilBrownDawn, soilBrownNoon, midday);
  vec3 groundGi = skyBase * mix(0.05, 0.10, sunLift);
  vec3 groundBase = soilBrown + skyBase * 0.08;
  vec3 groundColor = groundBase + groundGi * (1.0 - smoothstep(0.04, 0.78, vUv.y));
  float nightFactor = 1.0 - max(dayWindow, sunLift);
  groundColor *= 1.0 - nightFactor * 0.92;
  float middayGroundDarken = smoothstep(0.45, 1.0, midday);
  groundColor *= 1.0 - middayGroundDarken * 0.30;

  // Darken the very bottom (nearest ground) relative to mid screen.
  float nearGround = 1.0 - smoothstep(0.0, 0.52, vUv.y);
  float bottomCrush = 1.0 - smoothstep(0.0, 0.16, vUv.y);
  groundColor *= 1.0 - nearGround * 0.30;
  groundColor *= 1.0 - bottomCrush * 0.18;

  // Push the implied horizon into the top quarter: mostly ground, then distant fade.
  float distanceFade = smoothstep(0.74, 0.98, vUv.y);
  vec3 farBlueDawn = vec3(0.10, 0.12, 0.18);
  vec3 farBlueNoon = vec3(0.18, 0.28, 0.44);
  vec3 distanceColor = mix(farBlueDawn, farBlueNoon, midday);
  vec3 duskWarmHaze = vec3(0.12, 0.06, 0.03) * lowSun;
  distanceColor += duskWarmHaze;
  distanceColor += vec3(0.02, 0.03, 0.05) * smoothstep(0.82, 1.0, vUv.y);
  distanceColor *= mix(0.68, 0.96, sunLift) * mix(0.40, 1.0, dayWindow);

  vec3 color = mix(groundColor, distanceColor, distanceFade);
  gl_FragColor = vec4(color, 0.0);
}`;

const REGION_HELPER_VERT = `
precision highp float;
attribute float aRegionIndex;
uniform mat4 uProjection;
uniform mat4 uView;
uniform float uTime;
varying float vRegionIndex;

const float PI = 3.141592653589793;

vec2 getRegionCenter(int i) {
  float angle = float(i) * (2.0 * PI / 7.0) + 0.3;
  float radius = (11.0 + 2.0 * sin(float(i) * 1.7)) * 1.2;
  return vec2(cos(angle), sin(angle)) * radius;
}

void main() {
  int i = int(aRegionIndex + 0.5);
  vec2 ctr = getRegionCenter(i);
  float hover = 1.25 + 0.18 * sin(uTime * 1.6 + aRegionIndex * 1.7);
  vec4 clip = uProjection * uView * vec4(ctr.x, hover, ctr.y, 1.0);
  gl_Position = clip;
  gl_PointSize = 30.0;
  vRegionIndex = aRegionIndex;
}`;

const REGION_HELPER_FRAG = `
precision highp float;
uniform float uShowRegionHelpers;
varying float vRegionIndex;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  if (uShowRegionHelpers < 0.5) discard;

  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float r = length(uv);
  if (r > 1.0) discard;

  float ring = smoothstep(0.96, 0.54, r);
  float core = smoothstep(0.44, 0.0, r);
  float hue = fract((vRegionIndex + 1.0) / 7.0 + 0.08);
  vec3 ringColor = hsv2rgb(vec3(hue, 0.92, 1.0));
  vec3 coreColor = vec3(1.0, 1.0, 1.0);
  vec3 color = mix(ringColor, coreColor, core * 0.75);
  float glow = smoothstep(1.0, 0.20, r);
  float alpha = max(max(ring * 0.92, core), glow * 0.34);
  gl_FragColor = vec4(color, alpha);
}`;

const QUAD: [number, number][] = [[-1,-1],[1,-1],[-1,1],[-1,1],[1,-1],[1,1]];

export interface GardenBaseDrawProps {
  framebuffer: REGL.Framebuffer2D;
  projection: Float32Array;
  view: Float32Array;
  dataTexture: REGL.Texture2D;
  cameraPos: [number, number, number];
  time: number;
  sunDir: [number, number, number];
  sunHeight: number;
  windStrength: number;
  gustiness: number;
  fogAmount: number;
  dayPhase: number;
  overrideBloomTargetActive: number;
  overrideBloomTargetValue: number;
  overrideAgitationActive: number;
  overrideAgitationValue: number;
  overrideMicroTwitchActive: number;
  overrideMicroTwitchValue: number;
  overrideColorSeedActive: number;
  overrideColorSeedValue: number;
  overrideSlowBiasActive: number;
  overrideSlowBiasValue: number;
  regionOverrideActiveA: [number, number, number, number];
  regionOverrideActiveB: [number, number, number, number];
  regionOverrideValueA: [number, number, number, number];
  regionOverrideValueB: [number, number, number, number];
  resolution: [number, number];
  showRegionHelpers: number;
}

export function createGardenBasePass(
  regl: REGL.Regl,
  mesh: FlowerMesh,
  instances: InstanceData,
) {
  const regionIndices = regl.buffer([0, 1, 2, 3, 4, 5, 6]);

  // ---- flower draw commands ----
  const drawStalks: Draw = regl({
    vert: gardenVert,
    frag: gardenFrag,
    attributes: {
      aPosition:     { buffer: regl.buffer(mesh.positions),  size: 3 },
      aNormal:       { buffer: regl.buffer(mesh.normals),    size: 3 },
      aPartId:       { buffer: regl.buffer(mesh.partIds),    size: 1 },
      aUAlong:       { buffer: regl.buffer(mesh.uAlongs),    size: 1 },
      aURadial:      { buffer: regl.buffer(mesh.uRadials),   size: 1 },
      aInstancePos:  { buffer: regl.buffer(instances.positions), size: 3, divisor: 1 },
      aInstanceScale:{ buffer: regl.buffer(instances.scales),    size: 1, divisor: 1 },
      aInstanceSeed: { buffer: regl.buffer(instances.seeds),     size: 1, divisor: 1 },
    },
    elements: regl.elements({ data: mesh.indices, type: 'uint16' }),
    instances: instances.count,
    uniforms: {
      uProjection:  regl.prop('projection'  as never),
      uView:        regl.prop('view'        as never),
      uDataTexture: regl.prop('dataTexture' as never),
      uTime:        regl.prop('time'        as never),
      uSunDir:      regl.prop('sunDir'      as never),
      uSunHeight:   regl.prop('sunHeight'   as never),
      uWindStrength:regl.prop('windStrength' as never),
      uGustiness:   regl.prop('gustiness'   as never),
      uDayPhase:    regl.prop('dayPhase'    as never),
      uOverrideBloomTargetActive: regl.prop('overrideBloomTargetActive' as never),
      uOverrideBloomTargetValue:  regl.prop('overrideBloomTargetValue'  as never),
      uOverrideAgitationActive:   regl.prop('overrideAgitationActive'   as never),
      uOverrideAgitationValue:    regl.prop('overrideAgitationValue'    as never),
      uOverrideMicroTwitchActive: regl.prop('overrideMicroTwitchActive' as never),
      uOverrideMicroTwitchValue:  regl.prop('overrideMicroTwitchValue'  as never),
      uOverrideColorSeedActive:   regl.prop('overrideColorSeedActive'   as never),
      uOverrideColorSeedValue:    regl.prop('overrideColorSeedValue'    as never),
      uOverrideSlowBiasActive:    regl.prop('overrideSlowBiasActive'    as never),
      uOverrideSlowBiasValue:     regl.prop('overrideSlowBiasValue'     as never),
      uRegionOverrideActiveA:     regl.prop('regionOverrideActiveA'     as never),
      uRegionOverrideActiveB:     regl.prop('regionOverrideActiveB'     as never),
      uRegionOverrideValueA:      regl.prop('regionOverrideValueA'      as never),
      uRegionOverrideValueB:      regl.prop('regionOverrideValueB'      as never),
      uCameraPos:   regl.prop('cameraPos'   as never),
      uDrawStalkOnly: 1,
    },
    framebuffer: regl.prop('framebuffer' as never),
    depth: { enable: true, mask: true },
    cull: { enable: false },
    blend: { enable: false },
  }) as unknown as Draw;

  const drawFlowers: Draw = regl({
    vert: gardenVert,
    frag: gardenFrag,
    attributes: {
      aPosition:     { buffer: regl.buffer(mesh.positions),  size: 3 },
      aNormal:       { buffer: regl.buffer(mesh.normals),    size: 3 },
      aPartId:       { buffer: regl.buffer(mesh.partIds),    size: 1 },
      aUAlong:       { buffer: regl.buffer(mesh.uAlongs),    size: 1 },
      aURadial:      { buffer: regl.buffer(mesh.uRadials),   size: 1 },
      aInstancePos:  { buffer: regl.buffer(instances.positions), size: 3, divisor: 1 },
      aInstanceScale:{ buffer: regl.buffer(instances.scales),    size: 1, divisor: 1 },
      aInstanceSeed: { buffer: regl.buffer(instances.seeds),     size: 1, divisor: 1 },
    },
    elements: regl.elements({ data: mesh.indices, type: 'uint16' }),
    instances: instances.count,
    uniforms: {
      uProjection:  regl.prop('projection'  as never),
      uView:        regl.prop('view'        as never),
      uDataTexture: regl.prop('dataTexture' as never),
      uTime:        regl.prop('time'        as never),
      uSunDir:      regl.prop('sunDir'      as never),
      uSunHeight:   regl.prop('sunHeight'   as never),
      uWindStrength:regl.prop('windStrength' as never),
      uGustiness:   regl.prop('gustiness'   as never),
      uDayPhase:    regl.prop('dayPhase'    as never),
      uOverrideBloomTargetActive: regl.prop('overrideBloomTargetActive' as never),
      uOverrideBloomTargetValue:  regl.prop('overrideBloomTargetValue'  as never),
      uOverrideAgitationActive:   regl.prop('overrideAgitationActive'   as never),
      uOverrideAgitationValue:    regl.prop('overrideAgitationValue'    as never),
      uOverrideMicroTwitchActive: regl.prop('overrideMicroTwitchActive' as never),
      uOverrideMicroTwitchValue:  regl.prop('overrideMicroTwitchValue'  as never),
      uOverrideColorSeedActive:   regl.prop('overrideColorSeedActive'   as never),
      uOverrideColorSeedValue:    regl.prop('overrideColorSeedValue'    as never),
      uOverrideSlowBiasActive:    regl.prop('overrideSlowBiasActive'    as never),
      uOverrideSlowBiasValue:     regl.prop('overrideSlowBiasValue'     as never),
      uRegionOverrideActiveA:     regl.prop('regionOverrideActiveA'     as never),
      uRegionOverrideActiveB:     regl.prop('regionOverrideActiveB'     as never),
      uRegionOverrideValueA:      regl.prop('regionOverrideValueA'      as never),
      uRegionOverrideValueB:      regl.prop('regionOverrideValueB'      as never),
      uCameraPos:   regl.prop('cameraPos'   as never),
      uDrawStalkOnly: 0,
    },
    framebuffer: regl.prop('framebuffer' as never),
    depth: { enable: true, mask: true, func: 'lequal' },
    cull: { enable: false },
    blend: { enable: false },
  }) as unknown as Draw;

  // ---- fullscreen backdrop (sky + implied ground GI) ----
  const drawBackdrop: Draw = regl({
    vert: BACKDROP_VERT,
    frag: BACKDROP_FRAG,
    attributes: { position: QUAD },
    uniforms: {
      uDayPhase:   regl.prop('dayPhase'   as never),
      uSunHeight:  regl.prop('sunHeight'  as never),
    },
    framebuffer: regl.prop('framebuffer' as never),
    count: 6,
    depth: { enable: false, mask: false },
  }) as unknown as Draw;

  const drawRegionHelpers: Draw = regl({
    vert: REGION_HELPER_VERT,
    frag: REGION_HELPER_FRAG,
    attributes: {
      aRegionIndex: { buffer: regionIndices, size: 1 },
    },
    uniforms: {
      uProjection: regl.prop('projection' as never),
      uView: regl.prop('view' as never),
      uTime: regl.prop('time' as never),
      uShowRegionHelpers: regl.prop('showRegionHelpers' as never),
    },
    framebuffer: regl.prop('framebuffer' as never),
    primitive: 'points',
    count: 7,
    depth: { enable: true, mask: false, func: 'lequal' },
    blend: {
      enable: true,
      func: {
        srcRGB: 'src alpha',
        srcAlpha: 1,
        dstRGB: 'one minus src alpha',
        dstAlpha: 1,
      },
    },
  }) as unknown as Draw;

  return {
    draw(p: GardenBaseDrawProps) {
      // clear fbo
      regl.clear({
        color: [0, 0, 0, 0],
        depth: 1,
        framebuffer: p.framebuffer,
      });
      drawBackdrop(p as unknown as Record<string, unknown>);
      drawStalks(p as unknown as Record<string, unknown>);
      drawFlowers(p as unknown as Record<string, unknown>);
      drawRegionHelpers(p as unknown as Record<string, unknown>);
    },
  };
}
