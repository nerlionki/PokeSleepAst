export function normalizedCorrelation(left: Float32Array, right: Float32Array): number {
  const length = Math.min(left.length, right.length)
  if (!length) return 0
  let meanLeft = 0
  let meanRight = 0
  for (let i = 0; i < length; i++) {
    meanLeft += left[i] ?? 0
    meanRight += right[i] ?? 0
  }
  meanLeft /= length
  meanRight /= length
  let dot = 0
  let leftSq = 0
  let rightSq = 0
  for (let i = 0; i < length; i++) {
    const a = (left[i] ?? 0) - meanLeft
    const b = (right[i] ?? 0) - meanRight
    dot += a * b
    leftSq += a * a
    rightSq += b * b
  }
  if (leftSq === 0 || rightSq === 0) return 0
  return dot / Math.sqrt(leftSq * rightSq)
}

/** 图标黑底不参与比较，只对角色本身。 */
export function maskedCorrelation(sample: Float32Array, icon: Float32Array, floor = 0.08): number {
  let count = 0
  let meanSample = 0
  let meanIcon = 0
  for (let i = 0; i < icon.length; i++) {
    if ((icon[i] ?? 0) < floor) continue
    count += 1
    meanSample += sample[i] ?? 0
    meanIcon += icon[i] ?? 0
  }
  if (count < 8) return 0
  meanSample /= count
  meanIcon /= count
  let dot = 0
  let leftSq = 0
  let rightSq = 0
  for (let i = 0; i < icon.length; i++) {
    if ((icon[i] ?? 0) < floor) continue
    const a = (sample[i] ?? 0) - meanSample
    const b = (icon[i] ?? 0) - meanIcon
    dot += a * b
    leftSq += a * a
    rightSq += b * b
  }
  if (leftSq === 0 || rightSq === 0) return 0
  return dot / Math.sqrt(leftSq * rightSq)
}

/** 颜色误差要够低，并且比第二名更低一截。否则视为没对上。 */
export function pickClosest(scores: { id: number, score: number }[], threshold = 46, margin = 3.2): number | null {
  const sorted = [...scores].sort((a, b) => a.score - b.score)
  const top = sorted[0]
  if (!top || top.score > threshold) return null
  const second = sorted[1]
  if (second && second.score - top.score < margin) return null
  return top.id
}

/** 最高分要过门槛，并且拉开第二名。否则视为没对上。 */
export function pickBest(scores: { id: number, score: number }[], threshold = 0.45, margin = 0.08): number | null {
  const sorted = [...scores].sort((a, b) => b.score - a.score)
  const top = sorted[0]
  if (!top || top.score < threshold) return null
  const second = sorted[1]
  if (second && top.score - second.score < margin) return null
  return top.id
}

export function grayscale(data: Uint8ClampedArray, width: number, height: number, size = 32): Float32Array {
  const out = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    const sy = Math.min(height - 1, Math.floor((y + 0.5) * height / size))
    for (let x = 0; x < size; x++) {
      const sx = Math.min(width - 1, Math.floor((x + 0.5) * width / size))
      const i = (sy * width + sx) * 4
      out[y * size + x] = ((data[i] ?? 0) * 0.299 + (data[i + 1] ?? 0) * 0.587 + (data[i + 2] ?? 0) * 0.114) / 255
    }
  }
  return out
}

export interface PixelImage {
  data: Uint8ClampedArray
  width: number
  height: number
}

export function crop(image: PixelImage, x: number, y: number, width: number, height: number): PixelImage {
  const left = Math.max(0, Math.floor(x))
  const top = Math.max(0, Math.floor(y))
  const right = Math.min(image.width, Math.ceil(x + width))
  const bottom = Math.min(image.height, Math.ceil(y + height))
  const w = Math.max(1, right - left)
  const h = Math.max(1, bottom - top)
  const data = new Uint8ClampedArray(w * h * 4)
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const src = ((top + row) * image.width + left + col) * 4
      const dst = (row * w + col) * 4
      data[dst] = image.data[src] ?? 0
      data[dst + 1] = image.data[src + 1] ?? 0
      data[dst + 2] = image.data[src + 2] ?? 0
      data[dst + 3] = image.data[src + 3] ?? 255
    }
  }
  return { data, width: w, height: h }
}

function isCream(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const sat = max === 0 ? 0 : (max - min) / max
  return max > 190 && sat < 0.2 && r > 170 && g > 150 && r + g > b * 2.1
}

function isDisk(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max > 230 && min > 210 && (max - min) >= 8 && (max - min) <= 28 && b + 4 < r && b < 248
}

/** 头像圆盘是略偏黄的浅色，和白卡片、橙色描边分开。裁到这颗圆里。 */
export function diskCrop(image: PixelImage): PixelImage {
  const disk = new Uint8Array(image.width * image.height)
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4
      if (isDisk(image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0)) disk[y * image.width + x] = 1
    }
  }
  const points: Array<[number, number]> = []
  for (let y = 2; y < image.height - 2; y++) {
    for (let x = 2; x < image.width - 2; x++) {
      if (!disk[y * image.width + x]) continue
      let count = 0
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) count += disk[(y + dy) * image.width + x + dx] ?? 0
      }
      if (count >= 14) points.push([x, y])
    }
  }
  if (points.length < 40) return image
  const cx = points.reduce((sum, point) => sum + point[0], 0) / points.length
  const cy = points.reduce((sum, point) => sum + point[1], 0) / points.length
  const radii = points.map(([x, y]) => Math.hypot(x - cx, y - cy)).sort((a, b) => a - b)
  const radius = radii[Math.floor(radii.length * 0.9)] ?? 0
  if (radius < 8) return image
  const left = Math.max(0, Math.floor(cx - radius))
  const top = Math.max(0, Math.floor(cy - radius))
  const right = Math.min(image.width, Math.ceil(cx + radius))
  const bottom = Math.min(image.height, Math.ceil(cy + radius))
  const width = Math.max(1, right - left)
  const height = Math.max(1, bottom - top)
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dst = (y * width + x) * 4
      const px = left + x
      const py = top + y
      if (Math.hypot(px - cx, py - cy) > radius) {
        data[dst] = 255
        data[dst + 1] = 252
        data[dst + 2] = 236
        data[dst + 3] = 255
        continue
      }
      const src = (py * image.width + px) * 4
      data[dst] = image.data[src] ?? 0
      data[dst + 1] = image.data[src + 1] ?? 0
      data[dst + 2] = image.data[src + 2] ?? 0
      data[dst + 3] = 255
    }
  }
  return { data, width, height }
}

export function trimOpaque(image: PixelImage, alpha = 40): PixelImage {
  let minX = image.width
  let minY = image.height
  let maxX = 0
  let maxY = 0
  let found = false
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if ((image.data[(y * image.width + x) * 4 + 3] ?? 0) < alpha) continue
      found = true
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (!found) return image
  return crop(image, minX, minY, maxX - minX + 1, maxY - minY + 1)
}

export function resizeRgba(image: PixelImage, width: number, height: number): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    const sy = Math.max(0, (y + 0.5) * image.height / height - 0.5)
    const y0 = Math.min(image.height - 1, Math.floor(sy))
    const y1 = Math.min(image.height - 1, y0 + 1)
    const fy = sy - y0
    for (let x = 0; x < width; x++) {
      const sx = Math.max(0, (x + 0.5) * image.width / width - 0.5)
      const x0 = Math.min(image.width - 1, Math.floor(sx))
      const x1 = Math.min(image.width - 1, x0 + 1)
      const fx = sx - x0
      const dst = (y * width + x) * 4
      for (let channel = 0; channel < 4; channel++) {
        const p00 = image.data[(y0 * image.width + x0) * 4 + channel] ?? 0
        const p10 = image.data[(y0 * image.width + x1) * 4 + channel] ?? 0
        const p01 = image.data[(y1 * image.width + x0) * 4 + channel] ?? 0
        const p11 = image.data[(y1 * image.width + x1) * 4 + channel] ?? 0
        data[dst + channel] = p00 * (1 - fx) * (1 - fy) + p10 * fx * (1 - fy) + p01 * (1 - fx) * fy + p11 * fx * fy
      }
    }
  }
  return { data, width, height }
}

/** 数量文字位于食材图标右下方，向左移回图标中心后再裁。 */
export function ingredientIconCrop(
  image: PixelImage,
  mark: { x: number, y: number, width: number, height: number },
  gap: number,
): PixelImage {
  const size = Math.max(mark.height * 2.6, gap * 0.62)
  const cx = mark.x + mark.width / 2 - size * 0.38
  return crop(image, cx - size / 2, mark.y - size, size, size * 0.92)
}

function largestForegroundAspect(image: PixelImage): number | null {
  const seen = new Uint8Array(image.width * image.height)
  let bestCount = 0
  let bestAspect: number | null = null
  for (let sy = 1; sy < image.height - 1; sy++) {
    for (let sx = 1; sx < image.width - 1; sx++) {
      const start = sy * image.width + sx
      if (seen[start]) continue
      const si = start * 4
      if (isCream(image.data[si] ?? 0, image.data[si + 1] ?? 0, image.data[si + 2] ?? 0)) continue
      const queue = [start]
      seen[start] = 1
      let cursor = 0
      let count = 0
      let minX = sx
      let maxX = sx
      let minY = sy
      let maxY = sy
      while (cursor < queue.length) {
        const point = queue[cursor++]!
        const x = point % image.width
        const y = Math.floor(point / image.width)
        count++
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
        for (const next of [point - 1, point + 1, point - image.width, point + image.width]) {
          if (next < 0 || next >= seen.length || seen[next]) continue
          const nx = next % image.width
          const ny = Math.floor(next / image.width)
          if (nx <= 0 || nx >= image.width - 1 || ny <= 0 || ny >= image.height - 1) continue
          const ni = next * 4
          if (isCream(image.data[ni] ?? 0, image.data[ni + 1] ?? 0, image.data[ni + 2] ?? 0)) continue
          seen[next] = 1
          queue.push(next)
        }
      }
      if (count > bestCount) {
        bestCount = count
        bestAspect = (maxX - minX + 1) / Math.max(1, maxY - minY + 1)
      }
    }
  }
  return bestCount >= 8 ? bestAspect : null
}

function ingredientShapeScore(shot: PixelImage, template: PixelImage): number {
  const canvas = resizeRgba(shot, 64, 64)
  let best = -1
  for (const scale of [0.55, 0.65, 0.75, 0.85, 0.95]) {
    const size = Math.round(64 * scale)
    const ref = resizeRgba(template, size, size)
    const icon = grayscale(ref.data, ref.width, ref.height)
    for (let y = 0; y <= 64 - size; y += 2) {
      for (let x = 0; x <= 64 - size; x += 2) {
        const region = crop(canvas, x, y, size, size)
        best = Math.max(best, maskedCorrelation(grayscale(region.data, region.width, region.height), icon))
      }
    }
  }
  return best
}

/** 食材图标可能是灰色未解锁态；轮廓相关性为主，前景宽高比用于分开油瓶和洋芋。 */
export function matchIngredientSprite(shot: PixelImage, refs: { id: number, image: PixelImage }[]): number | null {
  const shotAspect = largestForegroundAspect(shot)
  const ranked = refs.map((ref) => {
    const shape = ingredientShapeScore(shot, ref.image)
    const refAspect = ref.image.width / Math.max(1, ref.image.height)
    const aspectPenalty = shotAspect == null ? 0 : Math.abs(shotAspect - refAspect) * 30
    return { id: ref.id, score: shape * 100 - aspectPenalty }
  }).sort((a, b) => b.score - a.score)
  return ranked[0]?.id ?? null
}

function colorError(shot: PixelImage, ref: PixelImage, ox: number, oy: number): number {
  let count = 0
  let error = 0
  for (let y = 0; y < ref.height; y++) {
    for (let x = 0; x < ref.width; x++) {
      const ri = (y * ref.width + x) * 4
      if ((ref.data[ri + 3] ?? 0) < 80) continue
      const si = ((oy + y) * shot.width + ox + x) * 4
      const sr = shot.data[si] ?? 0
      const sg = shot.data[si + 1] ?? 0
      const sb = shot.data[si + 2] ?? 0
      error += isCream(sr, sg, sb)
        ? 270
        : Math.abs(sr - (ref.data[ri] ?? 0)) + Math.abs(sg - (ref.data[ri + 1] ?? 0)) + Math.abs(sb - (ref.data[ri + 2] ?? 0))
      count++
    }
  }
  return count < 8 ? 999 : error / count / 3
}

function chromaHist(image: PixelImage, respectAlpha: boolean): Float32Array {
  const bins = new Float32Array(64)
  let count = 0
  for (let i = 0; i < image.data.length; i += 4) {
    if (respectAlpha && (image.data[i + 3] ?? 0) < 40) continue
    const r = image.data[i] ?? 0
    const g = image.data[i + 1] ?? 0
    const b = image.data[i + 2] ?? 0
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if (max === 0 || (max - min) / max < 0.28) continue
    const bin = (Math.min(3, r >> 6) << 4) + (Math.min(3, g >> 6) << 2) + Math.min(3, b >> 6)
    bins[bin] = (bins[bin] ?? 0) + 1
    count++
  }
  if (count) {
    for (let i = 0; i < bins.length; i++) bins[i] = (bins[i] ?? 0) / count
  }
  return bins
}

function chromaDistance(left: Float32Array, right: Float32Array): number {
  let distance = 0
  for (let i = 0; i < left.length; i++) distance += Math.abs((left[i] ?? 0) - (right[i] ?? 0))
  return distance
}

function rawSpriteScores<T extends { id: number, image: PixelImage }>(shot: PixelImage, portraits: T[]): Array<{ portrait: T, score: number }> {
  const canvas = resizeRgba(shot, 64, 64)
  const shotChroma = chromaHist(canvas, false)
  const scores: Array<{ portrait: T, score: number }> = []
  for (const portrait of portraits) {
    const tint = chromaDistance(shotChroma, chromaHist(portrait.image, true)) * 3
    let best = 999
    for (const scale of [0.46, 0.58, 0.7, 0.82]) {
      const tw = Math.max(10, Math.round(64 * scale))
      const th = Math.max(10, Math.round(tw * portrait.image.height / Math.max(1, portrait.image.width)))
      if (th >= 64 || tw >= 64) continue
      const ref = resizeRgba(portrait.image, tw, th)
      for (let y = 0; y <= 64 - th; y += 3) {
        for (let x = 0; x <= 64 - tw; x += 3) {
          const score = colorError(canvas, ref, x, y)
          if (score < best) best = score
        }
      }
    }
    scores.push({ portrait, score: best + tint })
  }
  return scores
}

export interface PortraitScore {
  id: number
  shiny: boolean
  score: number
}

/** 保留普通/异色模板来源；选定宝可梦后才能据此写入异色标记。 */
export function portraitScores(
  shot: PixelImage,
  portraits: { id: number, shiny: boolean, image: PixelImage }[],
): PortraitScore[] {
  return rawSpriteScores(shot, portraits)
    .map(({ portrait, score }) => ({ id: portrait.id, shiny: portrait.shiny, score }))
    .sort((a, b) => a.score - b.score)
}

/** 宝可梦识别仍只比较每个宝可梦表现最好的普通/异色模板。 */
export function speciesScores(scores: PortraitScore[]): { id: number, score: number }[] {
  const bestById = new Map<number, number>()
  for (const row of scores) {
    const previous = bestById.get(row.id)
    if (previous == null || row.score < previous) bestById.set(row.id, row.score)
  }
  return [...bestById.entries()].map(([id, score]) => ({ id, score })).sort((a, b) => a.score - b.score)
}

export function bestPortraitVariant(scores: PortraitScore[], id: number): PortraitScore | null {
  return scores.filter((row) => row.id === id).sort((a, b) => a.score - b.score)[0] ?? null
}

/** 在头像圆盘里滑动立绘，按颜色误差找宝可梦。立绘需要带着透明底。 */
export function spriteScores(shot: PixelImage, portraits: { id: number, image: PixelImage }[]): { id: number, score: number }[] {
  const scores = rawSpriteScores(shot, portraits).map(({ portrait, score }) => ({ id: portrait.id, score }))
  const bestById = new Map<number, number>()
  for (const row of scores) {
    const previous = bestById.get(row.id)
    if (previous == null || row.score < previous) bestById.set(row.id, row.score)
  }
  return [...bestById.entries()].map(([id, score]) => ({ id, score })).sort((a, b) => a.score - b.score)
}

/** 最好的几只分数贴在一起。调用方再用主技能和食材把它们分开。 */
export function similarScores(scores: { id: number, score: number }[], threshold = 76, margin = 6): { id: number, score: number }[] {
  const top = scores[0]
  if (!top || top.score > threshold) return []
  const close = scores.filter((row) => row.score <= threshold && row.score - top.score < margin)
  return close.length >= 2 ? close : []
}

export function matchSprite(shot: PixelImage, portraits: { id: number, image: PixelImage }[]): number | null {
  return pickClosest(spriteScores(shot, portraits))
}
