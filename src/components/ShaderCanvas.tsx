'use client';

import { useRef, useEffect, useState } from 'react';
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
import { perspective, lookAt, projectWorldToScreen } from '@/gl/camera';
import type { Vec3 } from '@/gl/camera';

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

const EYE: Vec3 = [0, 18, 24];
const CENTER: Vec3 = [0, 2, 0];
const UP: Vec3 = [0, 1, 0];
const FOV = 58 * Math.PI / 180;
const NEAR = 0.5;
const FAR = 120;

interface RegionHelper {
  key: string;
  label: string;
  x: number;
  y: number;
  visible: boolean;
}

function getRegionCenter(index: number): [number, number] {
  const angle = index * (2 * Math.PI / 7) + 0.3;
  const radius = 11 + 2 * Math.sin(index * 1.7);
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function computeRegionHelpers(aspect: number): RegionHelper[] {
  const view = lookAt(EYE, CENTER, UP);
  const proj = perspective(FOV, aspect, NEAR, FAR);
  const helpers: RegionHelper[] = [];

  for (let i = 0; i < 7; i++) {
    const [x, z] = getRegionCenter(i);
    const screen = projectWorldToScreen([x, 0, z], view, proj);
    helpers.push({
      key: `region-${i + 1}`,
      label: `Region ${i + 1}`,
      x: screen ? screen[0] : 0,
      y: screen ? 1 - screen[1] : 0,
      visible: !!screen,
    });
  }

  return helpers;
}

export function ShaderCanvas({ controls, onDebugInfo }: ShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [regionHelpers, setRegionHelpers] = useState<RegionHelper[]>(() => computeRegionHelpers(1));
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
      setRegionHelpers(computeRegionHelpers(initialSize.width / initialSize.height));

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
          setRegionHelpers(computeRegionHelpers(size.width / size.height));
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
          overrides: ctrl.overrides,
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

  return (
    <>
      <canvas ref={canvasRef} style={canvasStyle} />
      {controls.showRegionHelpers && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          {regionHelpers.map((helper) => (
            <div
              key={helper.key}
              style={{
                position: 'absolute',
                left: `${helper.x * 100}%`,
                top: `${helper.y * 100}%`,
                transform: 'translate(-50%, -50%)',
                display: helper.visible ? 'flex' : 'none',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '999px',
                  border: '1px solid rgba(255, 255, 255, 0.95)',
                  background: 'rgba(76, 255, 194, 0.95)',
                  boxShadow: '0 0 8px rgba(76, 255, 194, 0.75)',
                }}
              />
              <span
                style={{
                  color: '#ecfff8',
                  fontSize: 11,
                  letterSpacing: 0.3,
                  background: 'rgba(5, 20, 18, 0.72)',
                  border: '1px solid rgba(76, 255, 194, 0.45)',
                  borderRadius: 3,
                  padding: '1px 5px',
                  textTransform: 'uppercase',
                }}
              >
                {helper.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
