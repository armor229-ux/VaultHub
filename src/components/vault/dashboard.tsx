'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  Trash2,
  FolderOpen,
  KeyRound,
  PlayCircle,
  HardDrive,
  Activity,
  Battery,
  Cpu,
  Clock,
} from 'lucide-react'

interface DashboardSectionProps {
  onNavigate?: (tab: string) => void
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 0.61, 0.36, 1] as const } },
}

const quickActions = [
  { label: 'Cache Cleaner', icon: Trash2, color: 'text-vault-gold', bg: 'bg-vault-gold/10', tab: 'cleaner' },
  { label: 'File Explorer', icon: FolderOpen, color: 'text-vault-gold', bg: 'bg-vault-gold/10', tab: 'files' },
  { label: 'Password Gen', icon: KeyRound, color: 'text-vault-gold', bg: 'bg-vault-gold/10', tab: 'vault' },
  { label: 'Media', icon: PlayCircle, color: 'text-vault-gold', bg: 'bg-vault-gold/10', tab: 'media' },
]

interface ActivityItem {
  text: string
  detail: string
  time: string
  icon: typeof Trash2
  color: string
}

export default function DashboardSection({ onNavigate }: DashboardSectionProps) {
  const [storagePercent, setStoragePercent] = useState(35)
  const [usedStorage, setUsedStorage] = useState('45.2')
  const [totalStorage, setTotalStorage] = useState('128')
  const [memoryPercent, setMemoryPercent] = useState(67)
  const [batteryPercent, setBatteryPercent] = useState(85)
  const [activities, setActivities] = useState<ActivityItem[]>([
    { text: 'Cache cleaned', detail: '1.2 GB freed', time: '2 min ago', icon: Trash2, color: 'text-vault-gold' },
    { text: 'Password added', detail: 'Bank of America', time: '1 hour ago', icon: KeyRound, color: 'text-vault-gold' },
    { text: 'Screenshot saved', detail: 'Pictures folder', time: '3 hours ago', icon: PlayCircle, color: 'text-vault-gold' },
    { text: 'System scan complete', detail: 'No threats found', time: '5 hours ago', icon: Activity, color: 'text-vault-gold' },
  ])
  const [statsLoading, setStatsLoading] = useState(true)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    // Fetch system stats from API
    fetch('/api/system-stats')
      .then((res) => res.json())
      .then((data) => {
        if (data?.storage) {
          setStoragePercent(data.storage.percentage)
          setUsedStorage(String(data.storage.used))
          setTotalStorage(String(data.storage.total))
        }
        if (data?.memory) {
          setMemoryPercent(data.memory.percentage)
        }
        if (data?.battery) {
          setBatteryPercent(data.battery.level)
        }
      })
      .catch(() => {
        // API unavailable — keep defaults
      })
      .finally(() => setStatsLoading(false))

    // Fetch recent activities from API
    fetch('/api/activities')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const iconMap: Record<string, { icon: typeof Trash2; color: string }> = {
            'cache_cleaned': { icon: Trash2, color: 'text-vault-gold' },
            'password_added': { icon: KeyRound, color: 'text-vault-gold' },
            'file_opened': { icon: FolderOpen, color: 'text-vault-gold' },
            'scan_complete': { icon: Activity, color: 'text-vault-gold' },
            'media_played': { icon: PlayCircle, color: 'text-vault-gold' },
          }
          const mapped: ActivityItem[] = data.slice(0, 5).map((a: { action: string; detail: string; createdAt: string }) => {
            const mapping = iconMap[a.action] || { icon: Activity, color: 'text-vault-gold' }
            const date = new Date(a.createdAt)
            const now = new Date()
            const diffMs = now.getTime() - date.getTime()
            const diffMin = Math.floor(diffMs / 60000)
            let time = 'Just now'
            if (diffMin >= 60) {
              const hours = Math.floor(diffMin / 60)
              time = `${hours}h ago`
            } else if (diffMin >= 1) {
              time = `${diffMin}m ago`
            }
            return {
              text: a.action.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
              detail: a.detail || '—',
              time,
              icon: mapping.icon,
              color: mapping.color,
            }
          })
          setActivities(mapped)
        }
      })
      .catch(() => {
        // API unavailable — keep defaults
      })
  }, [])

  const handleQuickAction = useCallback(
    (tab: string) => {
      onNavigate?.(tab)
    },
    [onNavigate]
  )

  const circumference = 2 * Math.PI * 40
  const strokeDashoffset = circumference - (storagePercent / 100) * circumference

  const systemHealth = [
    { label: 'Memory', value: memoryPercent, color: 'text-vault-gold', barColor: 'bg-vault-gold', icon: Cpu },
    { label: 'Battery', value: batteryPercent, color: 'text-vault-success', barColor: 'bg-vault-success', icon: Battery },
    { label: 'Storage', value: storagePercent, color: 'text-vault-gold', barColor: 'bg-vault-gold', icon: HardDrive },
  ]

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 px-4 pt-6 pb-28"
    >
      {/* Welcome — logo */}
      <motion.div variants={item} className="flex flex-col items-center gap-2 pt-2">
        <Image
          src="/vault-logo.png"
          alt="Vault Hub"
          width={180}
          height={62}
          className="h-12 w-auto object-contain"
          priority
        />
        <p className="text-sm text-muted-foreground">Your Premium Device Suite</p>
      </motion.div>

      {/* Storage Usage Card */}
      <motion.div variants={item} className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                strokeWidth="6"
                className="stroke-border"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                className="stroke-vault-gold"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{
                  transition: 'stroke-dashoffset 1.5s ease-out',
                }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-foreground">{storagePercent}%</span>
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-sm font-medium text-muted-foreground">Storage Usage</h3>
            <p className="text-xl font-semibold text-foreground">
              {usedStorage} GB <span className="text-sm text-muted-foreground font-normal">/ {totalStorage} GB</span>
            </p>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-vault-gold" />
                <span className="text-xs text-muted-foreground">Used {usedStorage} GB</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-border" />
                <span className="text-xs text-muted-foreground">
                  Free {((parseFloat(totalStorage) || 0) - (parseFloat(usedStorage) || 0)).toFixed(1)} GB
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions Grid */}
      <motion.div variants={item}>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <motion.button
              key={action.label}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleQuickAction(action.tab)}
              className="glass-card rounded-xl p-4 flex flex-col items-center gap-3 cursor-pointer hover:glow-gold-subtle transition-shadow text-left"
              aria-label={`Navigate to ${action.label}`}
            >
              <div className={`w-12 h-12 rounded-xl ${action.bg} flex items-center justify-center`}>
                <action.icon className={`w-6 h-6 ${action.color}`} />
              </div>
              <span className="text-sm font-medium text-foreground">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* System Health Card */}
      <motion.div variants={item} className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-vault-gold" />
          <h2 className="text-sm font-medium text-foreground">System Health</h2>
        </div>
        <div className="space-y-4">
          {systemHealth.map((stat) => (
            <div key={stat.label} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                </div>
                <span className={`text-sm font-semibold ${stat.color}`}>{stat.value}%</span>
              </div>
              <div className="h-2 rounded-full bg-border overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${stat.barColor}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${stat.value}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.5 }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div variants={item} className="glass-card rounded-xl p-5">
        <h2 className="text-sm font-medium text-foreground mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
          ) : (
            activities.map((activity, index) => (
              <motion.div
                key={`${activity.text}-${index}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + index * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-vault-surface flex items-center justify-center flex-shrink-0">
                  <activity.icon className={`w-4 h-4 ${activity.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{activity.text}</p>
                  <p className="text-xs text-muted-foreground truncate">{activity.detail}</p>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  <span className="text-xs">{activity.time}</span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
