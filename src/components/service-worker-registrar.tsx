'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          // SW registered successfully
          console.log('[SW] Registered:', reg.scope)
        })
        .catch((err) => {
          // SW registration failed — non-critical for TWA
          console.warn('[SW] Registration failed:', err)
        })
    }
  }, [])

  return null
}
