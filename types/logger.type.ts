export interface ILogger {
  level: TLoggerLevel
  message: string
  context: string
  timestamp: string
  pid: number
  slug: string
}

export type TLoggerLevel = 'error' | 'warn' | 'info' | 'debug'
