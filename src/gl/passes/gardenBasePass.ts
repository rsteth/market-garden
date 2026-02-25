/**
 * Garden base pass — instanced flowers + ground plane → fboBase (RGBA + depth).
 */

import type REGL from 'regl';
import type { FlowerMesh } from '../meshFlower';
import type { InstanceData } from '../gardenInstances';
import gardenVert from '../shaders/gardenBase.vert';
import gardenFrag from '../shaders/gardenBase.frag';

type Draw = (props: Record<string, unknown>) => void;

const GROUND_VERT = `
precision highp float;
attribute vec2 position;
uniform mat4 uProjection;
uniform mat4 uView;
varying vec2 vWorldXZ;
void main() {
  float s = 50.0;
  vec3 wp = vec3(position.x * s, 0.0, position.y * s);
  vWorldXZ = wp.xz;
  gl_Position = uProjection * uView * vec4(wp, 1.0);
}`;

const GROUND_FRAG = `
precision highp float;
varying vec2 vWorldXZ;
uniform float uSunHeight;
void main() {
  float dist = length(vWorldXZ);
  float fade = smoothstep(45.0, 20.0, dist);
  vec3 c = mix(vec3(0.02, 0.025, 0.015), vec3(0.04, 0.06, 0.025), fade);
  c *= 0.4 + uSunHeight * 0.6;
  gl_FragColor = vec4(c, 0.0);
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
}

export function createGardenBasePass(
  regl: REGL.Regl,
  mesh: FlowerMesh,
  instances: InstanceData,
) {
  // ---- flower draw command ----
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
    },
    framebuffer: regl.prop('framebuffer' as never),
    depth: { enable: true, mask: true },
    cull: { enable: false },
    blend: { enable: false },
  }) as unknown as Draw;

  // ---- ground quad ----
  const drawGround: Draw = regl({
    vert: GROUND_VERT,
    frag: GROUND_FRAG,
    attributes: { position: QUAD },
    uniforms: {
      uProjection: regl.prop('projection' as never),
      uView:       regl.prop('view'       as never),
      uSunHeight:  regl.prop('sunHeight'  as never),
    },
    framebuffer: regl.prop('framebuffer' as never),
    count: 6,
    depth: { enable: true, mask: true },
  }) as unknown as Draw;

  return {
    draw(p: GardenBaseDrawProps) {
      // clear fbo
      regl.clear({
        color: [0, 0, 0, 0],
        depth: 1,
        framebuffer: p.framebuffer,
      });
      drawGround(p as unknown as Record<string, unknown>);
      drawFlowers(p as unknown as Record<string, unknown>);
    },
  };
}
