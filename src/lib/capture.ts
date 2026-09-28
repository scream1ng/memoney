/** One-slot handoff from the + menu to the Add sheet it opens. The file or mic stream is
 *  obtained inside the menu tap (iOS needs a user gesture), then read by the sheet. */
export type Capture = { kind: 'image'; file: File } | { kind: 'audio'; stream: Promise<MediaStream> }

let slot: Capture | undefined

export function setCapture(c: Capture) {
  slot = c
}

/** Not destructive: StrictMode runs initializers twice in dev. The sheet clears it on close. */
export const peekCapture = () => slot

export function clearCapture() {
  slot = undefined
}
