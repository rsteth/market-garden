'use client';

import { useRef, useEffect } from 'react';
import type { DebugInfo, Controls } from '../../app/page';
import { checkCapabilities } from '@/gl/capabilities';
import type { CapabilityPlan } from '@/gl/capabilities';
import { initRegl } from '@/gl/createRegl';
import { computeCanvasSize, applyCanvasSize } from '@/gl/resize';
import { createPingPongFBO } from '@/gl/fbo';
import { createUniformBus } from '@/gl/uniformBus';
import type { RenderResources } from '@/gl/passes/types';
import { createSmokeTestScene } from '@/scenes/smokeTest';

interface ShaderCanvasProps {
  controls: Controls;
  onDebugInfo: (info: DebugInfo) => void;
}

const canvasStyle: React.CSSProperties = {
  display: 'block',
  width: '100vw',
  height: '100vh',
  touchAction: 'none', // prevent browser gestures on canvas
};

const MAX_DT = 1 / 15; // clamp delta-time to ~66 ms to survive tab-switches

export function ShaderCanvas({ controls, onDebugInfo }: ShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Keep controls in a ref so the RAF loop always sees the latest values
  // without needing to restart the effect.
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
      // ---- regl + capabilities ----
      const { regl, gl } = await initRegl(canvas);
      if (disposed) { regl.destroy(); return; }

      const capabilities: CapabilityPlan = checkCapabilities(gl);

      // ---- initial sizing ----
      const initialSize = computeCanvasSize(canvas);
      applyCanvasSize(canvas, initialSize);

      // ---- shared resources ----
      const pingPong = createPingPongFBO(
        regl,
        initialSize.width,
        initialSize.height,
        capabilities,
      );

      // Placeholder 2x2 data texture — swap for 2x8 market texture later.
      const dataTexture = regl.texture({
        width: 2,
        height: 2,
        data: new Float32Array(2 * 2 * 4),
        type: capabilities.textureType as 'float' | 'half float' | 'uint8',
        format: 'rgba',
        min: 'nearest',
        mag: 'nearest',
        wrap: 'clamp',
      });

      const resources: RenderResources = { pingPong, dataTexture, capabilities };

      // ---- scene ----
      const scene = createSmokeTestScene();
      scene.init(regl, resources);

      // ---- uniform bus ----
      const uniformBus = createUniformBus();

      // ---- pointer state ----
      let pointerX = 0;
      let pointerY = 0;
      let pointerDown = false;

      const updatePointer = (clientX: number, clientY: number) => {
        const rect = canvas.getBoundingClientRect();
        pointerX = (clientX - rect.left) / rect.width;
        pointerY = 1.0 - (clientY - rect.top) / rect.height;
      };

      const onMouseMove = (e: MouseEvent) => updatePointer(e.clientX, e.clientY);
      const onMouseDown = (e: MouseEvent) => { pointerDown = true; updatePointer(e.clientX, e.clientY); };
      const onMouseUp = () => { pointerDown = false; };
      const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        if (e.touches[0]) updatePointer(e.touches[0].clientX, e.touches[0].clientY);
      };
      const onTouchStart = (e: TouchEvent) => {
        pointerDown = true;
        if (e.touches[0]) updatePointer(e.touches[0].clientX, e.touches[0].clientY);
      };
      const onTouchEnd = () => { pointerDown = false; };

      canvas.addEventListener('mousemove', onMouseMove);
      canvas.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mouseup', onMouseUp);
      canvas.addEventListener('touchmove', onTouchMove, { passive: false });
      canvas.addEventListener('touchstart', onTouchStart, { passive: false });
      canvas.addEventListener('touchend', onTouchEnd);

      // ---- timing ----
      const startTime = performance.now() / 1000;
      let lastTime = startTime;
      let frameCount = 0;
      let fpsAccumTime = 0;
      let lastReportedFps = 0;
      let lastReportedFrameTime = 0;

      // Report initial capabilities immediately
      onDebugInfoRef.current({
        fps: 0,
        frameTime: 0,
        capabilities,
      });

      // ---- animation loop ----
      const tick = (nowMs: number) => {
        if (disposed) return;
        animationFrameId = requestAnimationFrame(tick);

        const nowSec = nowMs / 1000;
        const rawDt = nowSec - lastTime;
        const dt = Math.min(rawDt, MAX_DT);
        lastTime = nowSec;

        // FPS bookkeeping
        frameCount++;
        fpsAccumTime += rawDt;
        if (fpsAccumTime >= 1) {
          lastReportedFps = Math.round(frameCount / fpsAccumTime);
          lastReportedFrameTime = (fpsAccumTime / frameCount) * 1000;
          frameCount = 0;
          fpsAccumTime = 0;
          onDebugInfoRef.current({
            fps: lastReportedFps,
            frameTime: lastReportedFrameTime,
            capabilities,
          });
        }

        // Resize check (every frame is cheap)
        const size = computeCanvasSize(canvas);
        if (applyCanvasSize(canvas, size)) {
          regl.poll();
          pingPong.resize(size.width, size.height);
        }

        const ctrl = controlsRef.current;
        if (ctrl.paused) return;

        // Update uniform bus
        uniformBus.update({
          time: nowSec - startTime,
          dt,
          resolution: [canvas.width, canvas.height],
          mouse: [pointerX, pointerY],
          mouseDown: pointerDown ? 1 : 0,
          nowUtc: Date.now() / 1000,
        });

        // Build active-passes set from controls
        const activePasses = new Set<string>();
        if (ctrl.showSim) activePasses.add('sim');
        if (ctrl.showComposite) activePasses.add('composite');

        scene.update(uniformBus.state);
        scene.draw(uniformBus.state, activePasses);
      };

      animationFrameId = requestAnimationFrame(tick);

      // Store cleanup refs for the dispose closure
      return () => {
        canvas.removeEventListener('mousemove', onMouseMove);
        canvas.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mouseup', onMouseUp);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchend', onTouchEnd);
        scene.destroy?.();
        regl.destroy();
      };
    };

    let cleanupInner: (() => void) | undefined;

    bootstrap().then((cleanup) => {
      if (disposed) {
        cleanup?.();
      } else {
        cleanupInner = cleanup;
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrameId);
      cleanupInner?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={canvasRef} style={canvasStyle} />;
}
