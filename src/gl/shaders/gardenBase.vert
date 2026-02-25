precision highp float;

// ---- per-vertex ----
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute float aPartId;   // 0 stalk, 1 head, 2 petal
attribute float aUAlong;   // 0..1 along stalk / petal length
attribute float aURadial;  // normalised petal angle

// ---- per-instance ----
attribute vec3 aInstancePos;
attribute float aInstanceScale;
attribute float aInstanceSeed;

// ---- uniforms ----
uniform mat4 uProjection;
uniform mat4 uView;
uniform sampler2D uDataTexture;
uniform float uTime;
uniform vec3  uSunDir;
uniform float uSunHeight;
uniform float uWindStrength;
uniform float uGustiness;
uniform float uDayPhase;
uniform vec3  uCameraPos;
uniform float uOverrideBloomTargetActive;
uniform float uOverrideBloomTargetValue;
uniform float uOverrideAgitationActive;
uniform float uOverrideAgitationValue;
uniform float uOverrideMicroTwitchActive;
uniform float uOverrideMicroTwitchValue;
uniform float uOverrideColorSeedActive;
uniform float uOverrideColorSeedValue;
uniform float uOverrideSlowBiasActive;
uniform float uOverrideSlowBiasValue;
uniform vec4  uRegionOverrideActiveA;
uniform vec4  uRegionOverrideActiveB;
uniform vec4  uRegionOverrideValueA;
uniform vec4  uRegionOverrideValueB;

// ---- varyings ----
varying vec3  vColor;
varying vec3  vNormal;
varying vec3  vWorldPos;
varying float vGlowMask;
varying float vStalkMask;

// ---- constants ----
const float PI = 3.14159265;
const float HEAD_Y = 1.02;
const float HEAD_R = 0.03;
const float REGION_SIGMA2 = 80.0;

// ---- helpers ----

float hash11(float n) {
  return fract(sin(n * 127.1) * 43758.5453);
}

float noise2d(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = fract(sin(dot(i,                    vec2(127.1, 311.7))) * 43758.5453);
  float b = fract(sin(dot(i + vec2(1.0, 0.0),   vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0.0, 1.0),   vec2(127.1, 311.7))) * 43758.5453);
  float d = fract(sin(dot(i + vec2(1.0, 1.0),   vec2(127.1, 311.7))) * 43758.5453);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec2 getRegionCenter(int i) {
  float angle = float(i) * (2.0 * PI / 7.0) + 0.3;
  float radius = 11.0 + 2.0 * sin(float(i) * 1.7);
  return vec2(cos(angle), sin(angle)) * radius;
}

vec2 rot2(vec2 v, float a) {
  float c = cos(a); float s = sin(a);
  return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float regionInfluence(int i) {
  if (i == 0) return mix(1.0, uRegionOverrideValueA.x, uRegionOverrideActiveA.x);
  if (i == 1) return mix(1.0, uRegionOverrideValueA.y, uRegionOverrideActiveA.y);
  if (i == 2) return mix(1.0, uRegionOverrideValueA.z, uRegionOverrideActiveA.z);
  if (i == 3) return mix(1.0, uRegionOverrideValueA.w, uRegionOverrideActiveA.w);
  if (i == 4) return mix(1.0, uRegionOverrideValueB.x, uRegionOverrideActiveB.x);
  if (i == 5) return mix(1.0, uRegionOverrideValueB.y, uRegionOverrideActiveB.y);
  return mix(1.0, uRegionOverrideValueB.z, uRegionOverrideActiveB.z);
}

// ---------------------------------------------------------------
void main() {
  vec3 pos  = aPosition;
  vec3 norm = aNormal;

  // ---- region weights + knob blending ----
  float totalW      = 0.0;
  float bloomTarget = 0.0;
  float agitation   = 0.0;
  float microTwitch = 0.0;
  float colorSeed   = 0.0;
  float slowBias    = 0.0;

  for (int i = 0; i < 7; i++) {
    vec2 ctr  = getRegionCenter(i);
    vec2 diff = aInstancePos.xz - ctr;
    float w   = exp(-dot(diff, diff) / REGION_SIGMA2);
    w *= 0.8 + 0.4 * noise2d(aInstancePos.xz * 0.08 + float(i) * 13.7);
    w *= max(0.0, regionInfluence(i));
    totalW += w;

    float texY = (float(i) + 0.5) / 8.0;
    vec4 d0 = texture2D(uDataTexture, vec2(0.25, texY));
    vec4 d1 = texture2D(uDataTexture, vec2(0.75, texY));
    // d0 = [ret1d, ret1w, ret1m, ivAtm]  d1 = [ivChg, absRet, seed, _]

    bloomTarget += w * (d0.g * 0.5 + 0.5);
    agitation   += w * (abs(d0.a) + abs(d1.r)) * 0.5;
    microTwitch += w * d0.r;
    colorSeed   += w * d1.b;
    slowBias    += w * (d0.b * 0.5 + 0.5);
  }
  float invW  = 1.0 / max(totalW, 0.001);
  bloomTarget *= invW;
  agitation   *= invW;
  microTwitch *= invW;
  colorSeed   *= invW;
  slowBias    *= invW;

  if (uOverrideBloomTargetActive > 0.5) bloomTarget = uOverrideBloomTargetValue;
  if (uOverrideAgitationActive > 0.5) agitation = uOverrideAgitationValue;
  if (uOverrideMicroTwitchActive > 0.5) microTwitch = uOverrideMicroTwitchValue * 2.0 - 1.0;
  if (uOverrideColorSeedActive > 0.5) colorSeed = uOverrideColorSeedValue;
  if (uOverrideSlowBiasActive > 0.5) slowBias = uOverrideSlowBiasValue;

  float seedVar = hash11(aInstanceSeed * 100.0);

  // ---- wind ----
  vec2 windSample = aInstancePos.xz * 0.15 + uTime * vec2(0.3, 0.2);
  float windNoise = noise2d(windSample);
  float windPhase = uTime * 1.8 + aInstancePos.x * 0.12 + aInstancePos.z * 0.09;
  float windBendX = sin(windPhase) * (uWindStrength * 2.1) + windNoise * (uGustiness * 1.3);
  float windBendZ = sin(windPhase * 0.7 + 2.3) * (uWindStrength * 1.0) + windNoise * (uGustiness * 0.55);

  // stalk tip total offset
  float tipBend = mix(0.08, 0.58, uWindStrength);
  vec2 tipOff = vec2(windBendX, windBendZ) * tipBend;

  // ---- deformation ----
  if (aPartId < 0.5) {
    // == STALK ==
    float bend = pow(aUAlong, 2.0) * tipBend;
    pos.x += windBendX * bend;
    pos.z += windBendZ * bend;
    float twitch = sin(uTime * 9.0 + aInstanceSeed * 200.0)
                 * abs(microTwitch) * (0.003 + uGustiness * 0.02) * aUAlong;
    pos.x += twitch;
    norm.x += windBendX * aUAlong * 0.3;
    norm.z += windBendZ * aUAlong * 0.3;
    norm = normalize(norm);

  } else {
    // head + petals both inherit stalk-tip displacement
    pos.x += tipOff.x;
    pos.z += tipOff.y;

    if (aPartId < 1.5) {
      // == HEAD ==
      float nod = sin(uTime * 2.5 + aInstanceSeed * 80.0) * uWindStrength * 0.03;
      pos.y += nod;
      pos.x += nod * 0.5;

    } else {
      // == PETAL ==
      float petalAngle = aURadial * 2.0 * PI;
      vec2 radDir  = vec2(cos(petalAngle), sin(petalAngle));
      vec2 tanDir  = vec2(-radDir.y, radDir.x);

      // local coords relative to head centre (before stalk-tip offset)
      vec2 localXZ  = pos.xz - tipOff;
      float radDist = dot(localXZ, radDir);
      float tanDist = dot(localXZ, tanDir);
      float localY  = pos.y - HEAD_Y;

      // bloom opening: rotate in radial-up plane
      float openAngle = mix(0.2, 1.5, bloomTarget) + seedVar * 0.2;
      float curlAngle = agitation * aUAlong * aUAlong * 0.6;
      float totalAngle = openAngle + curlAngle;

      vec2 rotRY  = rot2(vec2(radDist, localY), totalAngle);
      pos.xz = rotRY.x * radDir + tanDist * tanDir + tipOff;
      pos.y  = HEAD_Y + rotRY.y;

      // flutter at tips
      float flutter = sin(uTime * 7.0 + petalAngle * 3.0 + aInstanceSeed * 50.0)
                    * uGustiness * aUAlong * aUAlong * 0.015;
      pos.y += flutter;

      // rotate normal by same bloom angle
      float nRadial = dot(norm.xz, radDir);
      float nTan    = dot(norm.xz, tanDir);
      vec2 nRot = rot2(vec2(nRadial, norm.y), totalAngle);
      norm = normalize(vec3(nRot.x * radDir.x + nTan * tanDir.x,
                            nRot.y,
                            nRot.x * radDir.y + nTan * tanDir.y));
    }
  }

  // ---- scale + translate ----
  pos *= aInstanceScale;
  pos += aInstancePos;

  // ---- colour ----
  vec3 color;
  if (aPartId < 0.5) {
    color = vec3(0.08, 0.11 + aUAlong * 0.07, 0.035);
  } else if (aPartId < 1.5) {
    color = vec3(0.25, 0.2, 0.05);
  } else {
    float hue = fract(colorSeed * 0.8 + seedVar * 0.3);
    float sat = 0.72 + slowBias * 0.25;
    float val = 0.48 + bloomTarget * 0.44;
    color = hsv2rgb(vec3(hue, sat, val));
  }

  // ---- glow mask (encoded in alpha) ----
  float glow = 0.0;
  if (aPartId > 1.5) {
    glow = bloomTarget * 0.4 + dot(color, vec3(0.3, 0.5, 0.2)) * 0.3;
  }

  // ---- output ----
  vWorldPos  = pos;
  vNormal    = norm;
  vColor     = color;
  vGlowMask  = glow;
  vStalkMask = aPartId < 0.5 ? 1.0 : 0.0;
  gl_Position = uProjection * uView * vec4(pos, 1.0);
}
