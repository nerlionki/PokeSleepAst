declare module '#image-loader' {
  export function loadModelChunk(name: string): Promise<{ path: string }>
  export function loadImageModule(name: string): Promise<Record<string, string>>
}

declare module '#i18n-loader' {
  export function load(): Promise<{
    gameLabel(name: string): string
    translate(catalog: unknown, language: string, key: string, values?: Readonly<Record<string, string | number>>, scope?: string): string
    hasInterfaceTranslations(catalog: unknown, language: string): boolean
  }>
}
