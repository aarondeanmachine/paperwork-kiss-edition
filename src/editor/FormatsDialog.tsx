import { DownloadOptionsDialog } from './DownloadOptionsDialog'

const FORMATS = [
  { extension: '.pdf', detail: 'PDF document' },
  { extension: '.docx', detail: 'Word document' },
  { extension: '.rtf', detail: 'Rich Text Format' },
  { extension: '.md', detail: 'Markdown' },
]

/** Opened from Share: a download button per file format. */
export function FormatsDialog({ fileName, onClose }: { fileName: string; onClose: () => void }) {
  const options = FORMATS.map(({ extension, detail }) => ({
    label: extension,
    detail,
    toast: `Downloading ${fileName}${extension}`,
  }))
  return <DownloadOptionsDialog title="Download as" options={options} onClose={onClose} />
}
