// Separable 9-tap Gaussian blur.
// Call twice (horizontal then vertical) to complete the blur.
precision highp float;
varying vec2 vUv;

uniform sampler2D uSource;
uniform vec2  uDirection;   // (1/w, 0) or (0, 1/h)
uniform float uFogAmount;

void main() {
  vec3 result = texture2D(uSource, vUv).rgb * 0.227027;

  result += texture2D(uSource, vUv + uDirection * 1.0).rgb * 0.194596;
  result += texture2D(uSource, vUv - uDirection * 1.0).rgb * 0.194596;

  result += texture2D(uSource, vUv + uDirection * 2.0).rgb * 0.121622;
  result += texture2D(uSource, vUv - uDirection * 2.0).rgb * 0.121622;

  result += texture2D(uSource, vUv + uDirection * 3.0).rgb * 0.054054;
  result += texture2D(uSource, vUv - uDirection * 3.0).rgb * 0.054054;

  result += texture2D(uSource, vUv + uDirection * 4.0).rgb * 0.016216;
  result += texture2D(uSource, vUv - uDirection * 4.0).rgb * 0.016216;

  // slightly boost bloom in foggy conditions
  result *= 1.0 + uFogAmount * 0.3;

  gl_FragColor = vec4(result, 1.0);
}
