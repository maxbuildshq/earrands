export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function nativeDownload(files: File[]): Promise<'share_files' | 'download'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ files })
      return 'share_files'
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'share_files'
    }
  }
  for (const f of files) downloadBlob(f, f.name)
  return 'download'
}

export async function nativeShare(
  files: File[],
  data: { title: string; text: string },
): Promise<'native_share_files' | 'native_share_link' | 'download_fallback'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ files, ...data })
      return 'native_share_files'
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err
      // files not supported by this browser — try text-only + download files
      try {
        for (const f of files) downloadBlob(f, f.name)
        await navigator.share(data)
        return 'native_share_link'
      } catch (err2) {
        if ((err2 as Error).name === 'AbortError') throw err2
      }
    }
  }
  for (const f of files) downloadBlob(f, f.name)
  return 'download_fallback'
}
