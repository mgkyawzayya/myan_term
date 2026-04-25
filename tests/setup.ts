// Polyfill OffscreenCanvas / createImageBitmap for jsdom — these are not
// required for unit tests but the shape cache references them at module init.

const g = globalThis as Record<string, unknown>;

g.IS_REACT_ACT_ENVIRONMENT = true;

if (typeof g.OffscreenCanvas === 'undefined') {
  g.OffscreenCanvas = class {
    width: number;
    height: number;
    constructor(w: number, h: number) {
      this.width = w;
      this.height = h;
    }
    getContext(): null {
      return null;
    }
  };
}

if (typeof g.requestAnimationFrame === 'undefined') {
  g.requestAnimationFrame = (cb: FrameRequestCallback): number =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  g.cancelAnimationFrame = (id: number): void => clearTimeout(id);
}
