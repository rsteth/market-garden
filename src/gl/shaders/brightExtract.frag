precision highp float;
varying vec2 vUv;

uniform sampler2D uBase;
uniform float uGodraysIntensity;
uniform float uFogAmount;

void main() {
  vec4 src = texture2D(uBase, vUv);

  float luma     = dot(src.rgb, vec3(0.299, 0.587, 0.114));
  float glowMask = src.a;

  // lower threshold when godrays or fog is high -> more bloom/godray material
  float threshold = mix(0.70, 0.25, max(uGodraysIntensity, uFogAmount * 0.6));
  float bright    = max(luma - threshold, 0.0) + glowMask * 0.5;

  gl_FragColor = vec4(src.rgb * bright, 1.0);
}
