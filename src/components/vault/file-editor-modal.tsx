'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, Save, Download, X, FileText } from 'lucide-react'
import type { FileItem } from '@/lib/file-system'
import { readFileContent, writeFileContent, downloadFile } from '@/lib/file-system'
import type { FSFileHandle } from '@/lib/file-system'

interface FileEditorModalProps {
  fileItem: FileItem | null
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

export default function FileEditorModal({
  fileItem,
  open,
  onClose,
  onSaved,
}: FileEditorModalProps) {
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isModified = content !== originalContent

  // Reset state when file changes
  useEffect(() => {
    if (!fileItem || fileItem.kind !== 'file') {
      setContent('')
      setOriginalContent('')
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    readFileContent(fileItem.handle as FSFileHandle)
      .then((text) => {
        if (!cancelled) {
          setContent(text)
          setOriginalContent(text)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(`Failed to read file: ${err instanceof Error ? err.message : 'Unknown error'}`)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [fileItem])

  // Focus textarea when loaded
  useEffect(() => {
    if (!loading && content !== '' && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [loading, content])

  const handleSave = useCallback(async () => {
    if (!fileItem || fileItem.kind !== 'file') return
    setSaving(true)
    setError(null)
    try {
      await writeFileContent(fileItem.handle as FSFileHandle, content)
      setOriginalContent(content)
      onSaved?.()
    } catch (err) {
      setError(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }, [fileItem, content, onSaved])

  const handleDownload = useCallback(async () => {
    if (!fileItem || fileItem.kind !== 'file') return
    try {
      const file = await (fileItem.handle as FSFileHandle).getFile()
      downloadFile(file)
    } catch {
      setError('Failed to download file')
    }
  }, [fileItem])

  const handleExportAs = useCallback(() => {
    if (!fileItem) return
    const blob = new Blob([content], { type: 'text/plain' })
    const file = new File([blob], fileItem.name, { type: 'text/plain' })
    downloadFile(file)
  }, [fileItem, content])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4 text-vault-gold" />
            {fileItem?.name || 'File Editor'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {fileItem?.kind === 'file'
              ? `${(fileItem as FileItem).type} · ${(fileItem as FileItem).size > 0 ? `${(fileItem as FileItem).size.toLocaleString()} bytes` : ''}`
              : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Error banner */}
        {error && (
          <div className="bg-vault-danger/10 border border-vault-danger/20 rounded-lg px-3 py-2 text-sm text-vault-danger flex items-center justify-between">
            <span className="truncate">{error}</span>
            <button onClick={() => setError(null)} className="ml-2 flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-vault-gold animate-spin" />
            <span className="ml-2 text-sm text-muted-foreground">Loading file…</span>
          </div>
        )}

        {/* Editor */}
        {!loading && (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 min-h-[300px] w-full rounded-xl bg-vault-surface border border-border text-foreground text-sm font-mono p-3 resize-none focus:outline-none focus:ring-1 focus:ring-vault-gold/50 placeholder:text-muted-foreground leading-relaxed"
            placeholder="File content will appear here…"
            spellCheck={false}
          />
        )}

        {/* Footer with modified indicator + actions */}
        <DialogFooter className="flex items-center gap-2 sm:gap-3">
          {isModified && (
            <span className="text-xs text-vault-warning mr-auto">
              Modified
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={handleExportAs}
            disabled={loading}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={handleDownload}
            disabled={loading}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Download
          </Button>
          <Button
            size="sm"
            className="bg-vault-gold text-background hover:bg-vault-gold/90"
            onClick={handleSave}
            disabled={loading || !isModified || saving}
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1.5" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
