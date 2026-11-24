import raw from '../../culture_manifesto.md?raw'
import type { TextSize } from '../types'

export type BlockRole = 'label' | 'title' | 'heading' | 'body'

export interface Block {
  role: BlockRole
  size: TextSize
  html: string
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** The only inline markdown in the file is bold and bold-italic. */
function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
}

function roleOf(line: string, index: number): BlockRole {
  const wholeLineBold = /^\*\*[^*]+\*\*$/.test(line)
  if (!wholeLineBold) return 'body'
  if (index === 0) return 'label'
  if (index === 1) return 'title'
  return 'heading'
}

const SIZE: Record<BlockRole, TextSize> = {
  label: 'md',
  title: 'xl',
  heading: 'lg',
  body: 'md',
}

/** culture_manifesto.md split into one block per paragraph. */
export const manifestoBlocks: Block[] = raw
  .split(/\n\s*\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line, index) => {
    const role = roleOf(line, index)
    return { role, size: SIZE[role], html: inline(line) }
  })
