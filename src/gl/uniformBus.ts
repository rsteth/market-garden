export interface UniformState {
  time: number;
  dt: number;
  resolution: [number, number];
  mouse: [number, number];
  mouseDown: number;
  /** Unix epoch seconds — placeholder for syncing with wall-clock / market time */
  nowUtc: number;
  /** Generic numeric params bag — scenes can read from here freely */
  params: Record<string, number>;
}

export interface UniformBus {
  readonly state: UniformState;
  update(partial: Partial<UniformState>): void;
}

export function createUniformBus(): UniformBus {
  const state: UniformState = {
    time: 0,
    dt: 0,
    resolution: [1, 1],
    mouse: [0, 0],
    mouseDown: 0,
    nowUtc: 0,
    params: {},
  };

  return {
    state,
    update(partial) {
      if (partial.time !== undefined) state.time = partial.time;
      if (partial.dt !== undefined) state.dt = partial.dt;
      if (partial.resolution !== undefined) state.resolution = partial.resolution;
      if (partial.mouse !== undefined) state.mouse = partial.mouse;
      if (partial.mouseDown !== undefined) state.mouseDown = partial.mouseDown;
      if (partial.nowUtc !== undefined) state.nowUtc = partial.nowUtc;
      if (partial.params) Object.assign(state.params, partial.params);
    },
  };
}
