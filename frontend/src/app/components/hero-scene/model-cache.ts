// Revalidate model bytes on each visit so returning browsers receive new releases.
// Keep the previous bytes available when the network is unavailable.
export async function loadModelBuffer(url: string) {
  let cache: Cache | undefined;
  let previous: Response | undefined;
  try {
    cache = await caches.open('bud-models-v1');
    previous = await cache.match(url);
  } catch { /* Cache API is optional. */ }
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Model HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    try {
      await cache?.put(url, new Response(buffer.slice(0), {
        headers: { 'Content-Type': 'model/gltf-binary' },
      }));
    } catch { /* Quota or storage failures must not discard a successful fetch. */ }
    return { buffer, fromCache: !!previous };
  } catch {
    if (previous) return { buffer: await previous.arrayBuffer(), fromCache: true };
    return { buffer: null, fromCache: false };
  }
}
