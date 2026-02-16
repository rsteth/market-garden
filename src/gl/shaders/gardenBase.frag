precision highp float;

varying vec3  vColor;
varying vec3  vNormal;
varying vec3  vWorldPos;
varying float vGlowMask;

uniform vec3  uSunDir;
uniform float uSunHeight;
uniform vec3  uCameraPos;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCameraPos - vWorldPos);

  // diffuse (sun)
  float NdotL  = max(dot(N, uSunDir), 0.0);
  vec3 sunTint = mix(vec3(0.85, 0.45, 0.25), vec3(1.0, 0.95, 0.9), uSunHeight);

  // ambient: sky + ground bounce
  float skyAmb    = max(dot(N, vec3(0.0, 1.0, 0.0)), 0.0) * 0.15;
  float groundAmb = max(dot(N, vec3(0.0,-1.0, 0.0)), 0.0) * 0.05;
  float ambient   = 0.10 + skyAmb + groundAmb;

  // rim light
  float rim     = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3  rimCol  = sunTint * rim * uSunHeight * 0.4;

  // compose
  vec3 lit = vColor * (ambient + NdotL * 0.6 * sunTint) + rimCol;
  lit *= 0.45 + uSunHeight * 0.55;

  gl_FragColor = vec4(lit, vGlowMask);
}
