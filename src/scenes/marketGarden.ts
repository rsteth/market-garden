/**
 * Market Garden scene.
 *
 * Pipeline per frame:
 *   A  gardenBase   → fboBase   (instanced flowers + ground, RGBA+depth)
 *   B  brightExtract → fboHalfA (threshold glow)
 *   C  godrays      → fboHalfB  (radial blur toward sun)
 *   D  bloom H+V    → fboHalfA  (separable Gaussian via fboHalfC as temp)
 *   E  composite    → screen    (base + bloom + rays + fog + grade)
 */

import type { RenderResources } from '@/gl/passes/types';
import type { Scene } from './types';
import type { MarketEnvironment } from '@/gl/marketData';
import type { RenderTarget } from '@/gl/renderTarget';

import { perspective, lookAt, projectDirToScreen } from '@/gl/camera';
import type { Mat4, Vec3 } from '@/gl/camera';
import { generateFlowerMesh } from '@/gl/meshFlower';
import { generateInstances } from '@/gl/gardenInstances';
import { fetchMarketData, uploadMarketTexture, extractEnvironment, calculateSun } from '@/gl/marketData';
import { createRenderTarget } from '@/gl/renderTarget';

import { createGardenBasePass } from '@/gl/passes/gardenBasePass';
import { createBrightExtractPass } from '@/gl/passes/brightExtractPass';
import { createGodraysPass } from '@/gl/passes/godraysPass';
import { createBloomPass } from '@/gl/passes/bloomPass';
import { createGardenCompositePass } from '@/gl/passes/gardenCompositePass';

// ---- camera ----
const EYE: Vec3    = [0, 18, 24];
const CENTER: Vec3 = [0, 2, 0];
const UP: Vec3     = [0, 1, 0];
const FOV = 58 * Math.PI / 180;
const NEAR = 0.5;
const FAR  = 120;

// ---- data fetch interval ----
const FETCH_INTERVAL_MS = 30_000;

export function createMarketGardenScene(): Scene {
  // passes (assigned in init)
  let basePass:      ReturnType<typeof createGardenBasePass>;
  let brightPass:    ReturnType<typeof createBrightExtractPass>;
  let godraysPass:   ReturnType<typeof createGodraysPass>;
  let bloomPass:     ReturnType<typeof createBloomPass>;
  let compositePass: ReturnType<typeof createGardenCompositePass>;

  // Render targets
  let rtBase:  RenderTarget;
  let rtHalfA: RenderTarget;
  let rtHalfB: RenderTarget;
  let rtHalfC: RenderTarget;

  // camera matrices
  let projMatrix: Mat4;
  let viewMatrix: Mat4;

  // resources handle
  let res: RenderResources;

  // market data
  let rawData: Float32Array | null = null;
  let env: MarketEnvironment = {
    windStrength: 0.3, gustiness: 0.1, fogAmount: 0.2,
    auroraEnergy: 0.3, dayPhase: 0.5, sunHeight: 1, sunDir: [0, 1, 0],
  };
  let treatment = 0;
  let lastFetchTime = 0;
  let fetchInFlight = false;

  // current canvas size tracking
  let curWidth = 1;
  let curHeight = 1;
  let halfW = 1;
  let halfH = 1;

  return {
    name: 'marketGarden',
    passNames: ['garden', 'bloom', 'godrays', 'composite'],

    init(regl, resources) {
      res = resources;

      // ---- mesh + instances ----
      const mesh = generateFlowerMesh();
      const instances = generateInstances(10_000);

      // ---- passes ----
      basePass      = createGardenBasePass(regl, mesh, instances);
      brightPass    = createBrightExtractPass(regl);
      godraysPass   = createGodraysPass(regl);
      bloomPass     = createBloomPass(regl);
      compositePass = createGardenCompositePass(regl);

      // ---- render targets ----
      const w = 1;
      const h = 1; // will resize on first frame
      const { gl } = resources;

      rtBase  = createRenderTarget(regl, gl, w, h, { depth: true });
      rtHalfA = createRenderTarget(regl, gl, w, h);
      rtHalfB = createRenderTarget(regl, gl, w, h);
      rtHalfC = createRenderTarget(regl, gl, w, h);

      // camera (view is static; projection updated on resize)
      viewMatrix = lookAt(EYE, CENTER, UP);
      projMatrix = perspective(FOV, 1, NEAR, FAR);
    },

    update(state) {
      // ---- resize FBOs if canvas changed ----
      const [w, h] = state.resolution;
      if (w !== curWidth || h !== curHeight) {
        curWidth = w; curHeight = h;
        halfW = Math.max(1, Math.floor(w / 2));
        halfH = Math.max(1, Math.floor(h / 2));

        rtBase.resize(w, h);
        rtHalfA.resize(halfW, halfH);
        rtHalfB.resize(halfW, halfH);
        rtHalfC.resize(halfW, halfH);

        projMatrix = perspective(FOV, w / h, NEAR, FAR);
      }

      // ---- treatment from params ----
      treatment = (state.params.treatment ?? 0) | 0;

      // ---- periodic data fetch ----
      const now = performance.now();
      if (!fetchInFlight && now - lastFetchTime > FETCH_INTERVAL_MS) {
        fetchInFlight = true;
        lastFetchTime = now;
        fetchMarketData()
          .then((data) => {
            rawData = data;
            uploadMarketTexture(res.gl, res.dataTexture, data);
            console.info('[market-data] Connected and updated market texture', {
              floats: data.length,
            });
          })
          .catch((error: unknown) => {
            console.error('[market-data] Failed to connect to market texture endpoint', error);
          })
          .finally(() => { fetchInFlight = false; });
      }

      // ---- extract environment ----
      if (rawData) {
        env = extractEnvironment(rawData, state.nowUtc);
      }

      // ---- apply overrides ----
      if (state.overrides) {
        const o = state.overrides;
        if (o.windStrength?.active) env.windStrength = o.windStrength.value;
        if (o.gustiness?.active)    env.gustiness    = o.gustiness.value;
        if (o.fogAmount?.active)    env.fogAmount    = o.fogAmount.value;
        if (o.auroraEnergy?.active) env.auroraEnergy = o.auroraEnergy.value;

        if (o.dayPhase?.active) {
          env.dayPhase = o.dayPhase.value;
          const { sunHeight, sunDir } = calculateSun(env.dayPhase);
          env.sunHeight = sunHeight;
          env.sunDir = sunDir;
        }
      }
    },

    draw(state, activePasses) {
      const sunScreen = projectDirToScreen(env.sunDir, viewMatrix, projMatrix);
      const o = state.overrides;
      const auroraEnergy = o.auroraEnergy?.active ? o.auroraEnergy.value : env.auroraEnergy;

      // A — base garden render
      if (activePasses.has('garden')) {
        basePass.draw({
          framebuffer: rtBase.fbo,
          projection: projMatrix,
          view: viewMatrix,
          dataTexture: res.dataTexture,
          cameraPos: EYE,
          time: state.time,
          sunDir: env.sunDir,
          sunHeight: env.sunHeight,
          windStrength: env.windStrength,
          gustiness: env.gustiness,
          fogAmount: env.fogAmount,
          dayPhase: env.dayPhase,
          overrideBloomTargetActive: o.bloomTarget?.active ? 1 : 0,
          overrideBloomTargetValue: o.bloomTarget?.value ?? 0.5,
          overrideAgitationActive: o.agitation?.active ? 1 : 0,
          overrideAgitationValue: o.agitation?.value ?? 0.5,
          overrideMicroTwitchActive: o.microTwitch?.active ? 1 : 0,
          overrideMicroTwitchValue: o.microTwitch?.value ?? 0.5,
          overrideColorSeedActive: o.colorSeed?.active ? 1 : 0,
          overrideColorSeedValue: o.colorSeed?.value ?? 0.5,
          overrideSlowBiasActive: o.slowBias?.active ? 1 : 0,
          overrideSlowBiasValue: o.slowBias?.value ?? 0.5,
          regionOverrideActiveA: [
            o.region1Influence?.active ? 1 : 0,
            o.region2Influence?.active ? 1 : 0,
            o.region3Influence?.active ? 1 : 0,
            o.region4Influence?.active ? 1 : 0,
          ],
          regionOverrideActiveB: [
            o.region5Influence?.active ? 1 : 0,
            o.region6Influence?.active ? 1 : 0,
            o.region7Influence?.active ? 1 : 0,
            0,
          ],
          regionOverrideValueA: [
            o.region1Influence?.value ?? 1,
            o.region2Influence?.value ?? 1,
            o.region3Influence?.value ?? 1,
            o.region4Influence?.value ?? 1,
          ],
          regionOverrideValueB: [
            o.region5Influence?.value ?? 1,
            o.region6Influence?.value ?? 1,
            o.region7Influence?.value ?? 1,
            1,
          ],
          resolution: state.resolution,
        });
      }

      // B — bright extract
      brightPass.draw({
        source: rtBase.fbo,
        framebuffer: rtHalfA.fbo,
        auroraEnergy,
        fogAmount: env.fogAmount,
      });

      // C — godrays (from bright, before bloom blurs it)
      if (activePasses.has('godrays')) {
        godraysPass.draw({
          source: rtHalfA.fbo,
          framebuffer: rtHalfB.fbo,
          lightScreenPos: sunScreen,
          auroraEnergy,
          sunHeight: env.sunHeight,
        });
      }

      // D — bloom (H+V blur of bright extract)
      if (activePasses.has('bloom')) {
        bloomPass.draw({
          source: rtHalfA.fbo,
          temp: rtHalfC.fbo,
          output: rtHalfA.fbo, // write back into A (bright is consumed)
          halfWidth: halfW,
          halfHeight: halfH,
          fogAmount: env.fogAmount,
        });
      }

      // E — composite to screen
      if (activePasses.has('composite')) {
        compositePass.draw({
          base: rtBase.fbo,
          bloom: rtHalfA.fbo,
          rays: rtHalfB.fbo,
          fogAmount: env.fogAmount,
          sunHeight: env.sunHeight,
          auroraEnergy,
          dayPhase: env.dayPhase,
          treatment,
        });
      }
    },

    destroy() {
      rtBase.destroy();
      rtHalfA.destroy();
      rtHalfB.destroy();
      rtHalfC.destroy();
    },
  };
}
