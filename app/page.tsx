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

export interface OverrideControl {
  active: boolean;
  value: number;
}

export interface Controls {
  paused: boolean;
  showGarden: boolean;
  showBloom: boolean;
  showGodrays: boolean;
  showComposite: boolean;
  showRegionHelpers: boolean;
  showBaseFlowers: boolean;
  showTallFlowerVariant1: boolean;
  showTallFlowerVariant2: boolean;
  showTallFlowerVariant3: boolean;
  showTallFlowerVariant4: boolean;
  treatment: number; // 0 cinematic, 1 clean
  overrides: {
    windStrength: OverrideControl;
    gustiness: OverrideControl;
    fogAmount: OverrideControl;
    godraysIntensity: OverrideControl;
    dayPhase: OverrideControl;
    bloomTarget: OverrideControl;
    agitation: OverrideControl;
    microTwitch: OverrideControl;
    colorSeed: OverrideControl;
    slowBias: OverrideControl;
    region1Influence: OverrideControl;
    region2Influence: OverrideControl;
    region3Influence: OverrideControl;
    region4Influence: OverrideControl;
    region5Influence: OverrideControl;
    region6Influence: OverrideControl;
    region7Influence: OverrideControl;
  };
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
  showRegionHelpers: false,
  showBaseFlowers: true,
  showTallFlowerVariant1: true,
  showTallFlowerVariant2: true,
  showTallFlowerVariant3: true,
  showTallFlowerVariant4: true,
  treatment: 0,
  overrides: {
    windStrength: { active: false, value: 0.3 },
    gustiness:    { active: false, value: 0.1 },
    fogAmount:    { active: false, value: 0.2 },
    godraysIntensity: { active: false, value: 0.3 },
    dayPhase:     { active: false, value: 0.5 },
    bloomTarget:  { active: false, value: 0.5 },
    agitation:    { active: false, value: 0.5 },
    microTwitch:  { active: false, value: 0.5 },
    colorSeed:    { active: false, value: 0.5 },
    slowBias:     { active: false, value: 0.5 },
    region1Influence: { active: false, value: 1.0 },
    region2Influence: { active: false, value: 1.0 },
    region3Influence: { active: false, value: 1.0 },
    region4Influence: { active: false, value: 1.0 },
    region5Influence: { active: false, value: 1.0 },
    region6Influence: { active: false, value: 1.0 },
    region7Influence: { active: false, value: 1.0 },
  },
};

export default function Page() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>(INITIAL_DEBUG);
  const [controls, setControls] = useState<Controls>(INITIAL_CONTROLS);
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  const normalizedControls: Controls = {
    ...INITIAL_CONTROLS,
    ...controls,
    overrides: {
      ...INITIAL_CONTROLS.overrides,
      ...controls.overrides,
    },
  };

  return (
    <>
      <ShaderCanvas controls={normalizedControls} onDebugInfo={setDebugInfo} />
      {showDebugOverlay ? (
        <DebugOverlay
          debugInfo={debugInfo}
          controls={normalizedControls}
          onControlsChange={setControls}
          onHide={() => setShowDebugOverlay(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowDebugOverlay(true)}
          style={{
            position: 'fixed',
            top: 12,
            left: 12,
            zIndex: 10,
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid #444',
            background: 'rgba(0, 0, 0, 0.55)',
            color: '#ccc',
            fontSize: 11,
            lineHeight: 1,
            cursor: 'pointer',
          }}
        >
          Show dashboard
        </button>
      )}
    </>
  );
}
