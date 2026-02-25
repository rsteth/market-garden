precision highp float;
varying vec2 vUv;

uniform sampler2D uBright;
uniform vec2  uLightScreenPos;
uniform float uGodraysIntensity;
uniform float uSunHeight;

const int   SAMPLES  = 48;
const float DECAY    = 0.96;
const float DENSITY  = 0.9;

void main() {
  vec2 delta = vec2(0.0, (uLightScreenPos.y - vUv.y)) * (DENSITY / float(SAMPLES));
  vec2 uv    = vUv;
  vec3 accum = vec3(0.0);
  float weight = 1.0;

  for (int i = 0; i < SAMPLES; i++) {
    uv += delta;
    vec3 s = texture2D(uBright, clamp(uv, 0.0, 1.0)).rgb;
    accum += s * weight;
    weight *= DECAY;
  }

  float exposure = 0.12 * uGodraysIntensity * (0.3 + uSunHeight * 0.7);
  gl_FragColor = vec4(accum * exposure, 1.0);
}
