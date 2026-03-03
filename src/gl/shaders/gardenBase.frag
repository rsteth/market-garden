precision highp float;

varying vec3  vColor;
varying vec3  vNormal;
varying vec3  vWorldPos;
varying float vGlowMask;
varying float vStalkMask;
varying float vPetalMask;

uniform vec3  uSunDir;
uniform float uSunHeight;
uniform vec3  uCameraPos;
uniform float uDrawStalkOnly;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCameraPos - vWorldPos);

  if (uDrawStalkOnly > 0.5) {
    if (vStalkMask < 0.5) discard;
  } else {
    if (vStalkMask > 0.5) discard;
  }

  // diffuse (sun)
  float NdotL  = max(dot(N, uSunDir), 0.0);
  vec3 sunTint = mix(vec3(0.85, 0.45, 0.25), vec3(1.0, 0.95, 0.9), uSunHeight);
  vec3 stalkSunTint = mix(vec3(0.78, 0.72, 0.46), vec3(0.82, 0.78, 0.52), uSunHeight);

  // ambient: sky + ground bounce
  float skyAmb    = max(dot(N, vec3(0.0, 1.0, 0.0)), 0.0) * 0.15;
  float groundAmb = max(dot(N, vec3(0.0,-1.0, 0.0)), 0.0) * 0.05;
  float ambient   = 0.10 + skyAmb + groundAmb;

  // rim light
  float rim     = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3  rimTint = mix(stalkSunTint, sunTint, 1.0 - vStalkMask);
  float rimStrength = mix(0.16, 0.4, 1.0 - vStalkMask);
  vec3  rimCol  = rimTint * rim * uSunHeight * rimStrength;

  // compose
  float diffuseStrength = mix(0.38, 0.6, 1.0 - vStalkMask);
  vec3 partSunTint = mix(stalkSunTint, sunTint, 1.0 - vStalkMask);
  vec3 lit = vColor * (ambient + NdotL * diffuseStrength * partSunTint) + rimCol;
  float dayRamp = mix(0.45 + uSunHeight * 0.55, 0.52 + uSunHeight * 0.34, vStalkMask);
  lit *= dayRamp;

  // keep stalks from blowing out at noon; retain a warmer, more organic tone
  lit = mix(lit * vec3(0.86, 0.9, 0.74), lit, 1.0 - vStalkMask);

  // subtle petal self-illumination for extra pop
  float petalEmission = vPetalMask * (0.2 + 0.12 * vGlowMask);
  lit += vColor * petalEmission;

  gl_FragColor = vec4(lit, vGlowMask);
}
