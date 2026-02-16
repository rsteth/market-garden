// ---- hash / noise helpers ----

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// ---- uv helpers ----

vec2 aspectCorrect(vec2 uv, vec2 resolution) {
  float aspect = resolution.x / resolution.y;
  return vec2(uv.x * aspect, uv.y);
}
