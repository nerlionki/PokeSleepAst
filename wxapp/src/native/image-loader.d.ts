declare module '#image-loader' {
  export function loadModelChunk(name: string): Promise<{ path: string }>
  export function loadImageModule(name: string): Promise<Record<string, string>>
}
