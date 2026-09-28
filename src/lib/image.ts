const MAX_SIDE = 1600

/** Any picked image → JPEG at most 1600px on the long side. Always re-encodes, so an SVG or other format never reaches the server. */
export async function toJpeg(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    // load, not decode(): Chrome holds decode() until a hidden tab is shown
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not read that image'))
      el.src = url
    })
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx || !canvas.width || !canvas.height) throw new Error('Could not read that image')
    ctx.fillStyle = '#fff' // transparent PNGs would turn black
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
    if (!jpeg) throw new Error('Could not read that image')
    return jpeg
  } finally {
    URL.revokeObjectURL(url)
  }
}
