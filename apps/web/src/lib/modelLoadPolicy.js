/* Adaptive 3D model load policy — one source of truth for evidence + embed.
 *
 * Desktop/laptop automatically loads an appropriate approved representation.
 * Mobile and touch-primary contexts retain the explicit "Load 3D model" gate.
 * Memory and connection signals choose delivery quality independently of gating. This
 * Mobile keeps zero initial model requests. Desktop uses the reported memory
 * and connection to choose a smaller approved tier while loading automatically.
 * Fine-pointer desktop windows retain this behavior at narrow widths.
 *
 * All detectors are pure and take an injectable `env` ({ window, navigator }) so
 * they are unit-testable and SSR-safe. A React hook (`useModelLoadPolicy`) wraps
 * them and re-evaluates on viewport / pointer changes.
 */
import { useEffect, useState } from 'react'

// Administrators can flag models that need an additional iOS memory warning.
export const HIGH_RISK_OBJECT_IDS = Object.freeze(
  String(import.meta.env?.VITE_HIGH_RISK_OBJECT_IDS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean)
)
// Matches the evidence/embed mobile breakpoints already in the codebase.
export const MOBILE_MAX_WIDTH = 760
// navigator.deviceMemory is coarse (0.25..8). <= 4 GB is treated as constrained.
export const LOW_DEVICE_MEMORY_GB = 4

const NARROW_VIEWPORT_QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`
const TOUCH_PRIMARY_QUERY = '(hover: none) and (pointer: coarse)'
const DESKTOP_POINTER_QUERY = '(hover: hover) and (pointer: fine)'
const REDUCED_DATA_QUERY = '(prefers-reduced-data: reduce)'

function getWindow(env) {
  if (env && 'window' in env) {
    return env.window
  }
  return typeof window !== 'undefined' ? window : undefined
}

function getNavigator(env) {
  if (env && 'navigator' in env) {
    return env.navigator
  }
  return typeof navigator !== 'undefined' ? navigator : undefined
}

function matchMedia(env, query) {
  const win = getWindow(env)
  if (!win || typeof win.matchMedia !== 'function') {
    return false
  }
  try {
    return win.matchMedia(query).matches
  } catch {
    return false
  }
}

// Narrow viewport (the historical mobile breakpoint). Falls back to innerWidth
// when matchMedia is unavailable.
export function isNarrowViewport(env, maxWidth = MOBILE_MAX_WIDTH) {
  const win = getWindow(env)
  if (!win) {
    return false
  }
  if (typeof win.matchMedia === 'function') {
    return matchMedia(env, `(max-width: ${maxWidth}px)`)
  }
  return typeof win.innerWidth === 'number' ? win.innerWidth <= maxWidth : false
}

// Touch-primary device: no hover + coarse pointer. A touchscreen laptop still
// reports (hover: hover) for its mouse, so this stays false there — laptops
// auto-load.
export function isTouchPrimary(env) {
  return matchMedia(env, TOUCH_PRIMARY_QUERY)
}

export function isDesktopPointer(env) {
  return matchMedia(env, DESKTOP_POINTER_QUERY)
}

export function isMobileClient(env) {
  const nav = getNavigator(env)
  return Boolean(nav?.userAgentData?.mobile || /Android|iPhone|iPad|iPod|Mobile/i.test(nav?.userAgent || ''))
}

export function hasSlowConnection(env) {
  const nav = getNavigator(env)
  const connection = nav && (nav.connection || nav.mozConnection || nav.webkitConnection)
  return Boolean(connection && (
    ['slow-2g', '2g', '3g'].includes(connection.effectiveType)
    || (connection.downlink > 0 && connection.downlink < 2)
    || connection.rtt >= 600
  ))
}

// iOS / iPadOS (incl. iPadOS 13+ that masquerades as Macintosh). All iOS
// browsers are WebKit, so the memory risk is not Safari-specific; we gate all
// iOS.
export function isIOS(env) {
  const nav = getNavigator(env)
  if (!nav) {
    return false
  }
  const ua = nav.userAgent || ''
  if (/iP(hone|ad|od)/.test(ua)) {
    return true
  }
  const maxTouchPoints = typeof nav.maxTouchPoints === 'number' ? nav.maxTouchPoints : 0
  return /Macintosh/.test(ua) && maxTouchPoints > 1
}

export function isLowMemoryDevice(env) {
  const nav = getNavigator(env)
  const memory = nav && typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null
  return typeof memory === 'number' && memory > 0 && memory <= LOW_DEVICE_MEMORY_GB
}

// Data Saver via Network Information API, or the prefers-reduced-data media
// feature where supported.
export function prefersReducedData(env) {
  const nav = getNavigator(env)
  const connection = nav && (nav.connection || nav.mozConnection || nav.webkitConnection)
  if (connection && typeof connection.saveData === 'boolean' && connection.saveData) {
    return true
  }
  return matchMedia(env, REDUCED_DATA_QUERY)
}

// Are we rendered inside an iframe at all?
export function isFramed(env) {
  const win = getWindow(env)
  if (!win) {
    return false
  }
  try {
    return win.self !== win.top
  } catch {
    // Cross-origin access to window.top throws — that only happens when framed.
    return true
  }
}

// A "constrained" iframe is framed AND small/touch — a homepage hero embed on a
// phone, not a full-width desktop iframe (which should still auto-load).
export function isConstrainedIframe(env) {
  return isFramed(env) && (isNarrowViewport(env) || isTouchPrimary(env))
}

export function isHighRiskObject(objectId, highRiskObjectIds = HIGH_RISK_OBJECT_IDS) {
  return (
    typeof objectId === 'string'
    && highRiskObjectIds.some(id => id.trim().toLowerCase() === objectId.trim().toLowerCase())
  )
}

/**
 * The single load decision used by evidence + embed.
 * @returns {{
 *   autoLoad: boolean, gated: boolean, constrained: boolean, highRisk: boolean, reasons: string[],
 *   device: object
 * }}
 */
export function evaluateModelLoadPolicy({ objectId = '', env, highRiskObjectIds = HIGH_RISK_OBJECT_IDS } = {}) {
  const device = {
    ios: isIOS(env),
    narrowViewport: isNarrowViewport(env),
    touchPrimary: isTouchPrimary(env),
    lowMemory: isLowMemoryDevice(env),
    saveData: prefersReducedData(env),
    constrainedIframe: isConstrainedIframe(env),
    desktopPointer: isDesktopPointer(env),
    mobileClient: isMobileClient(env),
    slowConnection: hasSlowConnection(env),
  }
  const desktop = device.desktopPointer && !device.mobileClient && !device.ios
  const gated = device.mobileClient || device.ios || device.touchPrimary
    || (!desktop && (device.narrowViewport || device.constrainedIframe))

  const reasons = []
  if (device.narrowViewport && !desktop) reasons.push('narrow-viewport')
  if (device.touchPrimary) reasons.push('touch-primary')
  if (device.ios) reasons.push('ios')
  if (device.lowMemory) reasons.push('low-device-memory')
  if (device.saveData) reasons.push('save-data')
  if (device.constrainedIframe) reasons.push('constrained-iframe')

  if (device.mobileClient) reasons.push('mobile-client')
  if (device.slowConnection) reasons.push('slow-connection')
  return {
    autoLoad: !gated,
    gated,
    constrained: gated || device.lowMemory || device.saveData || device.slowConnection,
    // High-risk treatment (stronger warning) applies on iOS for the flagged
    // objects; it never auto-loads regardless.
    highRisk: gated && device.ios && isHighRiskObject(objectId, highRiskObjectIds),
    reasons,
    device,
  }
}

/**
 * React hook: the live load decision, re-evaluated when viewport / pointer /
 * data-preference media queries change. Static signals (iOS, deviceMemory,
 * iframe) are read on each evaluation but don't change within a session.
 */
export function useModelLoadPolicy(objectId = '') {
  const [policy, setPolicy] = useState(() => evaluateModelLoadPolicy({ objectId }))

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setPolicy(evaluateModelLoadPolicy({ objectId }))
      return undefined
    }

    const queries = [NARROW_VIEWPORT_QUERY, TOUCH_PRIMARY_QUERY, DESKTOP_POINTER_QUERY, REDUCED_DATA_QUERY]
      .map((query) => {
        try {
          return window.matchMedia(query)
        } catch {
          return null
        }
      })
      .filter(Boolean)

    const reevaluate = () => setPolicy(evaluateModelLoadPolicy({ objectId }))
    reevaluate()

    const cleanups = queries.map((mql) => {
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', reevaluate)
        return () => mql.removeEventListener('change', reevaluate)
      }
      mql.addListener(reevaluate)
      return () => mql.removeListener(reevaluate)
    })

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    connection?.addEventListener?.('change', reevaluate)
    return () => { cleanups.forEach((cleanup) => cleanup()); connection?.removeEventListener?.('change', reevaluate) }
  }, [objectId])

  return policy
}
