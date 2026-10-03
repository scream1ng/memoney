/** A file drag the window should take: files, and no dialog (entry panel, category) open on top. */
export const acceptsDrop = (e: Pick<DragEvent, 'dataTransfer'>) =>
  !!e.dataTransfer?.types.includes('Files') && !document.querySelector('dialog[open]')
