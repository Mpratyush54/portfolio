import { TestBed } from '@angular/core/testing';
import { ViewportService } from './viewport.service';
describe('Viewport geometry and pointer capability', () => {
  let old: PropertyDescriptor | undefined, media: Map<string, any>;
  beforeEach(() => {
    old = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    media = new Map();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => {
        const entry = {
          matches: query === '(pointer: coarse)',
          listeners: new Set<() => void>(),
          addEventListener(_type: string, cb: () => void) {
            this.listeners.add(cb);
          },
          removeEventListener(_type: string, cb: () => void) {
            this.listeners.delete(cb);
          },
        };
        media.set(query, entry);
        return entry;
      },
    });
  });
  afterEach(() => {
    if (old) Object.defineProperty(window, 'matchMedia', old);
    else Reflect.deleteProperty(window, 'matchMedia');
  });
  it('does not classify a wide touch viewport as a phone', () => {
    const v = TestBed.inject(ViewportService);
    expect(v.compact()).toBe(false);
    expect(v.coarse()).toBe(true);
  });
  it('reacts to geometry changes and removes its listeners on destroy', () => {
    const v = TestBed.inject(ViewportService),
      entry = media.get('(max-width: 900px)');
    entry.matches = true;
    entry.listeners.forEach((fn: () => void) => fn());
    expect(v.compact()).toBe(true);
    entry.matches = false;
    entry.listeners.forEach((fn: () => void) => fn());
    expect(v.compact()).toBe(false);
    TestBed.resetTestingModule();
    for (const m of media.values()) expect(m.listeners.size).toBe(0);
  });
});
