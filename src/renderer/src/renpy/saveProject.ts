import type { Project } from '../model'
import { exportCharacters, exportChapter, exportScreens, exportAchievements, exportScenes, exportDictionary, exportVariables, exportRuntime, exportShop, exportGallery, exportDateSystem, exportWorldMap } from './exportRenpy'

// ============================================================
// 把内存里的项目整体写回磁盘 .rpy 文件（自动保存 / 手动保存共用）
//   · 角色定义 -> game/characters.rpy
//   · 界面 screen -> game/screens.rpy
//   · 成就 -> game/achievements.rpy
//   · 场景 -> game/scenes.rpy
//   · 辞典 -> game/dictionary.rpy
//   · 每个章节 -> 各自的 .rpy 文件（只写含 label 的章节，避免覆盖
//     screens/gui/options 等没有 label 的框架文件）
// ============================================================

function joinWin(a: string, b: string): string {
  return a.replace(/[\\/]+$/, '') + '\\' + b
}

export async function saveProject(project: Project, projectPath: string): Promise<void> {
  const gameDir = joinWin(projectPath, 'game')

  await window.renpyStudio.writeFile(joinWin(gameDir, 'characters.rpy'), exportCharacters(project) + '\n')
  await window.renpyStudio.writeFile(joinWin(gameDir, 'screens.rpy'), exportScreens(project) + '\n')
  if (project.achievements.length > 0) {
    await window.renpyStudio.writeFile(joinWin(gameDir, 'achievements.rpy'), exportAchievements(project) + '\n')
  }
  if (project.scenes.length > 0) {
    await window.renpyStudio.writeFile(joinWin(gameDir, 'scenes.rpy'), exportScenes(project) + '\n')
  }
  if (project.dictionary.length > 0) {
    await window.renpyStudio.writeFile(joinWin(gameDir, 'dictionary.rpy'), exportDictionary(project) + '\n')
  }
  if (project.variables.length > 0) {
    await window.renpyStudio.writeFile(joinWin(gameDir, 'variables.rpy'), exportVariables(project) + '\n')
  }
  await window.renpyStudio.writeFile(joinWin(gameDir, 'runtime.rpy'), exportRuntime(project) + '\n')
  await window.renpyStudio.writeFile(joinWin(gameDir, 'shop.rpy'), exportShop() + '\n')
  if (project.scenes.length > 0) {
    await window.renpyStudio.writeFile(joinWin(gameDir, 'gallery.rpy'), exportGallery(project) + '\n')
  }
  await window.renpyStudio.writeFile(joinWin(gameDir, 'datesystem.rpy'), exportDateSystem(project) + '\n')
  await window.renpyStudio.writeFile(joinWin(gameDir, 'worldmap.rpy'), exportWorldMap(project) + '\n')

  // 章节：只写含 label 的，避免破坏 screens.rpy / gui.rpy / options.rpy
  for (const ch of project.chapters) {
    if (ch.filePath && ch.fragments.length > 0) {
      await window.renpyStudio.writeFile(ch.filePath, exportChapter(ch, project) + '\n')
    }
  }
}
