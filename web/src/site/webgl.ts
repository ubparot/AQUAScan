/** True when the browser can create a WebGL context (false in tests, old devices, or with WebGL turned off). */
export function webglAvailable() {
  if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}
