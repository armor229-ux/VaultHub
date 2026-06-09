'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PlayCircle,
  Play,
  Pause,
  Clock,
  Image as ImageIcon,
  Video,
  Music2,
  Volume2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type MediaTab = 'all' | 'photos' | 'videos' | 'music'

interface PhotoItem {
  id: number
  gradient: string // CSS linear-gradient value
  label: string
}

interface VideoItem {
  id: number
  gradient: string // CSS linear-gradient value
  title: string
  duration: string
}

interface SongItem {
  id: number
  title: string
  artist: string
  duration: string
  color: string
}

const photos: PhotoItem[] = [
  { id: 1, gradient: 'linear-gradient(135deg, #f59e0b, #f97316, #f43f5e)', label: 'Sunset' },
  { id: 2, gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4, #14b8a6)', label: 'Ocean' },
  { id: 3, gradient: 'linear-gradient(135deg, #8b5cf6, #a855f7, #d946ef)', label: 'Flowers' },
  { id: 4, gradient: 'linear-gradient(135deg, #10b981, #22c55e, #84cc16)', label: 'Forest' },
  { id: 5, gradient: 'linear-gradient(135deg, #f43f5e, #ec4899, #f87171)', label: 'City' },
  { id: 6, gradient: 'linear-gradient(135deg, #0ea5e9, #6366f1, #2563eb)', label: 'Mountain' },
]

const recentlyAdded: PhotoItem[] = [
  { id: 7, gradient: 'linear-gradient(135deg, #facc15, #f59e0b, #f97316)', label: 'Beach' },
  { id: 8, gradient: 'linear-gradient(135deg, #ec4899, #f43f5e, #ef4444)', label: 'Portrait' },
  { id: 9, gradient: 'linear-gradient(135deg, #14b8a6, #10b981, #22c55e)', label: 'Nature' },
  { id: 10, gradient: 'linear-gradient(135deg, #6366f1, #3b82f6, #06b6d4)', label: 'Sky' },
  { id: 11, gradient: 'linear-gradient(135deg, #d946ef, #a855f7, #8b5cf6)', label: 'Night' },
]

const videos: VideoItem[] = [
  { id: 1, gradient: 'linear-gradient(135deg, #334155, #475569, #1e293b)', title: 'Trip Recording', duration: '12:34' },
  { id: 2, gradient: 'linear-gradient(135deg, #7f1d1d, #9a3412, #78350f)', title: 'Cooking Tutorial', duration: '8:21' },
  { id: 3, gradient: 'linear-gradient(135deg, #1e3a5f, #312e81, #4c1d95)', title: 'Meeting Notes', duration: '45:02' },
]

const songs: SongItem[] = [
  { id: 1, title: 'Midnight Dreams', artist: 'Luna Wave', duration: '3:42', color: 'bg-purple-500' },
  { id: 2, title: 'Golden Hour', artist: 'Sunset Collective', duration: '4:15', color: 'bg-amber-500' },
  { id: 3, title: 'Electric Pulse', artist: 'Neon Drive', duration: '3:58', color: 'bg-cyan-500' },
  { id: 4, title: 'Velvet Skies', artist: 'Stellar Drift', duration: '5:11', color: 'bg-rose-500' },
  { id: 5, title: 'Digital Rain', artist: 'Chrome Hearts', duration: '3:24', color: 'bg-emerald-500' },
]

const tabs: { label: string; value: MediaTab; icon: typeof PlayCircle }[] = [
  { label: 'All', value: 'all', icon: PlayCircle },
  { label: 'Photos', value: 'photos', icon: ImageIcon },
  { label: 'Videos', value: 'videos', icon: Video },
  { label: 'Music', value: 'music', icon: Music2 },
]

export default function MediaSection() {
  const [activeTab, setActiveTab] = useState<MediaTab>('all')
  const [playingSong, setPlayingSong] = useState<number | null>(null)
  const [expandedPhoto, setExpandedPhoto] = useState<PhotoItem | null>(null)

  const togglePlay = useCallback((id: number) => {
    setPlayingSong((prev) => (prev === id ? null : id))
  }, [])

  const handlePhotoTap = useCallback((photo: PhotoItem) => {
    setExpandedPhoto(photo)
  }, [])

  const showPhotos = activeTab === 'all' || activeTab === 'photos'
  const showVideos = activeTab === 'all' || activeTab === 'videos'
  const showMusic = activeTab === 'all' || activeTab === 'music'

  return (
    <div className="space-y-5 px-4 pt-6 pb-28">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2"
      >
        <PlayCircle className="w-5 h-5 text-vault-gold" />
        <h1 className="text-xl font-bold text-foreground">Media</h1>
        <span className="text-xs text-muted-foreground bg-vault-surface px-2 py-0.5 rounded-full ml-1">Preview</span>
      </motion.div>

      {/* Tab Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === tab.value
                ? 'bg-vault-gold/15 text-vault-gold border border-vault-gold/30'
                : 'bg-vault-surface text-muted-foreground border border-transparent hover:text-foreground'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Recently Added - horizontal scroll */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Recently Added</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
              {recentlyAdded.map((photo, index) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.06 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden cursor-pointer relative group"
                  style={{ background: photo.gradient }}
                  onClick={() => handlePhotoTap(photo)}
                  role="button"
                  aria-label={`View ${photo.label}`}
                >
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  <div className="absolute bottom-0 left-0 right-0 p-1.5">
                    <p className="text-[10px] text-white font-medium drop-shadow">{photo.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Photos Grid */}
          {showPhotos && (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-3">Photos</h2>
              <div className="grid grid-cols-2 gap-3">
                {photos.map((photo, index) => (
                  <motion.div
                    key={photo.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.06 }}
                    whileTap={{ scale: 0.97 }}
                    className="aspect-square rounded-xl overflow-hidden cursor-pointer relative group"
                    style={{ background: photo.gradient }}
                    onClick={() => handlePhotoTap(photo)}
                    role="button"
                    aria-label={`View ${photo.label}`}
                  >
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-xs text-white font-medium drop-shadow">{photo.label}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Videos */}
          {showVideos && (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-3">Videos</h2>
              <div className="space-y-3">
                {videos.map((video, index) => (
                  <motion.div
                    key={video.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08 }}
                    whileTap={{ scale: 0.98 }}
                    className="glass-card rounded-xl overflow-hidden cursor-pointer"
                    role="button"
                    aria-label={`Play ${video.title}`}
                  >
                    <div className="relative h-36">
                      <div className="absolute inset-0" style={{ background: video.gradient }} />
                      {/* Play button overlay */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                          <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                        </div>
                      </div>
                      {/* Duration badge */}
                      <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-md px-1.5 py-0.5">
                        <Clock className="w-3 h-3 text-white/80" />
                        <span className="text-[11px] text-white font-medium">{video.duration}</span>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium text-foreground">{video.title}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Music */}
          {showMusic && (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-3">Music</h2>
              <div className="glass-card rounded-xl overflow-hidden">
                {songs.map((song, index) => {
                  const isPlaying = playingSong === song.id
                  return (
                    <motion.div
                      key={song.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.08 }}
                      className={`flex items-center gap-3 p-3 transition-colors cursor-pointer border-b border-border last:border-b-0 ${
                        isPlaying ? 'bg-vault-gold/5' : 'hover:bg-vault-surface/50'
                      }`}
                      onClick={() => togglePlay(song.id)}
                      role="button"
                      aria-label={`${isPlaying ? 'Pause' : 'Play'} ${song.title}`}
                    >
                      {/* Album art */}
                      <div className={`w-11 h-11 rounded-lg ${song.color} flex items-center justify-center flex-shrink-0`}>
                        {isPlaying ? (
                          <Volume2 className="w-5 h-5 text-white/90" />
                        ) : (
                          <Music2 className="w-5 h-5 text-white/80" />
                        )}
                      </div>
                      {/* Track info */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isPlaying ? 'text-vault-gold' : 'text-foreground'}`}>
                          {song.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                      </div>
                      {/* Duration */}
                      <span className="text-xs text-muted-foreground flex-shrink-0 mr-1">
                        {song.duration}
                      </span>
                      {/* Play button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 flex-shrink-0 transition-colors ${
                          isPlaying ? 'text-vault-gold hover:text-vault-gold hover:bg-vault-gold/10' : 'text-muted-foreground hover:text-vault-gold hover:bg-vault-gold/10'
                        }`}
                      >
                        {isPlaying ? (
                          <Pause className="w-4 h-4" fill="currentColor" />
                        ) : (
                          <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                        )}
                      </Button>
                    </motion.div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Web limitation notice */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-start gap-2 px-1 pb-4"
          >
            <Volume2 className="w-4 h-4 text-muted-foreground/60 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground/60">
              Media shown here is for preview. To access real files, use the File Explorer to browse your device.
            </p>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Photo Preview Overlay */}
      <AnimatePresence>
        {expandedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setExpandedPhoto(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-full max-w-sm aspect-square rounded-2xl overflow-hidden relative"
              style={{ background: expandedPhoto.gradient }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white"
                onClick={() => setExpandedPhoto(null)}
                aria-label="Close preview"
              >
                ✕
              </button>
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                <p className="text-sm font-medium text-white">{expandedPhoto.label}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
