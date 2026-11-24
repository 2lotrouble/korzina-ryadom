// Картинка «Я участвую» для соцсетей: рисуется в браузере, ничего никуда не загружается.

const W = 1200
const H = 630
const FONT = "'Golos Text Variable', 'Golos Text', system-ui, sans-serif"

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

export async function makeShareImage(options: { portions: number; portionsWord: string; campaign: string; site: string }): Promise<Blob> {
  await document.fonts?.ready
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#faf7f1'
  ctx.fillRect(0, 0, W, H)

  // тёплые круги в углу вместо иллюстрации
  for (const [x, y, r, color] of [
    [1060, 120, 220, '#f6c453'],
    [1180, 380, 160, '#e4572e'],
    [930, 560, 130, '#1f8a4c'],
  ] as [number, number, number, string][]) {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }

  ctx.fillStyle = '#166b3a'
  ctx.font = `600 28px ${FONT}`
  ctx.fillText(`АКЦИЯ «${options.campaign.toUpperCase()}»`, 72, 104)

  ctx.fillStyle = '#1f2a24'
  ctx.font = `700 76px ${FONT}`
  let y = 204
  for (const line of wrap(ctx, 'Я покупаю на одну пачку больше', 760)) {
    ctx.fillText(line, 72, y)
    y += 86
  }

  if (options.portions > 0) {
    const label = `≈ ${options.portions} ${options.portionsWord} еды`
    ctx.font = `700 44px ${FONT}`
    const width = ctx.measureText(label).width + 56
    ctx.fillStyle = '#1f2a24'
    ctx.beginPath()
    ctx.roundRect(72, y - 22, width, 76, 38)
    ctx.fill()
    ctx.fillStyle = '#f6c453'
    ctx.fillText(label, 100, y + 31)
    y += 108
  }

  ctx.fillStyle = '#4b554f'
  ctx.font = `400 32px ${FONT}`
  for (const line of wrap(ctx, 'для пожилых людей и семей с детьми, которым сейчас непросто', 720)) {
    ctx.fillText(line, 72, y + 16)
    y += 42
  }

  ctx.fillStyle = '#1f2a24'
  ctx.font = `600 30px ${FONT}`
  ctx.fillText(`Найдите магазин рядом: ${options.site}`, 72, H - 56)

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Не получилось нарисовать картинку'))), 'image/png'))
}
