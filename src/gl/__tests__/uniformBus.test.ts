import { createUniformBus } from '../uniformBus';

describe('createUniformBus', () => {
  // ---- initial state ----

  it('starts with time and dt at 0', () => {
    const bus = createUniformBus();
    expect(bus.state.time).toBe(0);
    expect(bus.state.dt).toBe(0);
  });

  it('starts with resolution [1, 1]', () => {
    const bus = createUniformBus();
    expect(bus.state.resolution).toEqual([1, 1]);
  });

  it('starts with mouse [0, 0] and mouseDown 0', () => {
    const bus = createUniformBus();
    expect(bus.state.mouse).toEqual([0, 0]);
    expect(bus.state.mouseDown).toBe(0);
  });

  it('starts with nowUtc 0', () => {
    const bus = createUniformBus();
    expect(bus.state.nowUtc).toBe(0);
  });

  it('starts with empty params', () => {
    const bus = createUniformBus();
    expect(bus.state.params).toEqual({});
  });

  // ---- partial updates ----

  it('updates time without touching other fields', () => {
    const bus = createUniformBus();
    bus.update({ time: 1.5 });
    expect(bus.state.time).toBe(1.5);
    expect(bus.state.dt).toBe(0);
    expect(bus.state.resolution).toEqual([1, 1]);
  });

  it('updates resolution without touching time', () => {
    const bus = createUniformBus();
    bus.update({ time: 5 });
    bus.update({ resolution: [800, 600] });
    expect(bus.state.resolution).toEqual([800, 600]);
    expect(bus.state.time).toBe(5);
  });

  it('updates mouse and mouseDown', () => {
    const bus = createUniformBus();
    bus.update({ mouse: [0.5, 0.7], mouseDown: 1 });
    expect(bus.state.mouse).toEqual([0.5, 0.7]);
    expect(bus.state.mouseDown).toBe(1);
  });

  it('updates nowUtc', () => {
    const bus = createUniformBus();
    bus.update({ nowUtc: 1700000000 });
    expect(bus.state.nowUtc).toBe(1700000000);
  });

  // ---- params merging ----

  it('merges params additively', () => {
    const bus = createUniformBus();
    bus.update({ params: { treatment: 0 } });
    bus.update({ params: { bloom: 1 } });
    expect(bus.state.params).toEqual({ treatment: 0, bloom: 1 });
  });

  it('overwrites existing param keys', () => {
    const bus = createUniformBus();
    bus.update({ params: { treatment: 0 } });
    bus.update({ params: { treatment: 1 } });
    expect(bus.state.params.treatment).toBe(1);
  });

  it('does not clear params when updating other fields', () => {
    const bus = createUniformBus();
    bus.update({ params: { foo: 42 } });
    bus.update({ time: 10 });
    expect(bus.state.params.foo).toBe(42);
  });

  // ---- multiple fields at once ----

  it('applies multiple fields in a single update call', () => {
    const bus = createUniformBus();
    bus.update({ time: 3, dt: 0.016, resolution: [1920, 1080] });
    expect(bus.state.time).toBe(3);
    expect(bus.state.dt).toBe(0.016);
    expect(bus.state.resolution).toEqual([1920, 1080]);
  });
});
