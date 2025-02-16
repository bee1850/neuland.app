import BrowserFetchConnection from './browser-fetch'

let CapacitorFetchConnection = null
let WebSocketProxyConnection = null

/**
 * Returns a suitable fetch implementation.
 * @param {string} mode Either `direct`, `capacitor` or `websocket-proxy`
 * @param {object} options Connection parameters, only used by the proxy
 * @returns An object with a `fetch` method.
 */
export default async function obtainFetchImplementation (mode, options) {
  if (mode === 'direct') {
    return new BrowserFetchConnection(options)
  } else if (mode === 'capacitor') {
    if (!CapacitorFetchConnection) {
      CapacitorFetchConnection = (await import('./capacitor-http')).default
    }
    return new CapacitorFetchConnection(options)
  } else if (mode === 'websocket-proxy') {
    if (!WebSocketProxyConnection) {
      WebSocketProxyConnection = (await import('fetch-bypass-cors')).default
    }
    return new WebSocketProxyConnection(options)
  } else {
    throw new Error(`Unknown fetch implementation: ${mode}`)
  }
}
