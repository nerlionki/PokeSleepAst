declare const __APP_VERSION__: string
declare function defineAppConfig(config: Record<string, unknown>): Record<string, unknown>
declare module '*.vue' { import type { DefineComponent } from 'vue'; const component: DefineComponent; export default component }
declare module '*.css'
