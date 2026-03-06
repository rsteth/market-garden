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
attribute float aInstanceKind;
attribute float aInstanceHeightScale;

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
uniform vec4  uFlowerVariantMaskA;
uniform vec4  uFlowerVariantMaskB;

// ---- varyings ----
varying vec3  vColor;
varying vec3  vNormal;
varying vec3  vWorldPos;
varying float vGlowMask;
varying float vStalkMask;
varying float vPetalMask;
varying float vBloomStage;
varying float vVariantVisible;

// ---- constants ----
const float PI = 3.14159265;
const float HEAD_Y = 1.0;
const float HEAD_R = 0.03;
const float REGION_SIGMA2 = 35.5556;

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
  float radius = (11.0 + 2.0 * sin(float(i) * 1.7)) * 1.2;
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

float tallFlowerMask(float kind) {
  return step(0.5, kind);
}

float variantVisible(float kind) {
  if (kind < 0.5) return uFlowerVariantMaskA.x;
  if (kind < 1.5) return uFlowerVariantMaskA.y;
  if (kind < 2.5) return uFlowerVariantMaskA.z;
  if (kind < 3.5) return uFlowerVariantMaskA.w;
  return uFlowerVariantMaskB.x;
}

float kindBand(float kind, float center) {
  return 1.0 - step(0.5, abs(kind - center));
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
  float showVariant = variantVisible(aInstanceKind);
  float isTallFlower = tallFlowerMask(aInstanceKind);
  float tallness = mix(1.0, aInstanceHeightScale, isTallFlower);
  float orchidW = kindBand(aInstanceKind, 1.0) * isTallFlower;
  float sunflowerW = kindBand(aInstanceKind, 2.0) * isTallFlower;
  float lilyW = kindBand(aInstanceKind, 3.0) * isTallFlower;
  float foxgloveW = kindBand(aInstanceKind, 4.0) * isTallFlower;

  // ---- wind ----
  vec2 windSample = aInstancePos.xz * 0.15 + uTime * vec2(0.3, 0.2);
  float windNoise = noise2d(windSample);
  float windPhase = uTime * 1.8 + aInstancePos.x * 0.12 + aInstancePos.z * 0.09;
  float windBendX = sin(windPhase) * (uWindStrength * 2.1) + windNoise * (uGustiness * 1.3);
  float windBendZ = sin(windPhase * 0.7 + 2.3) * (uWindStrength * 1.0) + windNoise * (uGustiness * 0.55);

  // stalk tip total offset
  float tipBend = mix(0.08, 0.58, uWindStrength) * mix(1.0, 1.24, isTallFlower);
  vec2 tipOff = vec2(windBendX, windBendZ) * tipBend;
  float stalkLean = orchidW * 0.08 + sunflowerW * 0.02 + lilyW * 0.05 + foxgloveW * 0.16;

  // ---- deformation ----
  if (aPartId < 0.5) {
    // == STALK ==
    float bend = pow(aUAlong, 2.0) * tipBend;
    pos.x += stalkLean * aUAlong;
    pos.x += windBendX * bend;
    pos.z += windBendZ * bend;
    float twitch = sin(uTime * 9.0 + aInstanceSeed * 200.0)
                 * abs(microTwitch) * (0.003 + uGustiness * 0.02) * aUAlong;
    pos.x += twitch;
    norm.x += windBendX * aUAlong * 0.3;
    norm.z += windBendZ * aUAlong * 0.3;
    norm = normalize(norm);

  } else {
    if (aPartId < 1.5) {
      // == HEAD ==
      float headDisk = sunflowerW * 1.9 + orchidW * 0.7 + lilyW * 0.55 + foxgloveW * 0.45;
      float headStretch = sunflowerW * 0.35 + orchidW * 0.85 + lilyW * 1.1 + foxgloveW * 1.35;
      pos.xz *= mix(1.0, headDisk, isTallFlower);
      pos.y = mix(pos.y, HEAD_Y + (pos.y - HEAD_Y) * headStretch, isTallFlower);
      // inherit stalk-tip displacement after local scaling
      pos.x += tipOff.x + stalkLean;
      pos.z += tipOff.y;
      float nod = sin(uTime * 2.5 + aInstanceSeed * 80.0) * uWindStrength * 0.03;
      pos.y += nod;
      pos.x += nod * 0.5;

    } else {
      // == PETAL ==
      float petalAngle = aURadial * 2.0 * PI;
      vec2 radDir  = vec2(cos(petalAngle), sin(petalAngle));
      vec2 tanDir  = vec2(-radDir.y, radDir.x);

      // local coords relative to head centre
      vec2 localXZ  = pos.xz;
      float radDist = dot(localXZ, radDir);
      float tanDist = dot(localXZ, tanDir);
      float localY  = pos.y - HEAD_Y;

      // bloom opening: rotate in radial-up plane
      float openAngle = mix(0.2, 1.5, bloomTarget) + seedVar * 0.2;
      float curlAngle = agitation * aUAlong * aUAlong * 0.6;
      float totalAngle = openAngle + curlAngle;

      float petalLength = 1.0 + orchidW * 0.25 + sunflowerW * 0.55 + lilyW * 0.9 + foxgloveW * 0.48;
      float petalWidth = 1.0 + orchidW * 0.5 + sunflowerW * 1.15 - lilyW * 0.36 - foxgloveW * 0.2;
      float cupShape = orchidW * 0.55 + lilyW * 0.15 + foxgloveW * 0.8;
      float droop = foxgloveW * 0.55 + lilyW * 0.08;

      radDist *= petalLength;
      tanDist *= petalWidth;
      localY += cupShape * (1.0 - aUAlong) * 0.05;

      vec2 rotRY  = rot2(vec2(radDist, localY), totalAngle);
      pos.xz = rotRY.x * radDir + tanDist * tanDir + tipOff + vec2(stalkLean, 0.0);
      pos.y  = HEAD_Y + rotRY.y;

      // flutter at tips
      float flutter = sin(uTime * 7.0 + petalAngle * 3.0 + aInstanceSeed * 50.0)
                    * uGustiness * aUAlong * aUAlong * 0.015;
      pos.y += flutter;
      pos.y -= droop * aUAlong * aUAlong * 0.18;

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
  pos.y *= tallness;
  pos *= aInstanceScale;
  pos += aInstancePos;

  // ---- colour ----
  vec3 color;
  if (aPartId < 0.5) {
    color = vec3(0.045, 0.14 + aUAlong * 0.08, 0.04);
  } else if (aPartId < 1.5) {
    color = vec3(0.25, 0.2, 0.05);
  } else {
    float hueWarm = fract(0.02 + colorSeed * 0.18 + seedVar * 0.08);
    float hueBlue = fract(0.54 + colorSeed * 0.14 + seedVar * 0.10);
    float useBlue = step(0.72, hash11(aInstanceSeed * 211.3 + colorSeed * 97.1));
    float hue = mix(hueWarm, hueBlue, useBlue);
    float sat = 0.72 + slowBias * 0.25;
    float val = 0.48 + bloomTarget * 0.44;
    vec3 basePetalColor = hsv2rgb(vec3(hue, sat, val));

    float tallSpeciesT = clamp((aInstanceKind - 1.0) / 3.0, 0.0, 1.0);
    vec3 purpleDark = vec3(0.18, 0.05, 0.29);
    vec3 purpleBright = vec3(0.96, 0.94, 1.0);
    float speciesShift = (tallSpeciesT - 0.5) * 0.22;
    float gradientT = clamp(aUAlong + seedVar * 0.12 + speciesShift, 0.0, 1.0);
    vec3 tallPetalColor = mix(purpleBright, purpleDark, gradientT);

    color = mix(basePetalColor, tallPetalColor, isTallFlower);
  }

  // ---- glow mask (encoded in alpha) ----
  float glow = 0.0;
  if (aPartId > 1.5) {
    glow = bloomTarget * mix(0.4, 0.55, isTallFlower) + dot(color, vec3(0.3, 0.5, 0.2)) * 0.3;
  }

  // ---- output ----
  vWorldPos  = pos;
  vNormal    = norm;
  vColor     = color;
  vGlowMask  = glow;
  vStalkMask = aPartId < 0.5 ? 1.0 : 0.0;
  vPetalMask = aPartId > 1.5 ? 1.0 : 0.0;
  vBloomStage = bloomTarget;
  vVariantVisible = showVariant;
  gl_Position = uProjection * uView * vec4(pos, 1.0);
}
