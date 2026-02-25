'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { DebugInfo, Controls } from '../../app/page';

interface DebugOverlayProps {
  debugInfo: DebugInfo;
  controls: Controls;
  onControlsChange: Dispatch<SetStateAction<Controls>>;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 12,
  left: 12,
  zIndex: 10,
  background: 'rgba(0, 0, 0, 0.55)',
  backdropFilter: 'blur(4px)',
  color: '#ccc',
  fontFamily: 'inherit',
  fontSize: 11,
  lineHeight: 1.6,
  padding: '8px 12px',
  borderRadius: 6,
  pointerEvents: 'auto',
  userSelect: 'none',
  minWidth: 180,
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
};

const sectionTitleStyle: React.CSSProperties = {
  color: '#888',
  marginBottom: 4,
};

const sectionWrapStyle: React.CSSProperties = {
  marginTop: 10,
  borderTop: '1px solid #444',
  paddingTop: 8,
};

const ENVIRONMENT_KEYS = [
  'windStrength',
  'gustiness',
  'fogAmount',
  'godraysIntensity',
  'dayPhase',
] as const;

const FLOWER_DATA_KEYS = [
  'bloomTarget',
  'agitation',
  'microTwitch',
  'colorSeed',
  'slowBias',
] as const;

const REGION_KEYS = [
  'region1Influence',
  'region2Influence',
  'region3Influence',
  'region4Influence',
  'region5Influence',
  'region6Influence',
  'region7Influence',
] as const;

const OVERRIDE_LABELS: Record<keyof Controls['overrides'], string> = {
  windStrength: 'wind strength',
  gustiness: 'gustiness',
  fogAmount: 'fog amount',
  godraysIntensity: 'godrays intensity',
  dayPhase: 'day phase',
  bloomTarget: 'bloom target',
  agitation: 'agitation',
  microTwitch: 'micro twitch',
  colorSeed: 'color seed',
  slowBias: 'slow bias',
  region1Influence: 'region 1',
  region2Influence: 'region 2',
  region3Influence: 'region 3',
  region4Influence: 'region 4',
  region5Influence: 'region 5',
  region6Influence: 'region 6',
  region7Influence: 'region 7',
};

export function DebugOverlay({
  debugInfo,
  controls,
  onControlsChange,
}: DebugOverlayProps) {
  const { fps, frameTime, capabilities } = debugInfo;

  const toggleBool = (key: 'paused' | 'showGarden' | 'showBloom' | 'showGodrays' | 'showComposite') => {
    onControlsChange((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const cycleTreatment = () => {
    onControlsChange((prev) => ({ ...prev, treatment: prev.treatment === 0 ? 1 : 0 }));
  };

  const setOverrideActive = (key: keyof Controls['overrides'], active: boolean) => {
    onControlsChange((prev) => {
      const entry = prev.overrides[key];
      return {
        ...prev,
        overrides: {
          ...prev.overrides,
          [key]: { ...entry, active },
        },
      };
    });
  };

  const setOverrideValue = (key: keyof Controls['overrides'], value: number) => {
    onControlsChange((prev) => {
      const entry = prev.overrides[key];
      return {
        ...prev,
        overrides: {
          ...prev.overrides,
          [key]: { ...entry, value },
        },
      };
    });
  };

  const renderOverrideRow = (key: keyof Controls['overrides']) => {
    const ctrl = controls.overrides[key];
    const isLive = ctrl.active && !controls.paused;
    const statusText = !ctrl.active ? 'off' : (controls.paused ? 'paused' : 'live');
    const statusColor = !ctrl.active ? '#666' : (controls.paused ? '#fa0' : '#6f6');
    return (
      <div key={key} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
        <input
          type="checkbox"
          checked={ctrl.active}
          onChange={(e) => setOverrideActive(key, e.target.checked)}
          style={{ marginRight: 6 }}
        />
        <div style={{ flex: 1, fontSize: 10, color: ctrl.active ? '#fff' : '#666' }}>
          {OVERRIDE_LABELS[key]}
        </div>
        <div
          style={{
            width: 44,
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            color: statusColor,
            opacity: isLive ? 1 : 0.85,
          }}
        >
          {statusText}
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={ctrl.value}
          onChange={(e) => setOverrideValue(key, parseFloat(e.target.value))}
          style={{ width: 72, opacity: ctrl.active ? 1 : 0.45 }}
        />
      </div>
    );
  };

  return (
    <div style={overlayStyle}>
      {/* Capability plan */}
      <div style={{ marginBottom: 4, color: '#888' }}>
        webgl2{' '}
        <span style={{ color: capabilities?.webgl2 ? '#6f6' : '#f66' }}>
          {capabilities?.webgl2 ? 'yes' : 'no'}
        </span>
        {' | '}float rt{' '}
        <span style={{ color: capabilities?.floatRenderTarget ? '#6f6' : '#fa0' }}>
          {capabilities?.floatRenderTarget ? 'yes' : 'no'}
        </span>
        {' | '}tex{' '}
        <span style={{ color: '#aef' }}>
          {capabilities?.textureType ?? '...'}
        </span>
      </div>

      {/* Frame time */}
      <div style={{ marginBottom: 6, color: '#aaa' }}>
        {frameTime.toFixed(1)}ms &middot; ~{fps} fps
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <label style={labelStyle}>
          <input type="checkbox" checked={!controls.paused} onChange={() => toggleBool('paused')} />
          play
        </label>
        <label style={labelStyle}>
          <input type="checkbox" checked={controls.showGarden} onChange={() => toggleBool('showGarden')} />
          garden
        </label>
        <label style={labelStyle}>
          <input type="checkbox" checked={controls.showBloom} onChange={() => toggleBool('showBloom')} />
          bloom
        </label>
        <label style={labelStyle}>
          <input type="checkbox" checked={controls.showGodrays} onChange={() => toggleBool('showGodrays')} />
          godrays
        </label>
        <label style={labelStyle}>
          <input type="checkbox" checked={controls.showComposite} onChange={() => toggleBool('showComposite')} />
          composite
        </label>
      </div>

      {/* Treatment toggle */}
      <div
        style={{ marginTop: 6, cursor: 'pointer', color: '#9cf' }}
        onClick={cycleTreatment}
      >
        treatment: {controls.treatment === 0 ? 'cinematic' : 'clean'}
      </div>

      <div style={sectionWrapStyle}>
        <div style={sectionTitleStyle}>Environment overrides</div>
        {ENVIRONMENT_KEYS.map(renderOverrideRow)}
      </div>

      <div style={sectionWrapStyle}>
        <div style={sectionTitleStyle}>Flower data overrides</div>
        {FLOWER_DATA_KEYS.map(renderOverrideRow)}
      </div>

      <div style={sectionWrapStyle}>
        <div style={sectionTitleStyle}>Regional influence overrides</div>
        {REGION_KEYS.map(renderOverrideRow)}
      </div>
    </div>
  );
}
