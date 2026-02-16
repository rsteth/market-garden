'use client';

import type { DebugInfo, Controls } from '../../app/page';

interface DebugOverlayProps {
  debugInfo: DebugInfo;
  controls: Controls;
  onControlsChange: (next: Controls) => void;
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

export function DebugOverlay({
  debugInfo,
  controls,
  onControlsChange,
}: DebugOverlayProps) {
  const { fps, frameTime, capabilities } = debugInfo;

  const toggle = (key: keyof Controls) => {
    onControlsChange({ ...controls, [key]: !controls[key] });
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
        <span
          style={{
            color: capabilities?.floatRenderTarget ? '#6f6' : '#fa0',
          }}
        >
          {capabilities?.floatRenderTarget ? 'yes' : 'no'}
        </span>
        {' | '}tex type{' '}
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
          <input
            type="checkbox"
            checked={!controls.paused}
            onChange={() => toggle('paused')}
          />
          play
        </label>
        <label style={labelStyle}>
          <input
            type="checkbox"
            checked={controls.showSim}
            onChange={() => toggle('showSim')}
          />
          pass A (sim)
        </label>
        <label style={labelStyle}>
          <input
            type="checkbox"
            checked={controls.showComposite}
            onChange={() => toggle('showComposite')}
          />
          composite
        </label>
      </div>
    </div>
  );
}
