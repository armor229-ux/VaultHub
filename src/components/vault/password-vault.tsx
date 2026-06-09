'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  KeyRound,
  Copy,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Zap,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'

/* ── Character sets ── */
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
const NUMBERS = '0123456789'
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?'
const AMBIGUOUS_CHARS = new Set(['O', '0', 'o', 'I', 'l', '1'])

/* ── Strength calculator (entropy-based) ── */
function generatePasswordString(length: number, charset: string): string {
  const array = new Uint32Array(length)
  crypto.getRandomValues(array)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += charset[array[i] % charset.length]
  }
  return result
}

function buildCharset(opts: { uppercase: boolean; lowercase: boolean; numbers: boolean; symbols: boolean; excludeAmbiguous: boolean }) {
  let charset = ''
  if (opts.uppercase) charset += UPPERCASE
  if (opts.lowercase) charset += LOWERCASE
  if (opts.numbers) charset += NUMBERS
  if (opts.symbols) charset += SYMBOLS
  if (opts.excludeAmbiguous) {
    charset = charset.split('').filter(c => !AMBIGUOUS_CHARS.has(c)).join('')
  }
  return charset
}

function getStrength(length: number, charsetSize: number) {
  if (charsetSize === 0) return { label: 'None', color: 'text-muted-foreground', bars: 0 }
  const entropy = length * Math.log2(charsetSize)
  if (entropy >= 75) return { label: 'Strong', color: 'text-vault-success', bars: 4 }
  if (entropy >= 50) return { label: 'Medium', color: 'text-vault-warning', bars: 3 }
  if (entropy >= 30) return { label: 'Fair', color: 'text-amber-400', bars: 2 }
  return { label: 'Weak', color: 'text-vault-danger', bars: 1 }
}

/* ── Toggle item ── */
interface ToggleItemProps {
  label: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
}

function ToggleItem({ label, checked, onCheckedChange, disabled }: ToggleItemProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className={`text-sm transition-colors ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>
        {label}
      </span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  )
}

/* ── Main component ── */
export default function PasswordGeneratorSection() {
  const [length, setLength] = useState(16)
  const [uppercase, setUppercase] = useState(true)
  const [lowercase, setLowercase] = useState(true)
  const [numbers, setNumbers] = useState(true)
  const [symbols, setSymbols] = useState(false)
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false)
  const [password, setPassword] = useState(() => {
    try {
      return generatePasswordString(16, buildCharset({ uppercase: true, lowercase: true, numbers: true, symbols: false, excludeAmbiguous: false }))
    } catch {
      return ''
    }
  })
  const [copied, setCopied] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [generated, setGenerated] = useState(true)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(null), 2000)
  }, [])

  const anyToggleOn = uppercase || lowercase || numbers || symbols

  // Calculate effective charset size
  const charsetSize = useMemo(() => {
    let chars = ''
    if (uppercase) chars += UPPERCASE
    if (lowercase) chars += LOWERCASE
    if (numbers) chars += NUMBERS
    if (symbols) chars += SYMBOLS
    if (excludeAmbiguous) {
      chars = chars.split('').filter(c => !AMBIGUOUS_CHARS.has(c)).join('')
    }
    return chars.length
  }, [uppercase, lowercase, numbers, symbols, excludeAmbiguous])

  const strength = useMemo(() => getStrength(length, charsetSize), [length, charsetSize])

  /* ── Generate password using crypto.getRandomValues ── */
  const generate = useCallback(() => {
    if (!anyToggleOn) return

    const charset = buildCharset({ uppercase, lowercase, numbers, symbols, excludeAmbiguous })
    if (!charset) return

    const result = generatePasswordString(length, charset)
    setPassword(result)
    setGenerated(true)
    setCopied(false)
  }, [length, uppercase, lowercase, numbers, symbols, excludeAmbiguous, anyToggleOn])

  /* ── Copy to clipboard ── */
  const handleCopy = useCallback(async () => {
    if (!password) return
    try {
      await navigator.clipboard.writeText(password)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = password
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    showToast('Copied to clipboard!')
    setTimeout(() => setCopied(false), 1500)
  }, [password, showToast])



  return (
    <div className="space-y-5 px-4 pt-6 pb-28 relative">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2"
      >
        <div className="relative">
          <KeyRound className="w-5 h-5 text-vault-gold" />
          <ShieldCheck className="w-3 h-3 text-vault-gold absolute -top-1 -right-1" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Password Generator</h1>
      </motion.div>

      {/* ── Password Output Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="glass-card rounded-2xl p-5 relative overflow-hidden"
      >
        {/* Password display */}
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-vault-surface rounded-xl px-4 py-3 min-h-[52px] flex items-center">
            {generated && password ? (
              <p className="text-sm font-mono text-foreground break-all leading-relaxed select-all">
                {password}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Tap Generate to create a password
              </p>
            )}
          </div>
        </div>

        {/* Action buttons row */}
        <div className="flex items-center gap-2 mt-3">
          <Button
            className="flex-1 h-11 rounded-xl bg-vault-gold text-background font-semibold glow-gold hover:bg-vault-gold/90"
            onClick={generate}
            disabled={!anyToggleOn}
          >
            <Zap className="w-4 h-4 mr-2" />
            Generate
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-xl border-border text-muted-foreground hover:text-vault-gold hover:border-vault-gold/40"
            onClick={() => { generate() }}
            disabled={!anyToggleOn || !password}
          >
            <RefreshCw className={`w-4 h-4 ${password ? 'hover:rotate-180 transition-transform' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-xl border-border text-muted-foreground hover:text-vault-gold hover:border-vault-gold/40"
            onClick={handleCopy}
            disabled={!password}
          >
            {copied ? (
              <CheckCircle2 className="w-4 h-4 text-vault-success" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* No toggles warning */}
        {!anyToggleOn && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 mt-3 bg-vault-danger/10 border border-vault-danger/20 rounded-lg px-3 py-2"
          >
            <AlertTriangle className="w-4 h-4 text-vault-danger flex-shrink-0 mt-0.5" />
            <p className="text-xs text-vault-danger">
              Select at least one character type to generate a password.
            </p>
          </motion.div>
        )}

        {/* Strength indicator */}
        {anyToggleOn && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Strength</span>
              <span className={`text-xs font-semibold ${strength.color}`}>
                {strength.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 4 }, (_, i) => (
                <motion.div
                  key={i}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.1 + i * 0.05, duration: 0.3 }}
                  className={`h-1.5 flex-1 rounded-full origin-left ${
                    i < strength.bars
                      ? strength.color === 'text-vault-success'
                        ? 'bg-vault-success'
                        : strength.color === 'text-vault-warning'
                        ? 'bg-vault-warning'
                        : strength.color === 'text-amber-400'
                        ? 'bg-amber-400'
                        : 'bg-vault-danger'
                      : 'bg-border'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Length Slider ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        className="glass-card rounded-xl p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Password Length</span>
          <span className="text-sm font-bold text-vault-gold tabular-nums min-w-[28px] text-right">{length}</span>
        </div>
        <Slider
          value={[length]}
          onValueChange={(v) => setLength(v[0])}
          min={6}
          max={64}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>6</span>
          <span>64</span>
        </div>
      </motion.div>

      {/* ── Character Options ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card rounded-xl p-4 space-y-1"
      >
        <p className="text-sm font-medium text-foreground mb-1">Character Types</p>

        <ToggleItem
          label="Uppercase (A-Z)"
          checked={uppercase}
          onCheckedChange={setUppercase}
        />
        <div className="border-t border-border/50" />

        <ToggleItem
          label="Lowercase (a-z)"
          checked={lowercase}
          onCheckedChange={setLowercase}
        />
        <div className="border-t border-border/50" />

        <ToggleItem
          label="Numbers (0-9)"
          checked={numbers}
          onCheckedChange={setNumbers}
        />
        <div className="border-t border-border/50" />

        <ToggleItem
          label="Symbols (!@#$%...)"
          checked={symbols}
          onCheckedChange={setSymbols}
        />
        <div className="border-t border-border/50" />

        <ToggleItem
          label="Exclude Ambiguous (O, 0, l, 1, I)"
          checked={excludeAmbiguous}
          onCheckedChange={setExcludeAmbiguous}
        />
      </motion.div>

      {/* ── Info footer ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="flex items-start gap-2 px-1"
      >
        <ShieldCheck className="w-4 h-4 text-vault-success flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Passwords are generated locally using <span className="text-foreground/70">crypto.getRandomValues()</span> and never leave your device.
        </p>
      </motion.div>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 bg-vault-surface border border-border rounded-full px-4 py-2 flex items-center gap-2 shadow-lg"
          >
            <CheckCircle2 className="w-4 h-4 text-vault-success" />
            <span className="text-xs font-medium text-foreground">{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
