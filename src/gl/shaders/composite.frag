// Fragment shader for the composite-to-screen pass.

precision highp float;

varying vec2 vUv;

uniform sampler2D source;
uniform sampler2D dataTexture;
uniform vec2 resolution;
uniform float time;

void main() {
  vec4 color = texture2D(source, vUv);

  // Vignette
  vec2 center = vUv - 0.5;
  float vignette = 1.0 - dot(center, center) * 0.5;
  color.rgb *= vignette;

  // Reinhard tone-map
  color.rgb = color.rgb / (1.0 + color.rgb);

  // Gamma
  color.rgb = pow(color.rgb, vec3(1.0 / 2.2));

  gl_FragColor = vec4(color.rgb, 1.0);
}
