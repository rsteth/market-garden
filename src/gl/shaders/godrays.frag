precision highp float;
varying vec2 vUv;

uniform sampler2D uBright;
uniform vec2  uLightScreenPos;
uniform float uGodraysIntensity;
uniform float uSunHeight;
uniform float uDayPhase;

const int   SAMPLES  = 128;
const float DECAY    = 0.96;
const float DENSITY  = 0.9;

void main() {
  float phase = clamp(uDayPhase, 0.0, 1.0);
  float rayAngle = 3.14159265359 * (1.0 - phase);
  vec2 rayDir = vec2(cos(rayAngle), sin(rayAngle));
  vec2 toLight = uLightScreenPos - vUv;
  float projectedSpan = dot(toLight, rayDir);
  float radialSpan = length(toLight);
  float raySpan = max(abs(projectedSpan), radialSpan * 0.35);
  vec2 delta = rayDir * (raySpan * DENSITY / float(SAMPLES));
  vec2 uvF   = vUv;
  vec2 uvB   = vUv;
  vec3 accum = vec3(0.0);
  float weight = 1.0;

  for (int i = 0; i < SAMPLES; i++) {
    uvF += delta;
    uvB -= delta;
    vec3 sF = texture2D(uBright, clamp(uvF, 0.0, 1.0)).rgb;
    vec3 sB = texture2D(uBright, clamp(uvB, 0.0, 1.0)).rgb;
    accum += (sF + sB) * (0.5 * weight);
    weight *= DECAY;
  }

  float exposure = 0.8 * uGodraysIntensity;
  gl_FragColor = vec4(accum * exposure, 1.0);
}
