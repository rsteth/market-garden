'use client';

import { useState } from 'react';
import { ShaderCanvas } from '@/components/ShaderCanvas';
import { DebugOverlay } from '@/components/DebugOverlay';
import type { CapabilityPlan } from '@/gl/capabilities';

export interface DebugInfo {
  fps: number;
  frameTime: number;
  capabilities: CapabilityPlan | null;
}

export interface Controls {
  paused: boolean;
  showGarden: boolean;
  showBloom: boolean;
  showGodrays: boolean;
  showComposite: boolean;
  treatment: number; // 0 cinematic, 1 clean
}

const INITIAL_DEBUG: DebugInfo = {
  fps: 0,
  frameTime: 0,
  capabilities: null,
};

const INITIAL_CONTROLS: Controls = {
  paused: false,
  showGarden: true,
  showBloom: true,
  showGodrays: true,
  showComposite: true,
  treatment: 0,
};

export default function Page() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>(INITIAL_DEBUG);
  const [controls, setControls] = useState<Controls>(INITIAL_CONTROLS);

  return (
    <>
      <ShaderCanvas controls={controls} onDebugInfo={setDebugInfo} />
      <DebugOverlay
        debugInfo={debugInfo}
        controls={controls}
        onControlsChange={setControls}
      />
    </>
  );
}
