'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderOpen,
  Search,
  Grid3X3,
  List,
  ChevronRight,
  FileText,
  Image,
  Music,
  Video,
  FileArchive,
  FolderPlus,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  Download,
  Share2,
  Folder,
  RefreshCw,
  ShieldCheck,
  FolderLock,
  Lock,
  ArrowLeft,
  Loader2,
  AlertCircle,
  FileCode2,
  Package,
  File,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

import type {
  FileItem,
  AccessState,
  FSDirHandle,
  FSFileHandle,
} from '@/lib/file-system'
import {
  requestDirectoryAccess,
  loadPersistedHandle,
  verifyPermission,
  persistDirectoryHandle,
  getDirectoryEntries,
  deleteEntry,
  readFileContent,
  writeFileContent,
  downloadFile,
  shareFile,
  isTextFile,
  formatSize,
  formatDate,
  getFileCategory,
  isFileSystemAccessSupported,
} from '@/lib/file-system'
import FileEditorModal from './file-editor-modal'

/* ── Icon helpers ── */
function getIconForCategory(category: string) {
  switch (category) {
    case 'image': return { icon: Image, color: 'text-purple-400', bg: 'bg-purple-400/10' }
    case 'audio': return { icon: Music, color: 'text-amber-400', bg: 'bg-amber-400/10' }
    case 'video': return { icon: Video, color: 'text-red-400', bg: 'bg-red-400/10' }
    case 'archive': return { icon: FileArchive, color: 'text-gray-400', bg: 'bg-gray-400/10' }
    case 'document': return { icon: FileText, color: 'text-sky-400', bg: 'bg-sky-400/10' }
    case 'code': return { icon: FileCode2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' }
    case 'apk': return { icon: Package, color: 'text-orange-400', bg: 'bg-orange-400/10' }
    default: return { icon: File, color: 'text-muted-foreground', bg: 'bg-muted/10' }
  }
}

type SortOption = 'name' | 'size' | 'date' | 'type'
type ViewMode = 'grid' | 'list'

export default function FileExplorerSection() {
  /* ── State ── */
  const [accessState, setAccessState] = useState<AccessState>('idle')
  const [rootHandle, setRootHandle] = useState<FSDirHandle | null>(null)
  const [currentHandle, setCurrentHandle] = useState<FSDirHandle | null>(null)
  const [currentPath, setCurrentPath] = useState<string[]>([])
  const [items, setItems] = useState<FileItem[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortBy, setSortBy] = useState<SortOption>('name')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Editor modal state
  const [editingFile, setEditingFile] = useState<FileItem | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  // Preview modal state
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Rename dialog state
  const [renamingItem, setRenamingItem] = useState<FileItem | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)

  // File picker fallback ref
  const fallbackInputRef = useRef<HTMLInputElement | null>(null)
  const [fallbackFiles, setFallbackFiles] = useState<FileItem[]>([])

  const [isFallback, setIsFallback] = useState(true) // SSR-safe: true on server & first client paint

  /* ── Load directory contents ── */
  const loadEntries = useCallback(async (handle: FSDirHandle) => {
    try {
      const entries = await getDirectoryEntries(handle)
      setItems(entries)
      setError(null)
    } catch (err) {
      setError(`Failed to read directory: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setItems([])
    }
  }, [])

  /* ── Grant access ── */
  const handleGrantAccess = useCallback(async () => {
    setAccessState('loading')
    setError(null)

    try {
      // Try to restore persisted handle first
      const persisted = await loadPersistedHandle()
      if (persisted) {
        const valid = await verifyPermission(persisted)
        if (valid) {
          setRootHandle(persisted)
          setCurrentHandle(persisted)
          setCurrentPath([])
          await loadEntries(persisted)
          setAccessState('granted')
          return
        }
      }

      // Request fresh access
      const handle = await requestDirectoryAccess()
      if (handle) {
        setRootHandle(handle)
        setCurrentHandle(handle)
        setCurrentPath([])
        await loadEntries(handle)
        setAccessState('granted')
      } else {
        setAccessState('idle')
      }
    } catch (err) {
      setAccessState('error')
      setError(err instanceof Error ? err.message : 'Failed to access directory')
    }
  }, [loadEntries])

  /* ── Auto-restore persisted handle on mount ── */
  useEffect(() => {
    const fallback = !isFileSystemAccessSupported()
    setIsFallback(fallback)

    if (fallback) {
      setAccessState('unsupported')
      return
    }

    ;(async () => {
      const persisted = await loadPersistedHandle()
      if (persisted && await verifyPermission(persisted)) {
        setRootHandle(persisted)
        setCurrentHandle(persisted)
        setCurrentPath([])
        setAccessState('granted')
        loadEntries(persisted)
      }
    })()
  }, [])

  /* ── Navigate into subdirectory ── */
  const navigateInto = useCallback(async (dirItem: FileItem) => {
    if (dirItem.kind !== 'directory') return
    const handle = dirItem.handle as FSDirHandle
    setCurrentHandle(handle)
    setCurrentPath((prev) => [...prev, dirItem.name])
    setItems([])
    setAccessState('loading')
    await loadEntries(handle)
    setAccessState('granted')
  }, [loadEntries])

  /* ── Navigate back ── */
  const navigateBack = useCallback(async () => {
    if (currentPath.length === 0) return
    const newPath = currentPath.slice(0, -1)
    setCurrentPath(newPath)

    // Walk from root to find the target handle
    if (rootHandle) {
      let handle = rootHandle
      for (const segment of newPath) {
        handle = await handle.getDirectoryHandle(segment)
      }
      setCurrentHandle(handle)
      await loadEntries(handle)
    }
  }, [currentPath, rootHandle, loadEntries])

  /* ── Navigate to breadcrumb ── */
  const navigateToBreadcrumb = useCallback(async (index: number) => {
    const newPath = currentPath.slice(0, index)
    setCurrentPath(newPath)

    if (rootHandle) {
      let handle = rootHandle
      for (const segment of newPath) {
        handle = await handle.getDirectoryHandle(segment)
      }
      setCurrentHandle(handle)
      await loadEntries(handle)
    }
  }, [currentPath, rootHandle, loadEntries])

  /* ── Refresh ── */
  const handleRefresh = useCallback(async () => {
    if (currentHandle) {
      setAccessState('loading')
      await loadEntries(currentHandle)
      setAccessState('granted')
    }
  }, [currentHandle, loadEntries])

  /* ── Sort & filter ── */
  const filteredItems = useMemo(() => {
    let result = items

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((item) =>
        item.name.toLowerCase().includes(q)
      )
    }

    result = [...result].sort((a, b) => {
      // Directories first
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name)
        case 'size': return b.size - a.size
        case 'date': return b.lastModified - a.lastModified
        case 'type': return a.type.localeCompare(b.type)
        default: return 0
      }
    })

    return result
  }, [items, searchQuery, sortBy])

  const dirs = useMemo(() => filteredItems.filter((i) => i.kind === 'directory'), [filteredItems])
  const files = useMemo(() => filteredItems.filter((i) => i.kind === 'file'), [filteredItems])

  /* ── File actions ── */

  // Preview / Open
  const handlePreview = useCallback(async (item: FileItem) => {
    if (item.kind !== 'file') return
    try {
      const file = await (item.handle as FSFileHandle).getFile()
      const category = getFileCategory(item.name)

      // For images, create a preview URL
      if (category === 'image') {
        const url = URL.createObjectURL(file)
        setPreviewFile(item)
        setPreviewUrl(url)
      } else {
        // For other files, try to open in new tab / download
        const url = URL.createObjectURL(file)
        const w = window.open(url, '_blank')
        if (!w) downloadFile(file)
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      }
    } catch {
      setError('Failed to open file')
    }
  }, [])

  // Edit
  const handleEdit = useCallback((item: FileItem) => {
    if (item.kind !== 'file') return
    if (!isTextFile(item.name)) {
      setError('This file type cannot be edited as text. You can rename or download it instead.')
      return
    }
    setEditingFile(item)
    setEditorOpen(true)
  }, [])

  // Delete
  const handleDelete = useCallback(async (item: FileItem) => {
    if (!currentHandle) return
    try {
      await deleteEntry(currentHandle, item.name, item.kind === 'directory')
      await loadEntries(currentHandle)
    } catch (err) {
      setError(`Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [currentHandle, loadEntries])

  // Download
  const handleDownloadItem = useCallback(async (item: FileItem) => {
    if (item.kind !== 'file') return
    try {
      const file = await (item.handle as FSFileHandle).getFile()
      downloadFile(file)
    } catch {
      setError('Failed to download file')
    }
  }, [])

  // Share
  const handleShare = useCallback(async (item: FileItem) => {
    if (item.kind !== 'file') return
    try {
      const file = await (item.handle as FSFileHandle).getFile()
      const shared = await shareFile(file)
      if (!shared) {
        // Fallback: download
        downloadFile(file)
      }
    } catch {
      setError('Share not available — file downloaded instead')
    }
  }, [])

  // Rename — open dialog
  const handleRenameStart = useCallback((item: FileItem) => {
    if (item.kind === 'directory') {
      setError('Renaming directories is not supported in web browsers')
      return
    }
    setRenamingItem(item)
    setRenameValue(item.name)
  }, [])

  // Rename — confirm
  const handleRenameConfirm = useCallback(async () => {
    if (!currentHandle || !renamingItem || !renameValue.trim()) return
    if (renameValue === renamingItem.name) {
      setRenamingItem(null)
      return
    }
    setRenaming(true)
    try {
      // Emulate rename: create new + delete old
      const fileHandle = renamingItem.handle as FSFileHandle
      const file = await fileHandle.getFile()
      const content = await file.arrayBuffer()
      const newHandle = await currentHandle.getFileHandle(renameValue, { create: true })
      const writable = await newHandle.createWritable()
      await writable.write(content)
      await writable.close()
      await currentHandle.removeEntry(renamingItem.name)

      setRenamingItem(null)
      await loadEntries(currentHandle)
    } catch (err) {
      setError(`Rename failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setRenaming(false)
    }
  }, [currentHandle, renamingItem, renameValue, loadEntries])

  /* ── Fallback file picker handler ── */
  const handleFallbackPick = useCallback(() => {
    if (!fallbackInputRef.current) return
    fallbackInputRef.current.click()
  }, [])

  const handleFallbackChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    const fileItems: FileItem[] = Array.from(fileList).map((file) => ({
      name: file.name,
      kind: 'file' as const,
      size: file.size,
      lastModified: file.lastModified,
      type: file.type || getFileCategory(file.name),
      handle: null as unknown as FSFileHandle,
      parentHandle: null as unknown as FSDirHandle,
    }))
    setFallbackFiles(fileItems)
    setItems(fileItems)
    setAccessState('granted')
  }, [])

  /* ── Render: Not granted / onboarding ── */
  if (accessState === 'idle' || accessState === 'unsupported') {
    return (
      <div className="space-y-4 px-4 pt-5 pb-28">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 pt-1"
        >
          <FolderOpen className="w-5 h-5 text-vault-gold" />
          <h1 className="text-lg font-semibold text-foreground">File Explorer</h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-xl p-6 text-center space-y-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-vault-gold/10 flex items-center justify-center mx-auto">
            {isFallback ? (
              <FolderLock className="w-8 h-8 text-vault-gold" />
            ) : (
              <FolderPlus className="w-8 h-8 text-vault-gold" />
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">
              {isFallback ? 'Select a Folder' : 'Grant Folder Access'}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {isFallback
                ? 'Your browser does not support the File System Access API. You can select a folder to browse its contents.'
                : 'To browse files, please grant access to a folder. Your data stays on your device — nothing is uploaded.'}
            </p>
          </div>

          {isFallback && (
            <p className="text-xs text-muted-foreground/60">
              Limited mode: read-only, no rename or delete.
            </p>
          )}

          <Button
            className="h-11 rounded-xl bg-vault-gold text-background hover:bg-vault-gold/90 glow-gold"
            onClick={isFallback ? handleFallbackPick : handleGrantAccess}
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            {isFallback ? 'Select Folder' : 'Grant Access'}
          </Button>

          {isFallback && (
            <input
              ref={fallbackInputRef}
              type="file"
              {...{ webkitdirectory: "true", directory: "true" } as React.InputHTMLAttributes<HTMLInputElement>}
              multiple
              className="hidden"
              onChange={handleFallbackChange}
            />
          )}
        </motion.div>

        {/* Privacy notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="flex items-start gap-2 px-1"
        >
          <ShieldCheck className="w-4 h-4 text-vault-success flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            All file operations happen locally in your browser. No data is sent to any server.
          </p>
        </motion.div>
      </div>
    )
  }

  /* ── Render: Loading ── */
  if (accessState === 'loading') {
    return (
      <div className="space-y-4 px-4 pt-5 pb-28">
        <motion.div className="flex items-center gap-2 pt-1">
          <FolderOpen className="w-5 h-5 text-vault-gold" />
          <h1 className="text-lg font-semibold text-foreground">File Explorer</h1>
        </motion.div>
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Loader2 className="w-8 h-8 text-vault-gold animate-spin" />
          <p className="text-sm text-muted-foreground">Loading files…</p>
        </div>
      </div>
    )
  }

  /* ── Render: Error ── */
  if (accessState === 'error') {
    return (
      <div className="space-y-4 px-4 pt-5 pb-28">
        <motion.div className="flex items-center gap-2 pt-1">
          <FolderOpen className="w-5 h-5 text-vault-gold" />
          <h1 className="text-lg font-semibold text-foreground">File Explorer</h1>
        </motion.div>
        <div className="glass-card rounded-xl p-6 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-vault-danger mx-auto" />
          <p className="text-sm text-vault-danger">{error || 'An error occurred'}</p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={handleGrantAccess}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  /* ── Render: Granted (main explorer) ── */
  return (
    <div className="space-y-4 px-4 pt-5 pb-28">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between pt-1"
      >
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-vault-gold" />
          <h1 className="text-lg font-semibold text-foreground">File Explorer</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={handleRefresh}
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </motion.div>

      {/* Error banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-vault-danger/10 border border-vault-danger/20 rounded-lg px-3 py-2 text-sm text-vault-danger flex items-center justify-between"
        >
          <span className="truncate">{error}</span>
          <button onClick={() => setError(null)} className="ml-2 flex-shrink-0 hover:opacity-70">
            ✕
          </button>
        </motion.div>
      )}

      {/* Breadcrumb */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.06 }}
        className="flex items-center gap-0.5 text-sm overflow-x-auto pb-0.5"
      >
        <button
          onClick={() => { setCurrentHandle(rootHandle); setCurrentPath([]); if (rootHandle) loadEntries(rootHandle) }}
          className={`text-xs whitespace-nowrap transition-colors ${
            currentPath.length === 0 ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Root
        </button>
        {currentPath.map((segment, i) => (
          <span key={i} className="flex items-center gap-0.5">
            <ChevronRight className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
            <button
              onClick={() => navigateToBreadcrumb(i + 1)}
              className={`text-xs whitespace-nowrap transition-colors ${
                i === currentPath.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {segment}
            </button>
          </span>
        ))}
      </motion.div>

      {/* Search + View controls */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="flex gap-2 items-center"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search files…"
            className="pl-9 h-9 bg-vault-surface border-border text-foreground placeholder:text-muted-foreground rounded-xl text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {currentPath.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl flex-shrink-0 text-muted-foreground hover:text-foreground"
            onClick={navigateBack}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={`h-9 w-9 rounded-xl flex-shrink-0 ${
            viewMode === 'grid' ? 'text-vault-gold bg-vault-gold/10' : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setViewMode('grid')}
        >
          <Grid3X3 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={`h-9 w-9 rounded-xl flex-shrink-0 ${
            viewMode === 'list' ? 'text-vault-gold bg-vault-gold/10' : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setViewMode('list')}
        >
          <List className="w-4 h-4" />
        </Button>
      </motion.div>

      {/* Sort */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-2"
      >
        <span className="text-xs text-muted-foreground">
          {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
          {dirs.length > 0 && ` · ${dirs.length} folder${dirs.length !== 1 ? 's' : ''}`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="h-7 w-24 bg-vault-surface border-border text-xs text-foreground rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="size">Size</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="type">Type</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* ── Content: Empty ── */}
      {filteredItems.length === 0 && !searchQuery && (
        <div className="flex flex-col items-center py-16 text-center">
          <Folder className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">This folder is empty</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Navigate back or choose a different folder</p>
        </div>
      )}

      {/* ── Content: No search results ── */}
      {filteredItems.length === 0 && searchQuery && (
        <div className="flex flex-col items-center py-16 text-center">
          <Search className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No files match "{searchQuery}"</p>
        </div>
      )}

      {/* ── Content: Grid view ── */}
      {viewMode === 'grid' && filteredItems.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          {/* Directories */}
          {dirs.map((dir, index) => {
            const catInfo = { icon: Folder, color: 'text-vault-gold', bg: 'bg-vault-gold/10' }
            return (
              <motion.div
                key={`dir-${dir.name}`}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.04 }}
                whileTap={{ scale: 0.96 }}
                className="glass-card card-hover rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer"
                onClick={() => navigateInto(dir)}
              >
                <div className={`w-11 h-11 rounded-xl ${catInfo.bg} flex items-center justify-center`}>
                  <Folder className={`w-5 h-5 ${catInfo.color}`} />
                </div>
                <div className="text-center w-full">
                  <p className="text-xs font-medium text-foreground truncate w-full">{dir.name}</p>
                </div>
              </motion.div>
            )
          })}
          {/* Files */}
          {files.map((file, index) => {
            const catInfo = getIconForCategory(getFileCategory(file.name))
            const Icon = catInfo.icon
            return (
              <motion.div
                key={`file-${file.name}`}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: (dirs.length + index) * 0.04 }}
                whileTap={{ scale: 0.96 }}
                className="glass-card card-hover rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer relative"
                onClick={() => handlePreview(file)}
              >
                {/* 3-dot menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="absolute top-1.5 right-1.5 h-6 w-6 rounded-md flex items-center justify-center hover:bg-vault-surface transition-colors z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="bottom" align="end" className="w-44">
                    <DropdownMenuLabel className="text-xs">{file.name}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePreview(file) }}>
                      <Eye className="w-3.5 h-3.5 mr-2" /> Open
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(file) }}>
                      <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRenameStart(file) }}>
                      <FileText className="w-3.5 h-3.5 mr-2" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownloadItem(file) }}>
                      <Download className="w-3.5 h-3.5 mr-2" /> Download
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleShare(file) }}>
                      <Share2 className="w-3.5 h-3.5 mr-2" /> Share
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={(e) => { e.stopPropagation(); handleDelete(file) }}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className={`w-11 h-11 rounded-xl ${catInfo.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${catInfo.color}`} />
                </div>
                <div className="text-center w-full">
                  <p className="text-xs font-medium text-foreground truncate w-full">{file.name}</p>
                  <p className="text-[10px] text-muted-foreground">{formatSize(file.size)}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ── Content: List view ── */}
      {viewMode === 'list' && filteredItems.length > 0 && (
        <div className="glass-card rounded-xl overflow-hidden">
          {filteredItems.map((item, index) => {
            const isDir = item.kind === 'directory'
            const catInfo = isDir
              ? { icon: Folder, color: 'text-vault-gold', bg: 'bg-vault-gold/10' }
              : getIconForCategory(getFileCategory(item.name))
            const Icon = catInfo.icon

            return (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center gap-3 p-3 hover:bg-vault-surface/50 transition-colors cursor-pointer border-b border-border last:border-b-0"
                onClick={() => isDir ? navigateInto(item) : handlePreview(item)}
              >
                <div className={`w-9 h-9 rounded-lg ${catInfo.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${catInfo.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {isDir ? 'Folder' : formatSize(item.size)}
                    {!isDir && item.lastModified ? ` · ${formatDate(item.lastModified)}` : ''}
                  </p>
                </div>
                {!isFallback && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-vault-surface transition-colors flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="bottom" align="end" className="w-44">
                      <DropdownMenuLabel className="text-xs truncate max-w-[160px]">{item.name}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {isDir ? (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigateInto(item) }}>
                          <FolderOpen className="w-3.5 h-3.5 mr-2" /> Open
                        </DropdownMenuItem>
                      ) : (
                        <>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePreview(item) }}>
                            <Eye className="w-3.5 h-3.5 mr-2" /> Open / Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(item) }}>
                            <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRenameStart(item) }}>
                            <FileText className="w-3.5 h-3.5 mr-2" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownloadItem(item) }}>
                            <Download className="w-3.5 h-3.5 mr-2" /> Download
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleShare(item) }}>
                            <Share2 className="w-3.5 h-3.5 mr-2" /> Share
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={(e) => { e.stopPropagation(); handleDelete(item) }}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ── File Editor Modal ── */}
      <FileEditorModal
        fileItem={editingFile}
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditingFile(null) }}
        onSaved={() => currentHandle && loadEntries(currentHandle)}
      />

      {/* ── Image Preview Modal ── */}
      {previewUrl && previewFile && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => { setPreviewUrl(null); setPreviewFile(null) }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-full max-h-[80vh] relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* native img tag required for blob: URLs in preview overlay */}
            <img
              src={previewUrl}
              alt={previewFile.name}
              className="max-w-full max-h-[80vh] rounded-xl object-contain"
            />
            <button
              className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-background/80 border border-border flex items-center justify-center text-foreground text-xs hover:bg-background transition-colors"
              onClick={() => { setPreviewUrl(null); setPreviewFile(null); URL.revokeObjectURL(previewUrl) }}
            >
              ✕
            </button>
          </motion.div>
        </div>
      )}

      {/* ── Rename Dialog ── */}
      {renamingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-xl p-5 w-full max-w-sm"
          >
            <h3 className="text-base font-semibold text-foreground mb-1">Rename</h3>
            <p className="text-xs text-muted-foreground mb-3">Enter a new name for "{renamingItem.name}"</p>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="h-10 bg-vault-surface border-border text-foreground rounded-xl text-sm"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl"
                onClick={() => setRenamingItem(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="rounded-xl bg-vault-gold text-background hover:bg-vault-gold/90"
                onClick={handleRenameConfirm}
                disabled={!renameValue.trim() || renameValue === renamingItem.name || renaming}
              >
                {renaming ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                Rename
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
