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

import type REGL from 'regl';
import type { RenderResources } from '@/gl/passes/types';
import type { UniformState } from '@/gl/uniformBus';
import type { Scene } from './types';
import type { MarketEnvironment } from '@/gl/marketData';

import { perspective, lookAt, projectDirToScreen } from '@/gl/camera';
import type { Mat4, Vec3 } from '@/gl/camera';
import { generateFlowerMesh } from '@/gl/meshFlower';
import { generateInstances } from '@/gl/gardenInstances';
import { fetchMarketData, uploadMarketTexture, extractEnvironment } from '@/gl/marketData';

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

  // FBOs
  let fboBase:  REGL.Framebuffer2D;
  let fboHalfA: REGL.Framebuffer2D;
  let fboHalfB: REGL.Framebuffer2D;
  let fboHalfC: REGL.Framebuffer2D;

  // camera matrices
  let projMatrix: Mat4;
  let viewMatrix: Mat4;

  // resources handle
  let res: RenderResources;
  let reglRef: REGL.Regl;

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
      reglRef = regl;
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

      // ---- FBOs ----
      const w = 1;
      const h = 1; // will resize on first frame
      const texType = resources.capabilities.textureType as REGL.TextureDataType;

      fboBase = regl.framebuffer({
        width: w, height: h,
        color: regl.texture({ width: w, height: h, type: texType, format: 'rgba', min: 'linear', mag: 'linear', wrap: 'clamp' }),
        depth: true,
      });
      const makeHalf = () => regl.framebuffer({
        width: w, height: h,
        color: regl.texture({ width: w, height: h, type: texType, format: 'rgba', min: 'linear', mag: 'linear', wrap: 'clamp' }),
        depthStencil: false,
      });
      fboHalfA = makeHalf();
      fboHalfB = makeHalf();
      fboHalfC = makeHalf();

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

        fboBase.resize(w, h);
        fboHalfA.resize(halfW, halfH);
        fboHalfB.resize(halfW, halfH);
        fboHalfC.resize(halfW, halfH);

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
            uploadMarketTexture(res.dataTexture, data);
          })
          .catch(() => {})
          .finally(() => { fetchInFlight = false; });
      }

      // ---- extract environment ----
      if (rawData) {
        env = extractEnvironment(rawData, state.nowUtc);
      }
    },

    draw(state, activePasses) {
      const sunScreen = projectDirToScreen(env.sunDir, viewMatrix, projMatrix);

      // A — base garden render
      if (activePasses.has('garden')) {
        basePass.draw({
          framebuffer: fboBase,
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
          resolution: state.resolution,
        });
      }

      // B — bright extract
      brightPass.draw({
        source: fboBase,
        framebuffer: fboHalfA,
        auroraEnergy: env.auroraEnergy,
        fogAmount: env.fogAmount,
      });

      // C — godrays (from bright, before bloom blurs it)
      if (activePasses.has('godrays')) {
        godraysPass.draw({
          source: fboHalfA,
          framebuffer: fboHalfB,
          lightScreenPos: sunScreen,
          auroraEnergy: env.auroraEnergy,
          sunHeight: env.sunHeight,
        });
      }

      // D — bloom (H+V blur of bright extract)
      if (activePasses.has('bloom')) {
        bloomPass.draw({
          source: fboHalfA,
          temp: fboHalfC,
          output: fboHalfA, // write back into A (bright is consumed)
          halfWidth: halfW,
          halfHeight: halfH,
          fogAmount: env.fogAmount,
        });
      }

      // E — composite to screen
      if (activePasses.has('composite')) {
        compositePass.draw({
          base: fboBase,
          bloom: fboHalfA,
          rays: fboHalfB,
          fogAmount: env.fogAmount,
          sunHeight: env.sunHeight,
          auroraEnergy: env.auroraEnergy,
          dayPhase: env.dayPhase,
          treatment,
        });
      }
    },

    destroy() {
      fboBase.destroy();
      fboHalfA.destroy();
      fboHalfB.destroy();
      fboHalfC.destroy();
    },
  };
}
