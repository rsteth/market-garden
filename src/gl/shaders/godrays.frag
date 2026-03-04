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
  float midday = 1.0 - abs(phase * 2.0 - 1.0);
  vec3 dawnRed = vec3(1.0, 0.18, 0.08);
  vec3 noonYellow = vec3(1.0, 0.80, 0.28);
  vec3 noonWhite = vec3(1.0, 0.9, 0.72);
  vec3 rayColor = mix(dawnRed, noonYellow, smoothstep(0.0, 0.7, midday));
  rayColor = mix(rayColor, noonWhite, smoothstep(0.75, 1.0, midday));

  float rayAngle = 3.14159265359 * (1.0 - phase);
  vec2 rayDir = vec2(cos(rayAngle), sin(rayAngle));
  vec2 toLight = uLightScreenPos - vUv;
  float projectedSpan = dot(toLight, rayDir);
  float radialSpan = length(toLight);
  float raySpan = max(abs(projectedSpan), radialSpan * 0.35);
  vec2 delta = rayDir * (raySpan * DENSITY / float(SAMPLES));
  vec2 uvF   = vUv;
  vec2 uvB   = vUv;
  float accum = 0.0;
  float weight = 1.0;

  for (int i = 0; i < SAMPLES; i++) {
    uvF += delta;
    uvB -= delta;
    vec3 sF = texture2D(uBright, clamp(uvF, 0.0, 1.0)).rgb;
    vec3 sB = texture2D(uBright, clamp(uvB, 0.0, 1.0)).rgb;
    float lF = dot(sF, vec3(0.2126, 0.7152, 0.0722));
    float lB = dot(sB, vec3(0.2126, 0.7152, 0.0722));
    accum += (lF + lB) * (0.5 * weight);
    weight *= DECAY;
  }

  float topPresence = smoothstep(0.05, 0.95, vUv.y);
  float distanceFade = mix(0.08, 1.0, pow(topPresence, 1.2));
  float exposure = 0.8 * uGodraysIntensity;
  gl_FragColor = vec4(rayColor * (accum * exposure * distanceFade), 1.0);
}
