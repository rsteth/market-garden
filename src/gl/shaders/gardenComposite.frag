precision highp float;
varying vec2 vUv;

uniform sampler2D uBase;
uniform sampler2D uBloom;
uniform sampler2D uRays;
uniform float uFogAmount;
uniform float uSunHeight;
uniform float uGodraysIntensity;
uniform float uDayPhase;
uniform int   uTreatment;    // 0 cinematic, 1 clean

void main() {
  vec3 base  = texture2D(uBase,  vUv).rgb;
  vec3 bloom = texture2D(uBloom, vUv).rgb;
  vec3 rays  = texture2D(uRays,  vUv).rgb;

  // bloom intensity: cinematic is hazier
  float bloomI = (uTreatment == 0) ? 0.55 : 0.12;
  // godrays intensity: cinematic + godrays-driven
  float raysI  = (uTreatment == 0) ? 0.40 * uGodraysIntensity : 0.08 * uGodraysIntensity;

  vec3 color = base + bloom * bloomI + rays * raysI;

  // ---- fog ----
  // fog colour shifts with sun: warm dusk vs blue midday
  vec3 fogColorDay   = vec3(0.45, 0.50, 0.58);
  vec3 fogColorDusk  = vec3(0.30, 0.22, 0.18);
  float duskFactor   = 1.0 - smoothstep(0.0, 0.4, uSunHeight);
  vec3  fogColor     = mix(fogColorDay, fogColorDusk, duskFactor);

  color = mix(color, fogColor, uFogAmount * 0.55);

  // desaturate in fog
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, 1.0 - uFogAmount * 0.35);

  // ---- tone-map + gamma ----
  color = color / (1.0 + color);
  color = pow(color, vec3(1.0 / 2.2));

  // ---- vignette ----
  vec2 vc = vUv - 0.5;
  color *= 1.0 - dot(vc, vc) * 0.35;

  gl_FragColor = vec4(color, 1.0);
}
