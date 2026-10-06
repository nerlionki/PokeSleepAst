const localImages = import.meta.glob('../../../core/src/assets/imgs/**/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const imageByFile = new Map<string, string>()
for (const [key, url] of Object.entries(localImages)) {
  const file = key.split('assets/imgs/')[1]
  if (file) imageByFile.set(file, url)
}

export function localImage(file: string): string {
  return imageByFile.get(file) ?? ''
}

