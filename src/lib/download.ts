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
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files })
      return 'share_files'
    } catch {
      // user cancelled or error — fall through to downloadBlob
    }
  }
  for (const f of files) downloadBlob(f, f.name)
  return 'download'
}

export async function nativeShare(
  files: File[],
  data: { title: string; text: string },
): Promise<'native_share_files' | 'native_share_link' | 'download_fallback'> {
  if (navigator.canShare?.({ files })) {
    await navigator.share({ files, ...data })
    return 'native_share_files'
  }
  if (navigator.share) {
    for (const f of files) downloadBlob(f, f.name)
    await navigator.share(data)
    return 'native_share_link'
  }
  for (const f of files) downloadBlob(f, f.name)
  return 'download_fallback'
}
