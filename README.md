# Market Garden

WebGL2 + regl multipass shader foundation built on Next.js (app router).

## Quick start

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
```

## Environment variables

For local runs, copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

`MARKET_TEXTURE_API_KEY` is optional and only sent when present.

## CI/CD and GitHub Pages

GitHub Pages deploy is configured in `.github/workflows/deploy-pages.yml`.

Use a GitHub Environment named `github-pages` and define these **Environment Secrets**:

- `MARKET_TEXTURE_API_BASE_URL`
- `MARKET_TEXTURE_API_TOKEN`
- `MARKET_TEXTURE_API_KEY` (optional)

During build, CI fetches `/market/texture` into `public/market-texture.bin`, then exports the app statically to `out/` for Pages deployment.

## Project structure

```
app/
  page.tsx              — fullscreen canvas + debug overlay (client component)
  layout.tsx            — root layout, global CSS

src/
  gl/
    capabilities.ts     — WebGL2 / float-texture capability ladder
    createRegl.ts       — creates regl over a WebGL2 context (dynamic import, SSR-safe)
    resize.ts           — DPR-aware canvas sizing
    fbo.ts              — colour FBOs + ping-pong FBO helper
    uniformBus.ts       — centralised uniform state (time, dt, resolution, mouse, params)
    passes/
      types.ts          — Pass & RenderResources interfaces
      clearPass.ts      — clears a render target
      fullscreenPass.ts — minimal texture-to-screen blit
      simPass.ts        — ping-pong feedback simulation
      compositePass.ts  — tone-map + vignette composite to screen
    shaders/
      common.glsl       — hash, noise, UV helpers (prepended to fragment shaders)
      fullscreen.vert   — standard fullscreen-quad vertex shader
      sim.frag          — feedback sim fragment shader
      composite.frag    — composite fragment shader

  scenes/
    types.ts            — Scene interface
    smokeTest.ts        — example scene wiring sim → composite

  components/
    ShaderCanvas.tsx    — owns the <canvas>, regl lifecycle, animation loop, pointer input
    DebugOverlay.tsx    — capability readout, FPS, pass toggles
```

## Adding a new scene

1. Create `src/scenes/myScene.ts` implementing the `Scene` interface:

```ts
import type { Scene } from './types';

export function createMyScene(): Scene {
  return {
    name: 'myScene',
    passNames: ['myPass'],
    init(regl, resources) { /* create passes, call pass.init() */ },
    update(state) { /* per-frame logic */ },
    draw(state, activePasses) { /* call pass.draw() for each active pass */ },
    destroy() { /* cleanup */ },
  };
}
```

2. Swap the scene in `ShaderCanvas.tsx`:

```ts
import { createMyScene } from '@/scenes/myScene';
// ...
const scene = createMyScene();
```

## Adding a new pass

1. Create `src/gl/passes/myPass.ts` implementing the `Pass` interface:

```ts
import type { Pass } from './types';

export function createMyPass(): Pass {
  return {
    name: 'myPass',
    init(regl, resources) {
      // Build your regl draw command here.
      // Use resources.pingPong, resources.dataTexture, etc.
    },
    draw(state) {
      // Call your draw command with uniforms from state.
    },
  };
}
```

2. Wire it into a scene's `init` / `draw` methods.

## Multipass ping-pong pipeline

The `PingPongFBO` exposes `.read` (last frame) and `.write` (current target).
After drawing into `.write`, call `.swap()` so the next consumer reads the
freshly written buffer.  This pattern works for any simulation that feeds back
into itself (reaction-diffusion, fluid, trails, etc.).

## Data texture placeholder

`RenderResources.dataTexture` is currently a 2×2 dummy RGBA texture.
It is already wired into every pass's uniform set, so replacing it with the
real 2×8 market-data texture requires only:

```ts
resources.dataTexture({
  width: 2,
  height: 8,
  data: newFloat32Array,
  format: 'rgba',
  type: capabilities.textureType,
});
```

No pass API changes needed — each pass already binds `dataTexture` as a uniform.

## Capability ladder

On init the system probes for (in order of preference):

1. **float** render targets (`EXT_color_buffer_float`)
2. **half float** render targets (manual framebuffer probe)
3. **uint8** fallback

The chosen type is stored in `capabilities.textureType` and used for all FBO
creation.  Passes and shaders work identically regardless of the backend type.
