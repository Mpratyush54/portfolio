import { vi } from 'vitest';
import { loadModelBuffer } from './model-cache';

describe('Model release cache', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('replaces previously cached model bytes with the current release', async () => {
    const put = vi.fn();
    vi.stubGlobal('caches', { open: async () => ({ match: async () => new Response('old'), put }) });
    const fetcher = vi.fn(async () => new Response('new'));
    vi.stubGlobal('fetch', fetcher);
    const result = await loadModelBuffer('/models/robot.glb');
    expect(new TextDecoder().decode(result.buffer!)).toBe('new');
    expect(fetcher).toHaveBeenCalledWith('/models/robot.glb', { cache: 'no-cache' });
    expect(await put.mock.calls[0][1].text()).toBe('new');
  });
  it('uses cached bytes when offline', async () => {
    vi.stubGlobal('caches', { open: async () => ({ match: async () => new Response('offline copy') }) });
    vi.stubGlobal('fetch', async () => { throw new Error('Offline'); });
    const result = await loadModelBuffer('/models/robot.glb');
    expect(new TextDecoder().decode(result.buffer!)).toBe('offline copy');
    expect(result.fromCache).toBe(true);
  });
  it('keeps fresh bytes if the cache quota is exceeded', async () => {
    vi.stubGlobal('caches', { open: async () => ({ match: async () => undefined, put: async () => { throw new Error('Quota'); } }) });
    vi.stubGlobal('fetch', async () => new Response('new'));
    const result = await loadModelBuffer('/models/human.glb');
    expect(new TextDecoder().decode(result.buffer!)).toBe('new');
  });
});
