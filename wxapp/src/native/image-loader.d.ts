declare module '#image-loader' {
  export function loadImageModule(name: string): Promise<Record<string, string>>
}
