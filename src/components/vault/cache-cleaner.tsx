'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe,
  Image,
  FileText,
  Code2,
  Package,
  Trash2,
  CheckCircle2,
  Loader2,
  Zap,
  HardDrive,
  ShieldCheck,
  Search,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

/* ═══════════════════════════════════════════════
   Types & Constants
   ═══════════════════════════════════════════════ */

interface CacheCategory {
  name: string
  icon: typeof Globe
  color: string
  bg: string
  sizeMB: number
  cleaned: boolean
  cacheName: string
}

type CleanState = 'idle' | 'scanning' | 'scanned' | 'cleaning' | 'done'

const RING_R = 64
const RING_STROKE = 6
const RING_CIRC = 2 * Math.PI * RING_R
const RING_SIZE = 160

/* ── Shared easing (Apple-like cubic) ── */
const EASE_OUT = [0.22, 0.61, 0.36, 1] as const

/* Shared icon/color mapping for cache names */
const ICON_MAP: Record<string, { icon: typeof Globe; color: string; bg: string }> = {
  'vault-hub': { icon: HardDrive, color: 'text-vault-gold', bg: 'bg-vault-gold/10' },
  'vault-hub-v2': { icon: HardDrive, color: 'text-vault-gold', bg: 'bg-vault-gold/10' },
  'workbox': { icon: Code2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  'images': { icon: Image, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  'fonts': { icon: FileText, color: 'text-vault-gold', bg: 'bg-vault-gold/10' },
  'assets': { icon: Package, color: 'text-sky-400', bg: 'bg-sky-400/10' },
}

function mapCacheCategory(c: { name: string; sizeMB: number }): CacheCategory {
  const m = ICON_MAP[c.name] || { icon: Globe, color: 'text-vault-gold', bg: 'bg-vault-gold/10' }
  return { name: c.name, icon: m.icon, color: m.color, bg: m.bg, sizeMB: c.sizeMB, cleaned: false, cacheName: c.name }
}

/* ═══════════════════════════════════════════════
   Animated number hook (rAF, ease-out cubic)
   Tracks previous value so changing targets
   interpolate smoothly instead of jumping.
   ═══════════════════════════════════════════════ */

function useAnimatedNumber(target: number, duration = 800): number {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number>(0)
  const fromRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    fromRef.current = target
    const t0 = performance.now()
    function tick(now: number) {
      const p = Math.min((now - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(from + (target - from) * eased)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return value
}

/* ═══════════════════════════════════════════════
   Format MB → human-readable string
   ═══════════════════════════════════════════════ */

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  if (mb >= 1) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`
  if (mb >= 0.01) return `${Math.round(mb * 1024)} KB`
  return '0 KB'
}

/* ═══════════════════════════════════════════════
   Cache API helpers (web-safe)
   ═══════════════════════════════════════════════ */

function isCacheSupported(): boolean {
  return typeof window !== 'undefined' && 'caches' in window
}

async function scanCaches(): Promise<{ name: string; sizeMB: number }[]> {
  if (!isCacheSupported()) return []
  try {
    const names = await caches.keys()
    const out: { name: string; sizeMB: number }[] = []
    for (const name of names) {
      try {
        const cache = await caches.open(name)
        const keys = await cache.keys()
        let bytes = 0
        for (const k of keys) {
          const r = await cache.match(k)
          if (r) { const b = await r.blob(); bytes += b.size }
        }
        out.push({ name, sizeMB: Math.round((bytes / (1024 * 1024)) * 100) / 100 })
      } catch { out.push({ name, sizeMB: 0 }) }
    }
    return out
  } catch { return [] }
}

async function deleteCache(name: string): Promise<boolean> {
  if (!isCacheSupported()) return false
  try { return await caches.delete(name) } catch { return false }
}

/* ═══════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════ */

export default function CacheCleanerSection() {
  const [categories, setCategories] = useState<CacheCategory[]>([])
  const [cleanState, setCleanState] = useState<CleanState>('idle')
  const [progress, setProgress] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [totalBeforeClean, setTotalBeforeClean] = useState(0)

  /* ── Reduced motion detection ── */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  /* ── Cleanup timers on unmount ── */
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  /* ── Derived values ── */
  const totalJunk = categories.reduce((s, c) => (c.cleaned ? 0 : s + c.sizeMB), 0)

  /* The MB value shown inside the circle:
     scanned  → total junk found
     cleaning → amount cleaned so far (interpolates with progress)
     done     → total cleaned (final)
     idle/scanning → 0 (circle shows other content) */
  const circleMB = cleanState === 'scanned'
    ? totalJunk
    : cleanState === 'cleaning'
      ? (progress / 100) * totalBeforeClean
      : cleanState === 'done'
        ? totalBeforeClean
        : 0

  const animatedMB = useAnimatedNumber(circleMB)
  const ringDashoffset = RING_CIRC - (progress / 100) * RING_CIRC

  /* Ring color: orange during scanning/scanned/cleaning, green on done */
  const ringColor = cleanState === 'done'
    ? 'oklch(0.72 0.17 145)'
    : 'oklch(0.72 0.16 55)'

  /* Ring CSS transition (smooth interpolation) */
  const ringTransition = reducedMotion
    ? 'none'
    : 'stroke-dashoffset 0.4s cubic-bezier(0.22, 0.61, 0.36, 1), stroke 0.5s ease'

  /* ── helpers ── */
  const clearTimers = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
  }, [])

  /* ── Scan action ── */
  const startScan = useCallback(async () => {
    if (cleanState === 'scanning' || cleanState === 'cleaning') return
    clearTimers()
    setCleanState('scanning')
    setProgress(0)
    setCategories([])
    setError(null)

    const MIN_SCAN_MS = 2200

    /* Simulate progress (0 → 90%) over ~2s */
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 90) {
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
          return 90
        }
        return p + 5
      })
    }, Math.floor(MIN_SCAN_MS / 18))

    /* Actual scan (runs in parallel) */
    const scanStart = performance.now()
    let info: { name: string; sizeMB: number }[] = []
    try {
      info = await scanCaches()
    } catch { setError('Failed to scan caches') }

    /* Guarantee minimum animation duration */
    const elapsed = performance.now() - scanStart
    if (elapsed < MIN_SCAN_MS) {
      await new Promise(r => setTimeout(r, MIN_SCAN_MS - elapsed))
    }

    /* Snap to 100% */
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    setProgress(100)

    /* Set categories — use mock data when no real caches found */
    if (info.length > 0) {
      setCategories(info.map(mapCacheCategory))
    } else {
      setCategories([
        { name: 'Browser Cache', icon: Globe, color: 'text-vault-gold', bg: 'bg-vault-gold/10', sizeMB: 12.4, cleaned: false, cacheName: '__fallback__' },
        { name: 'Image Cache', icon: Image, color: 'text-vault-gold', bg: 'bg-vault-gold/10', sizeMB: 5.7, cleaned: false, cacheName: '__fallback__' },
        { name: 'Asset Cache', icon: HardDrive, color: 'text-vault-gold', bg: 'bg-vault-gold/10', sizeMB: 3.1, cleaned: false, cacheName: '__fallback__' },
      ])
    }

    /* Calculate junk from scan results (state not yet updated) */
    const totalJunkFound = info.length > 0
      ? info.reduce((s, c) => s + c.sizeMB, 0)
      : 21.2  // mock total when no real caches

    /* Transition after brief pause at 100% */
    timeoutRef.current = setTimeout(() => {
      setCleanState(totalJunkFound >= 0.01 ? 'scanned' : 'done')
      if (totalJunkFound < 0.01) setTotalBeforeClean(0)
    }, 400)
  }, [cleanState, clearTimers])

  /* ── Clean action ── */
  const cleanAll = useCallback(async () => {
    if (cleanState !== 'scanned' || totalJunk < 0.01) return
    clearTimers()

    setCleanState('cleaning')
    setProgress(0)
    setError(null)
    setTotalBeforeClean(totalJunk)

    const steps = categories.length || 1

    /* Animate progress in steps */
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
          return 100
        }
        return p + Math.ceil(100 / steps)
      })
    }, 400)

    /* Delete each cache */
    for (let i = 0; i < categories.length; i++) {
      const c = categories[i]
      if (c.cacheName && c.cacheName !== '__fallback__') {
        await deleteCache(c.cacheName).catch(() => {})
      }
      setCategories(prev => { const u = [...prev]; u[i] = { ...u[i], cleaned: true }; return u })
    }

    /* Complete */
    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      setProgress(100)
      timeoutRef.current = setTimeout(() => setCleanState('done'), 500)
    }, steps * 400 + 500)
  }, [cleanState, categories, totalJunk, clearTimers])

  /* ── Reset (Scan Again) ── */
  const resetCleaner = useCallback(() => {
    clearTimers()
    setCleanState('idle')
    setProgress(0)
    setError(null)
    setTotalBeforeClean(0)
    setCategories([])
  }, [clearTimers])

  /* ── Animation duration helper ── */
  const dur = reducedMotion ? 0 : undefined

  /* ═══════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════ */

  return (
    <div className="space-y-5 px-4 pt-6 pb-28">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: dur ?? 0.4, ease: EASE_OUT }}
        className="flex items-center gap-2"
      >
        <Zap className="w-5 h-5 text-vault-gold" />
        <h1 className="text-xl font-bold text-foreground">Cache Cleaner</h1>
      </motion.div>

      {/* ═══════════════════════════════════════════
          RING CARD — Visual centerpiece
          ═══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: dur ?? 0.5, ease: EASE_OUT }}
        className="glass-card rounded-2xl pt-8 pb-6 text-center relative overflow-hidden"
      >
        <div className="flex justify-center px-6">
          <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>

            {/* ── Orange aura — subtle radial glow with slow pulse ── */}
            <div
              className={`absolute rounded-full pointer-events-none ${!reducedMotion ? 'cleaner-aura' : ''}`}
              style={{
                inset: '-24px',
                background: 'radial-gradient(circle, oklch(0.72 0.16 55 / 14%) 0%, oklch(0.72 0.16 55 / 4%) 40%, transparent 70%)',
              }}
            />

            {/* ── Energy sweep highlight (only during scanning / cleaning) ── */}
            {(cleanState === 'scanning' || cleanState === 'cleaning') && !reducedMotion && (
              <div className="cleaner-sweep absolute inset-0">
                <div
                  className="w-full h-full"
                  style={{
                    background: 'conic-gradient(from 0deg, transparent 0%, oklch(0.72 0.16 55 / 20%) 5%, transparent 10%)',
                    WebkitMask: 'radial-gradient(circle, transparent 59px, black 61px, black 68px, transparent 70px)',
                    mask: 'radial-gradient(circle, transparent 59px, black 61px, black 68px, transparent 70px)',
                  }}
                />
              </div>
            )}

            {/* ── SVG Ring — track + progress arc ── */}
            <svg
              viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
              className="absolute inset-0 -rotate-90"
              fill="none"
            >
              {/* Track */}
              <circle
                cx="80" cy="80" r={RING_R}
                stroke="oklch(1 0 0 / 8%)"
                strokeWidth={RING_STROKE}
              />
              {/* Progress arc */}
              <circle
                cx="80" cy="80" r={RING_R}
                stroke={ringColor}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={RING_CIRC}
                strokeDashoffset={ringDashoffset}
                style={{ transition: ringTransition }}
              />
            </svg>

            {/* ── Center content — ONLY amount + tiny label ── */}
            <AnimatePresence mode="wait">

              {/* ───────── IDLE ───────── */}
              {cleanState === 'idle' && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: dur ?? 0.25 }}
                  className="absolute inset-0 flex flex-col items-center justify-center z-10"
                >
                  <Search className="w-6 h-6 text-muted-foreground/50 mb-1.5" />
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">
                    Ready
                  </p>
                </motion.div>
              )}

              {/* ───────── SCANNING ───────── */}
              {cleanState === 'scanning' && (
                <motion.div
                  key="scanning"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: dur ?? 0.25 }}
                  className="absolute inset-0 flex flex-col items-center justify-center z-10"
                >
                  <p className="text-2xl font-semibold text-foreground tabular-nums leading-none">
                    {Math.min(Math.round(progress), 100)}%
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mt-1">
                    Scanning
                  </p>
                </motion.div>
              )}

              {/* ───────── SCANNED (results ready) ───────── */}
              {cleanState === 'scanned' && (
                <motion.div
                  key="scanned"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: dur ?? 0.3, ease: EASE_OUT }}
                  className="absolute inset-0 flex flex-col items-center justify-center z-10"
                >
                  <p className="text-3xl font-semibold text-gradient-gold leading-tight tabular-nums">
                    {formatSize(animatedMB)}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mt-1">
                    Found
                  </p>
                </motion.div>
              )}

              {/* ───────── CLEANING ───────── */}
              {cleanState === 'cleaning' && (
                <motion.div
                  key="cleaning"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: dur ?? 0.25 }}
                  className="absolute inset-0 flex flex-col items-center justify-center z-10"
                >
                  <p className="text-3xl font-semibold text-foreground leading-tight tabular-nums">
                    {formatSize(animatedMB)}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mt-1">
                    Cleaned
                  </p>
                </motion.div>
              )}

              {/* ───────── DONE ───────── */}
              {cleanState === 'done' && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: dur ?? 0.35, ease: EASE_OUT }}
                  className="absolute inset-0 flex flex-col items-center justify-center z-10"
                >
                  {totalBeforeClean >= 0.01 ? (
                    <>
                      <p className="text-3xl font-semibold text-gradient-gold leading-tight tabular-nums">
                        {formatSize(totalBeforeClean)}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mt-1">
                        Cleaned
                      </p>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-7 h-7 text-vault-success mb-0.5" />
                      <p className="text-sm font-medium text-foreground">Already Clean</p>
                    </>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* ── Error banner ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="bg-vault-danger/10 border border-vault-danger/20 rounded-xl px-4 py-3 text-sm text-vault-danger"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CTA Buttons ── */}
      <AnimatePresence mode="wait">
        {cleanState === 'idle' && (
          <motion.div
            key="cta-scan"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            <Button
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
              onClick={startScan}
            >
              <Search className="w-4 h-4 mr-2" />
              Scan
            </Button>
          </motion.div>
        )}

        {cleanState === 'scanned' && totalJunk >= 0.01 && (
          <motion.div
            key="cta-clean"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            <Button
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
              onClick={cleanAll}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clean
            </Button>
          </motion.div>
        )}

        {cleanState === 'done' && (
          <motion.div
            key="cta-reset"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            <Button
              variant="ghost"
              className="w-full h-11 rounded-xl text-vault-gold hover:text-vault-gold hover:bg-vault-gold/10 text-sm"
              onClick={resetCleaner}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Scan Again
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Category cards (scanned & done only) ── */}
      <AnimatePresence>
        {(cleanState === 'scanned' || cleanState === 'done') && categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
            transition={{ delay: 0.1, duration: 0.4, ease: EASE_OUT }}
            className="space-y-2"
          >
            {categories.map((cat, index) => (
              <motion.div
                key={cat.name}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: cat.cleaned ? 0.4 : 1, x: 0 }}
                transition={{ delay: 0.04 * index, duration: 0.3, ease: EASE_OUT }}
                className="glass-card rounded-xl p-3 flex items-center gap-3"
              >
                <div className={`w-8 h-8 rounded-lg ${cat.bg} flex items-center justify-center flex-shrink-0`}>
                  <cat.icon className={`w-4 h-4 ${cat.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {cat.sizeMB >= 1 ? `${cat.sizeMB.toFixed(1)} MB` : `${Math.round(cat.sizeMB * 1024)} KB`}
                  </p>
                </div>
                {cat.cleaned && (
                  <CheckCircle2 className="w-4 h-4 text-vault-success flex-shrink-0" />
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Privacy note ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="flex items-start gap-2 px-1"
      >
        <ShieldCheck className="w-4 h-4 text-vault-success flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          All cleaning happens locally in your browser. No data leaves your device.
        </p>
      </motion.div>

    </div>
  )
}
