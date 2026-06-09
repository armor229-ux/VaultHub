'use client'

import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Trash2,
  FolderOpen,
  KeyRound,
  PlayCircle,
} from 'lucide-react'

interface BottomNavProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const navItems = [
  { id: 'home', label: 'Home', icon: LayoutDashboard },
  { id: 'cleaner', label: 'Cleaner', icon: Trash2 },
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'vault', label: 'Password', icon: KeyRound },
  { id: 'media', label: 'Media', icon: PlayCircle },
]

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-card border-t border-border">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className="flex flex-col items-center gap-0.5 py-2 px-3 min-w-[56px] relative"
            >
              {/* Active indicator — subtle orange pill */}
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-vault-gold"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              <motion.div
                className={`relative flex items-center justify-center w-6 h-6 ${
                  isActive ? 'glow-gold-subtle rounded-lg' : ''
                }`}
                animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? 'text-vault-gold' : 'text-muted-foreground'
                  }`}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
              </motion.div>

              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? 'text-vault-gold' : 'text-muted-foreground'
                }`}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
      <div className="pb-safe" />
    </nav>
  )
}
