import images from './image-map.json'
export function localImage(file: string): string { return (images as Record<string, string>)[file] ?? '' }
