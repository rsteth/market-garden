'use client';

import { useRef, useEffect } from 'react';
import type { DebugInfo, Controls } from '../../app/page';
import { checkCapabilities } from '@/gl/capabilities';
import type { CapabilityPlan } from '@/gl/capabilities';
import { initRegl } from '@/gl/createRegl';
import { computeCanvasSize, applyCanvasSize } from '@/gl/resize';
import { createPingPongFBO } from '@/gl/fbo';
import { createFloatTexture } from '@/gl/renderTarget';
import { createUniformBus } from '@/gl/uniformBus';
import type { RenderResources } from '@/gl/passes/types';
import { createMarketGardenScene } from '@/scenes/marketGarden';

interface ShaderCanvasProps {
  controls: Controls;
  onDebugInfo: (info: DebugInfo) => void;
}

const canvasStyle: React.CSSProperties = {
  display: 'block',
  width: '100vw',
  height: '100vh',
  touchAction: 'none',
};

const MAX_DT = 1 / 15;

export function ShaderCanvas({ controls, onDebugInfo }: ShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  const onDebugInfoRef = useRef(onDebugInfo);
  onDebugInfoRef.current = onDebugInfo;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let animationFrameId = 0;

    const bootstrap = async () => {
      const { regl, gl } = await initRegl(canvas);
      if (disposed) { regl.destroy(); return; }

      const capabilities: CapabilityPlan = checkCapabilities(gl);

      const initialSize = computeCanvasSize(canvas);
      if (applyCanvasSize(canvas, initialSize)) {
        regl.poll();
      }

      // shared resources (pingPong kept for interface compat; garden uses its own FBOs)
      const pingPong = createPingPongFBO(regl, gl, initialSize.width, initialSize.height);

      // data texture — starts as 4x8 zeros; the scene uploads real data on first fetch
      const dataTexture = createFloatTexture(regl, gl, 4, 8, new Float32Array(4 * 8 * 4));

      const resources: RenderResources = { gl, pingPong, dataTexture, capabilities };

      // ---- scene ----
      const scene = createMarketGardenScene();
      scene.init(regl, resources);

      const uniformBus = createUniformBus();

      // ---- pointer ----
      let pointerX = 0;
      let pointerY = 0;
      let pointerDown = false;

      const updatePointer = (clientX: number, clientY: number) => {
        const rect = canvas.getBoundingClientRect();
        pointerX = (clientX - rect.left) / rect.width;
        pointerY = 1.0 - (clientY - rect.top) / rect.height;
      };

      // ---- gesture state (pinch-zoom + orbit) ----
      // Soft limits — preferred range the user can freely set
      const ZOOM_SOFT_MIN = 0.3;
      const ZOOM_SOFT_MAX = 1.5;
      // Hard limits — how far past the soft edge you can push while touching
      const ZOOM_HARD_MIN = 0.2;
      const ZOOM_HARD_MAX = 1.65;

      const ORBIT_SOFT_RAD = 40 * Math.PI / 180;  // ±40°
      const ORBIT_HARD_RAD = 46 * Math.PI / 180;  // ±46°

      let gestureZoom = 1;
      let gestureOrbitYaw = 0;   // radians
      let gestureOrbitPitch = 0; // radians
      let gestureActive = false;

      // pinch bookkeeping
      let lastPinchDist = 0;
      let lastMidX = 0;
      let lastMidY = 0;

      // single-finger orbit bookkeeping
      let lastSingleX = 0;
      let lastSingleY = 0;
      let singleFingerActive = false;

      const pinchDist = (t: TouchList) => {
        const dx = t[1].clientX - t[0].clientX;
        const dy = t[1].clientY - t[0].clientY;
        return Math.sqrt(dx * dx + dy * dy);
      };
      const pinchMid = (t: TouchList): [number, number] => [
        (t[0].clientX + t[1].clientX) / 2,
        (t[0].clientY + t[1].clientY) / 2,
      ];

      const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

      /** Ease value back toward [lo..hi] if it exceeds the soft range. */
      const easeTo = (v: number, lo: number, hi: number, alpha: number) => {
        if (v < lo) return v + (lo - v) * alpha;
        if (v > hi) return v + (hi - v) * alpha;
        return v;
      };

      const onMouseMove  = (e: MouseEvent) => updatePointer(e.clientX, e.clientY);
      const onMouseDown  = (e: MouseEvent) => { pointerDown = true; updatePointer(e.clientX, e.clientY); };
      const onMouseUp    = () => { pointerDown = false; };

      const onTouchStart = (e: TouchEvent) => {
        e.preventDefault();
        if (e.touches.length === 2) {
          gestureActive = true;
          singleFingerActive = false;
          lastPinchDist = pinchDist(e.touches);
          const [mx, my] = pinchMid(e.touches);
          lastMidX = mx; lastMidY = my;
        } else if (e.touches.length === 1) {
          pointerDown = true;
          singleFingerActive = true;
          lastSingleX = e.touches[0].clientX;
          lastSingleY = e.touches[0].clientY;
          updatePointer(e.touches[0].clientX, e.touches[0].clientY);
        }
      };

      const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        if (e.touches.length === 2 && gestureActive) {
          // --- pinch zoom ---
          const dist = pinchDist(e.touches);
          if (lastPinchDist > 0) {
            const scale = lastPinchDist / dist; // inverted: pinch-in zooms out, spread zooms in
            gestureZoom = clamp(gestureZoom * scale, ZOOM_HARD_MIN, ZOOM_HARD_MAX);
          }
          lastPinchDist = dist;

          const [mx, my] = pinchMid(e.touches);
          lastMidX = mx; lastMidY = my;
        } else if (e.touches.length === 1 && singleFingerActive) {
          // --- single-finger orbit ---
          const rect = canvas.getBoundingClientRect();
          const dx = (e.touches[0].clientX - lastSingleX) / rect.width;
          const dy = (e.touches[0].clientY - lastSingleY) / rect.height;
          // Invert yaw when finger is in the bottom half of the screen
          const screenY = (e.touches[0].clientY - rect.top) / rect.height;
          const yawSign = screenY > 0.5 ? -1 : 1;
          gestureOrbitYaw   = clamp(gestureOrbitYaw   + dx * 1.5 * yawSign, -ORBIT_HARD_RAD, ORBIT_HARD_RAD);
          gestureOrbitPitch = clamp(gestureOrbitPitch  - dy * 1.5, -ORBIT_HARD_RAD, ORBIT_HARD_RAD);
          lastSingleX = e.touches[0].clientX;
          lastSingleY = e.touches[0].clientY;
          updatePointer(e.touches[0].clientX, e.touches[0].clientY);
        }
      };

      const onTouchEnd = (e: TouchEvent) => {
        if (e.touches.length < 2) {
          gestureActive = false;
          lastPinchDist = 0;
        }
        if (e.touches.length === 0) {
          pointerDown = false;
          singleFingerActive = false;
        }
      };

      // mouse-wheel zoom (desktop)
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const factor = 1 + e.deltaY * 0.001;
        gestureZoom = clamp(gestureZoom * factor, ZOOM_HARD_MIN, ZOOM_HARD_MAX);
      };

      canvas.addEventListener('mousemove',  onMouseMove);
      canvas.addEventListener('mousedown',  onMouseDown);
      window.addEventListener('mouseup',    onMouseUp);
      canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
      canvas.addEventListener('touchstart', onTouchStart, { passive: false });
      canvas.addEventListener('touchend',   onTouchEnd);
      canvas.addEventListener('wheel',      onWheel,      { passive: false });

      // ---- timing ----
      const startTime = performance.now() / 1000;
      let lastTime = startTime;
      let frameCount = 0;
      let fpsAccumTime = 0;

      onDebugInfoRef.current({ fps: 0, frameTime: 0, capabilities });

      // ---- loop ----
      const tick = (nowMs: number) => {
        if (disposed) return;
        animationFrameId = requestAnimationFrame(tick);

        const nowSec = nowMs / 1000;
        const rawDt = nowSec - lastTime;
        const dt = Math.min(rawDt, MAX_DT);
        lastTime = nowSec;

        frameCount++;
        fpsAccumTime += rawDt;
        if (fpsAccumTime >= 1) {
          onDebugInfoRef.current({
            fps: Math.round(frameCount / fpsAccumTime),
            frameTime: (fpsAccumTime / frameCount) * 1000,
            capabilities,
          });
          frameCount = 0;
          fpsAccumTime = 0;
        }

        const size = computeCanvasSize(canvas);
        if (applyCanvasSize(canvas, size)) {
          regl.poll();
          pingPong.resize(size.width, size.height);
        }

        const ctrl = controlsRef.current;
        if (ctrl.paused) return;

        // Rubber-band: ease back toward soft limits when not actively gesturing
        if (!gestureActive) {
          const snap = 1 - Math.exp(-6 * dt); // fast but smooth ~0.1s
          gestureZoom       = easeTo(gestureZoom,       ZOOM_SOFT_MIN,  ZOOM_SOFT_MAX,  snap);
          gestureOrbitYaw   = easeTo(gestureOrbitYaw,   -ORBIT_SOFT_RAD, ORBIT_SOFT_RAD, snap);
          gestureOrbitPitch = easeTo(gestureOrbitPitch,  -ORBIT_SOFT_RAD, ORBIT_SOFT_RAD, snap);
        }

        uniformBus.update({
          time: nowSec - startTime,
          dt,
          resolution: [canvas.width, canvas.height],
          mouse: [pointerX, pointerY],
          mouseDown: pointerDown ? 1 : 0,
          nowUtc: Date.now() / 1000,
          params: {
            treatment: ctrl.treatment,
            showRegionHelpers: ctrl.showRegionHelpers ? 1 : 0,
            showBaseFlowers: ctrl.showBaseFlowers ? 1 : 0,
            showTallFlowerVariant1: ctrl.showTallFlowerVariant1 ? 1 : 0,
            showTallFlowerVariant2: ctrl.showTallFlowerVariant2 ? 1 : 0,
            showTallFlowerVariant3: ctrl.showTallFlowerVariant3 ? 1 : 0,
            showTallFlowerVariant4: ctrl.showTallFlowerVariant4 ? 1 : 0,
          },
          overrides: ctrl.overrides,
          gestureZoom,
          gestureOrbit: [gestureOrbitYaw, gestureOrbitPitch],
        });

        const activePasses = new Set<string>();
        if (ctrl.showGarden)    activePasses.add('garden');
        if (ctrl.showBloom)     activePasses.add('bloom');
        if (ctrl.showGodrays)   activePasses.add('godrays');
        if (ctrl.showComposite) activePasses.add('composite');

        scene.update(uniformBus.state);
        scene.draw(uniformBus.state, activePasses);
      };

      animationFrameId = requestAnimationFrame(tick);

      return () => {
        canvas.removeEventListener('mousemove',  onMouseMove);
        canvas.removeEventListener('mousedown',  onMouseDown);
        window.removeEventListener('mouseup',    onMouseUp);
        canvas.removeEventListener('touchmove',  onTouchMove);
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchend',   onTouchEnd);
        canvas.removeEventListener('wheel',       onWheel);
        scene.destroy?.();
        regl.destroy();
      };
    };

    let cleanupInner: (() => void) | undefined;
    bootstrap().then((cleanup) => {
      if (disposed) { cleanup?.(); } else { cleanupInner = cleanup; }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrameId);
      cleanupInner?.();
    };
  }, []);

  return <canvas ref={canvasRef} style={canvasStyle} />;
}
