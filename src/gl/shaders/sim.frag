// Fragment shader for the ping-pong feedback simulation pass.
// Expects common.glsl to be prepended at runtime (provides hash, noise).

varying vec2 vUv;

uniform sampler2D previousFrame;
uniform sampler2D dataTexture;
uniform vec2 resolution;
uniform vec2 mouse;
uniform float mouseDown;
uniform float time;
uniform float dt;

void main() {
  vec2 texel = 1.0 / resolution;
  vec4 prev = texture2D(previousFrame, vUv);

  // 4-neighbour diffusion
  vec4 blur = (
    texture2D(previousFrame, vUv + texel * vec2( 1.0,  0.0)) +
    texture2D(previousFrame, vUv + texel * vec2(-1.0,  0.0)) +
    texture2D(previousFrame, vUv + texel * vec2( 0.0,  1.0)) +
    texture2D(previousFrame, vUv + texel * vec2( 0.0, -1.0))
  ) * 0.25;

  vec4 diffused = mix(prev, blur, 0.12);

  // Mouse interaction — inject colour at pointer
  float distToMouse = length(vUv - mouse);
  float mouseRadius = 0.06;
  float mouseInfluence = mouseDown * smoothstep(mouseRadius, 0.0, distToMouse);

  // Cycling hue based on time + mouse x
  vec3 mouseColor = 0.5 + 0.5 * cos(time * 0.5 + vec3(0.0, 2.094, 4.189) + mouse.x * 6.28);

  // Sample data texture (placeholder — will carry market data later)
  vec4 dataSample = texture2D(dataTexture, vec2(0.25, 0.25));

  vec3 result = diffused.rgb;
  result += mouseInfluence * mouseColor;
  result *= 0.996; // gentle decay

  // Subtle ambient turbulence
  float n = noise(vUv * 8.0 + time * 0.3);
  result += n * 0.001;

  gl_FragColor = vec4(result, 1.0);
}
