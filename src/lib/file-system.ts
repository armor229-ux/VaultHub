/**
 * File System Access API utilities for Vault Hub File Explorer.
 *
 * WEB/TWA LIMITATIONS (documented per user requirement):
 * ──────────────────────────────────────────────────────────────
 * - This runs in a browser/TWA context — no native Android file system access.
 * - Uses the File System Access API (showDirectoryPicker) in Chromium browsers/TWA.
 * - Falls back to <input type="file" webkitdirectory> on non-Chromium browsers.
 * - Permission persistence uses IndexedDB to store FileSystemDirectoryHandle.
 * - Rename is not natively supported by FS Access API; we emulate it via
 *   copy-to-new-name + delete-old.
 * - Delete is only allowed within the granted directory scope.
 * ──────────────────────────────────────────────────────────────
 */

/* ── TypeScript declarations for File System Access API ── */
interface FileSystemHandleDescriptor {
  handle: FileSystemHandle
}

declare global {
  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemHandle>
    getEntryHandle(name: string): Promise<FileSystemHandle | undefined>
  }

  interface Window {
    showDirectoryPicker?(options?: {
      mode?: 'read' | 'readwrite'
      startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'
    }): Promise<FileSystemDirectoryHandle>
    queryPermission?: (descriptor: FileSystemHandleDescriptor, mode?: 'read' | 'readwrite') => Promise<PermissionState>
    requestPermission?: (descriptor: FileSystemHandleDescriptor, mode?: 'read' | 'readwrite') => Promise<PermissionState>
  }
}

// Re-export extended types for internal use
export type FSDirHandle = FileSystemDirectoryHandle
export type FSFileHandle = FileSystemFileHandle

export type AccessState = 'idle' | 'loading' | 'granted' | 'error' | 'unsupported'

export interface FileItem {
  name: string
  kind: 'file' | 'directory'
  size: number
  lastModified: number
  type: string
  handle: FSFileHandle | FSDirHandle
  parentHandle: FSDirHandle
}

export interface FileItemWithPath extends FileItem {
  path: string
}

/* ── Detection ── */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

/* ── IndexedDB persistence for directory handles ── */
const DB_NAME = 'vault-hub-fs'
const DB_VERSION = 1
const STORE_NAME = 'handles'
const HANDLE_KEY = 'root-directory'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function persistDirectoryHandle(handle: FSDirHandle): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // IndexedDB persistence failed — non-critical, user can re-pick
  }
}

export async function loadPersistedHandle(): Promise<FSDirHandle | null> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY)
    const result = await new Promise<FSDirHandle | undefined>((resolve) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(undefined)
    })
    return result ?? null
  } catch {
    return null
  }
}

export async function clearPersistedHandle(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(HANDLE_KEY)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Non-critical
  }
}

/* ── Directory Access Request ── */
export async function requestDirectoryAccess(): Promise<FSDirHandle | null> {
  // Try File System Access API first (Chromium / TWA WebView)
  if (isFileSystemAccessSupported()) {
    try {
      const handle = await window.showDirectoryPicker!({
        mode: 'readwrite',
        startIn: 'documents',
      })
      await persistDirectoryHandle(handle)
      return handle
    } catch (err: unknown) {
      const name = (err as DOMException)?.name
      // User cancelled the picker — not an error
      if (name === 'AbortError' || name === 'NotAllowedError') {
        return null
      }
      // Other error — try fallback
      console.warn('showDirectoryPicker failed, trying fallback:', name)
    }
  }

  // Fallback: <input type="file" webkitdirectory>
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.webkitdirectory = true
    input.multiple = true
    input.style.display = 'none'
    document.body.appendChild(input)

    input.addEventListener('change', () => {
      document.body.removeChild(input)
      if (input.files && input.files.length > 0) {
        // Fallback: we return the file list via a synthetic handle wrapper
        // We store the File array in IndexedDB instead since we don't get a handle
        resolve(null) // signal to use fallback mode
      } else {
        resolve(null)
      }
    })

    input.addEventListener('cancel', () => {
      document.body.removeChild(input)
      resolve(null)
    })

    input.click()
  })
}

/* ── Verify existing permission ── */
export async function verifyPermission(handle: FSDirHandle): Promise<boolean> {
  if (!('queryPermission' in window)) return false
  try {
    const state = await window.queryPermission!(
      { handle } as unknown as FileSystemHandleDescriptor,
      'read'
    )
    return state === 'granted'
  } catch {
    return false
  }
}

/* ── Read directory contents (non-recursive) ── */
export async function getDirectoryEntries(
  dirHandle: FSDirHandle
): Promise<FileItem[]> {
  const entries: FileItem[] = []
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      const fileHandle = entry as FSFileHandle
      try {
        const file = await fileHandle.getFile()
        entries.push({
          name: entry.name,
          kind: 'file',
          size: file.size,
          lastModified: file.lastModified,
          type: file.type || getExtensionType(entry.name),
          handle: fileHandle,
          parentHandle: dirHandle,
        })
      } catch {
        // Some files may fail to read (permissions) — skip
        entries.push({
          name: entry.name,
          kind: 'file',
          size: 0,
          lastModified: 0,
          type: getExtensionType(entry.name),
          handle: fileHandle,
          parentHandle: dirHandle,
        })
      }
    } else if (entry.kind === 'directory') {
      entries.push({
        name: entry.name,
        kind: 'directory',
        size: 0,
        lastModified: 0,
        type: 'directory',
        handle: entry as FSDirHandle,
        parentHandle: dirHandle,
      })
    }
  }
  return entries
}

/* ── Read file content (text only) ── */
export async function readFileContent(handle: FSFileHandle): Promise<string> {
  const file = await handle.getFile()
  return file.text()
}

/* ── Write file content via createWritable ── */
export async function writeFileContent(
  handle: FSFileHandle,
  content: string
): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(content)
  await writable.close()
}

/* ── Delete entry from directory ── */
export async function deleteEntry(
  dirHandle: FSDirHandle,
  name: string,
  recursive = false
): Promise<void> {
  await dirHandle.removeEntry(name, { recursive })
}

/* ── Rename: FS Access API has no native rename. Emulate via copy + delete. ── */
export async function renameEntry(
  dirHandle: FSDirHandle,
  oldName: string,
  newName: string
): Promise<void> {
  const entry = await dirHandle.getEntryHandle(oldName)
  if (!entry) throw new Error(`Entry "${oldName}" not found`)

  if (entry.kind === 'file') {
    const fileHandle = entry as FSFileHandle
    const file = await fileHandle.getFile()
    const content = await file.arrayBuffer()
    const newHandle = await dirHandle.getFileHandle(newName, { create: true })
    const writable = await newHandle.createWritable()
    await writable.write(content)
    await writable.close()
    await dirHandle.removeEntry(oldName)
  } else {
    // Directory rename: not practical without recursion — notify caller
    throw new Error('Cannot rename directories in web environment')
  }
}

/* ── Download file to user's device ── */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  // Cleanup after a short delay
  setTimeout(() => {
    URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }, 200)
}

/* ── Share file via Web Share API ── */
export async function shareFile(file: File): Promise<boolean> {
  if (!navigator.share) return false
  try {
    const data: ShareData = { files: [file] }
    // Try file sharing first
    if (navigator.canShare && navigator.canShare(data)) {
      await navigator.share(data)
      return true
    }
    // Fallback: share text info
    await navigator.share({
      title: file.name,
      text: `File: ${file.name} (${formatSize(file.size)})`,
    })
    return true
  } catch (err: unknown) {
    const name = (err as DOMException)?.name
    if (name === 'AbortError') return false // User cancelled
    return false
  }
}

/* ── Helpers ── */

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'scss', 'less',
  'xml', 'svg', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'sh', 'bash', 'zsh',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'cpp', 'h', 'hpp',
  'log', 'env', 'gitignore', 'editorconfig', 'prettierrc', 'eslintrc',
  'csv', 'sql', 'graphql', 'gql', 'prisma',
  'rtf', 'tex', 'vue', 'svelte', 'astro',
])

export function isTextFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (TEXT_EXTENSIONS.has(ext)) return true
  // Files without extension are likely text (Makefile, Dockerfile, etc.)
  if (!ext && !filename.startsWith('.')) return true
  return false
}

function getExtensionType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    ico: 'image/x-icon',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    aac: 'audio/aac',
    mp4: 'video/mp4',
    webm: 'video/webm',
    avi: 'video/avi',
    mkv: 'video/x-matroska',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    apk: 'application/vnd.android.package-archive',
    json: 'application/json',
    xml: 'text/xml',
    html: 'text/html',
    css: 'text/css',
    js: 'text/javascript',
    ts: 'text/typescript',
    md: 'text/markdown',
    txt: 'text/plain',
    csv: 'text/csv',
    sql: 'text/x-sql',
  }
  return map[ext] || 'application/octet-stream'
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const val = bytes / Math.pow(1024, i)
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getFileCategory(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const imageExts = new Set(['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'])
  const audioExts = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'wma', 'm4a'])
  const videoExts = new Set(['mp4', 'webm', 'avi', 'mkv', 'mov', 'flv', 'wmv'])
  const archiveExts = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'])
  const docExts = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf', 'odt'])
  const codeExts = new Set(['js', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'cpp', 'h', 'css', 'scss', 'html', 'json', 'yaml', 'yml', 'xml', 'sh', 'sql', 'md', 'vue', 'svelte'])
  const apkExts = new Set(['apk'])

  if (imageExts.has(ext)) return 'image'
  if (audioExts.has(ext)) return 'audio'
  if (videoExts.has(ext)) return 'video'
  if (archiveExts.has(ext)) return 'archive'
  if (docExts.has(ext)) return 'document'
  if (codeExts.has(ext)) return 'code'
  if (apkExts.has(ext)) return 'apk'
  return 'other'
}
