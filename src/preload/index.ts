import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi, ProjectInfo } from '../shared/types'

const api: IpcApi = {
  openProject: () => ipcRenderer.invoke('project:open'),
  openProjectAt: (path: string) => ipcRenderer.invoke('project:openAt', path),
  readFile: (path: string) => ipcRenderer.invoke('project:readFile', path),
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke('project:writeFile', path, content),
  deletePath: (path: string) => ipcRenderer.invoke('project:delete', path),
  listDir: (path: string) => ipcRenderer.invoke('project:listDir', path),
  readImage: (path: string) => ipcRenderer.invoke('project:readImage', path),
  pickImages: () => ipcRenderer.invoke('assets:pickImages'),
  findImageFiles: (projectRoot: string) => ipcRenderer.invoke('project:findImages', projectRoot),
  getRenpyPath: () => ipcRenderer.invoke('renpy:findExe'),
  revealInExplorer: (path: string) => ipcRenderer.invoke('project:reveal', path),
  chooseProjectDir: () => ipcRenderer.invoke('assets:chooseDir'),
  getProjectDir: () => ipcRenderer.invoke('assets:getDir'),
  importAssets: (category: string) => ipcRenderer.invoke('assets:import', category),
  listAssets: () => ipcRenderer.invoke('assets:list'),
  listProjects: () => ipcRenderer.invoke('projects:list'),
  addProject: () => ipcRenderer.invoke('projects:add'),
  createProject: (parentDir: string, name: string) => ipcRenderer.invoke('projects:create', parentDir, name),
  removeProject: (path: string) => ipcRenderer.invoke('projects:remove', path),
  loadProject: (path: string) => ipcRenderer.invoke('projects:open', path),
  chooseDirectory: (title?: string) => ipcRenderer.invoke('dialog:chooseDir', title),
  pickAsset: (kind: string) => ipcRenderer.invoke('assets:pick', kind),
  onProjectOpened: (cb: (info: ProjectInfo) => void) => {
    const listener = (_e: unknown, info: ProjectInfo): void => cb(info)
    ipcRenderer.on('project:opened', listener)
    return () => ipcRenderer.removeListener('project:opened', listener)
  }
}

contextBridge.exposeInMainWorld('renpyStudio', api)

export type { IpcApi }
