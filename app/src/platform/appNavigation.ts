import { registerPlugin } from '@capacitor/core'

const navigation = registerPlugin<{ confirmExit(): Promise<void> }>('AppNavigation')
export function confirmAppExit() { return navigation.confirmExit() }
