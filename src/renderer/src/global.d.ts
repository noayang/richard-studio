import type { IpcApi } from '../../shared/types'

declare global {
  interface Window {
    renpyStudio: IpcApi
  }
}

export {}
