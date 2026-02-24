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
      applyCanvasSize(canvas, initialSize);

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

      const onMouseMove  = (e: MouseEvent) => updatePointer(e.clientX, e.clientY);
      const onMouseDown  = (e: MouseEvent) => { pointerDown = true; updatePointer(e.clientX, e.clientY); };
      const onMouseUp    = () => { pointerDown = false; };
      const onTouchMove  = (e: TouchEvent) => { e.preventDefault(); if (e.touches[0]) updatePointer(e.touches[0].clientX, e.touches[0].clientY); };
      const onTouchStart = (e: TouchEvent) => { pointerDown = true; if (e.touches[0]) updatePointer(e.touches[0].clientX, e.touches[0].clientY); };
      const onTouchEnd   = () => { pointerDown = false; };

      canvas.addEventListener('mousemove',  onMouseMove);
      canvas.addEventListener('mousedown',  onMouseDown);
      window.addEventListener('mouseup',    onMouseUp);
      canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
      canvas.addEventListener('touchstart', onTouchStart, { passive: false });
      canvas.addEventListener('touchend',   onTouchEnd);

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

        uniformBus.update({
          time: nowSec - startTime,
          dt,
          resolution: [canvas.width, canvas.height],
          mouse: [pointerX, pointerY],
          mouseDown: pointerDown ? 1 : 0,
          nowUtc: Date.now() / 1000,
          params: { treatment: ctrl.treatment },
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
