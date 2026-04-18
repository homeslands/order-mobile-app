// Reexport the native module. On web, it will be resolved to NavigationTriggerModule.web.ts
// and on native platforms to NavigationTriggerModule.ts
export { default } from './src/NavigationTriggerModule'
export { default as NavigationTriggerView } from './src/NavigationTriggerView'
export * from './src/NavigationTrigger.types'
