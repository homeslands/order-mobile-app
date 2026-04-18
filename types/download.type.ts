export interface IDownloadStore {
  progress: number
  fileName: string
  isDownloading: boolean
  setProgress: (progress: number) => void
  setFileName: (fileName: string) => void
  setIsDownloading: (isDownloading: boolean) => void
  reset: () => void
}
