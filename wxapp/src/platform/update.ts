// Shared Android-only UpdateSettings is excluded from WeChat generated views.
export function useUpdateStore() { return { supported: false, currentVersion: '1.0.3', busy: false, phase: 'idle', message: '', check: async () => {} } }
