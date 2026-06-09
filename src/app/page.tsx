'use client'

import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import DashboardSection from '@/components/vault/dashboard'
import CacheCleanerSection from '@/components/vault/cache-cleaner'
import FileExplorerSection from '@/components/vault/file-explorer'
import PasswordVaultSection from '@/components/vault/password-vault'
import MediaSection from '@/components/vault/media'
import BottomNav from '@/components/vault/bottom-nav'

export default function Home() {
  const [activeTab, setActiveTab] = useState('home')

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab)
  }, [])

  const renderSection = () => {
    switch (activeTab) {
      case 'home':
        return <DashboardSection onNavigate={handleTabChange} />
      case 'cleaner':
        return <CacheCleanerSection />
      case 'files':
        return <FileExplorerSection />
      case 'vault':
        return <PasswordVaultSection />
      case 'media':
        return <MediaSection />
      default:
        return <DashboardSection onNavigate={handleTabChange} />
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground max-w-lg mx-auto relative flex flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className="flex-1 overflow-y-auto"
        >
          {renderSection()}
        </motion.div>
      </AnimatePresence>
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  )
}
