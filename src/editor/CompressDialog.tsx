import { DownloadOptionsDialog, type DownloadOption } from './DownloadOptionsDialog'

const TOAST = 'Downloading compressed PDF'

const LEVELS: DownloadOption[] = [
  { label: 'Recommended compression', detail: 'Smaller file, good quality', toast: TOAST },
  { label: 'Very small', detail: 'Much smaller, lower image quality', toast: TOAST },
  { label: 'Ultra compressed', detail: 'Smallest file, lowest quality', toast: TOAST },
]

/** Opened from Share: three download buttons, one per compression level. */
export function CompressDialog({ onClose }: { onClose: () => void }) {
  return <DownloadOptionsDialog title="Compress file" options={LEVELS} onClose={onClose} />
}
