import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { Project, UiScreen, UiElement, Block, Fragment, Chapter, Character, Scene, AssetItem, Achievement, DictionaryEntry, ThemeFonts, GameVariable, DateSystem, NewsEntry, WeatherMap, WorldMap, MapLocation } from './model'
import { createDefaultProject } from './defaults'
import { uid } from './model'

export type Tab = 'ui' | 'script' | 'characters' | 'achievements' | 'dictionary' | 'branch' | 'variables' | 'schedule' | 'map'

interface EditorState {
  project: Project
  activeTab: Tab
  selectedScreen: string
  selectedElementId: string | null
  selectedBlockId: string | null
  assets: AssetItem[]
  // 预览相关
  previewScreen: string
  playFromBlockId: string | null
  // 辞典弹窗
  activeDictTerm: string | null
  // 当前打开的项目根目录（null 表示尚未进入任何项目）
  currentProjectPath: string | null
}

interface EditorActions {
  setActiveTab(t: Tab): void
  setSelectedScreen(id: string): void
  setSelectedElement(id: string | null): void
  setSelectedBlock(id: string | null): void
  updateElement(screenId: string, elId: string, patch: Partial<UiElement>): void
  addElement(screenId: string, el: UiElement): void
  removeElement(screenId: string, elId: string): void
  addScreen(screen: UiScreen): void
  /** 更新某个界面（按 name 键） */
  updateScreen(name: string, patch: Partial<UiScreen>): void
  /** 把多个元素编成一组（锁定成组一起移动） */
  groupElements(screenId: string, elementIds: string[]): void
  /** 取消选中元素的编组 */
  ungroupElements(screenId: string, elementIds: string[]): void
  // 脚本
  addBlock(chapterId: string, fragmentId: string, block: Block): void
  updateBlock(chapterId: string, fragmentId: string, blockId: string, patch: Partial<Block>): void
  removeBlock(chapterId: string, fragmentId: string, blockId: string): void
  addChapter(c: Chapter): void
  removeChapter(id: string): void
  /** 用新解析结果整体替换某个章节（代码模式写回后刷新用） */
  replaceChapter(c: Chapter): void
  addFragment(chapterId: string, f: Fragment): void
  removeFragment(chapterId: string, fragmentId: string): void
  // 角色
  updateCharacter(id: string, patch: Partial<Character>): void
  addCharacter(c: Character): void
  removeCharacter(id: string): void
  // 场景
  addScene(s: Scene): void
  updateScene(id: string, patch: Partial<Scene>): void
  // 资产
  addAsset(a: AssetItem): void
  removeAsset(id: string): void
  setAssetCategory(id: string, category: AssetItem['category']): void
  /** 从磁盘加载归档资产，整体替换列表 */
  setAssets(list: AssetItem[]): void
  // 成就
  addAchievement(a: Achievement): void
  updateAchievement(id: string, patch: Partial<Achievement>): void
  removeAchievement(id: string): void
  // 辞典
  addDictionaryEntry(d: DictionaryEntry): void
  updateDictionaryEntry(id: string, patch: Partial<DictionaryEntry>): void
  removeDictionaryEntry(id: string): void
  // 变量
  addVariable(v: GameVariable): void
  updateVariable(id: string, patch: Partial<GameVariable>): void
  removeVariable(id: string): void
  // 日程系统（日期 / 日报 / 天气地图）
  updateDateSystem(patch: Partial<DateSystem>): void
  addNews(n: NewsEntry): void
  updateNews(id: string, patch: Partial<NewsEntry>): void
  removeNews(id: string): void
  addWeatherMap(w: WeatherMap): void
  updateWeatherMap(id: string, patch: Partial<WeatherMap>): void
  removeWeatherMap(id: string): void
  // 大地图
  updateWorldMap(patch: Partial<WorldMap>): void
  addLocation(l: MapLocation): void
  updateLocation(id: string, patch: Partial<MapLocation>): void
  removeLocation(id: string): void
  // 全局字体
  updateThemeFonts(patch: Partial<ThemeFonts>): void
  // 预览
  setPreviewScreen(s: string): void
  setPlayFromBlock(id: string | null): void
  setActiveDictTerm(termId: string | null): void
  // 项目
  loadProject(p: Project): void
  setCurrentProjectPath(path: string | null): void
}

type Ctx = EditorState & EditorActions

const C = createContext<Ctx | null>(null)

export function EditorProvider({ children }: { children: ReactNode }): JSX.Element {
  const [project, setProject] = useState<Project>(() => createDefaultProject())
  const [activeTab, setActiveTab] = useState<Tab>('ui')
  const [selectedScreen, setSelectedScreen] = useState<string>('dialogue-box')
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [previewScreen, setPreviewScreen] = useState<string>('dialogue-box')
  const [playFromBlockId, setPlayFromBlockId] = useState<string | null>(null)
  const [activeDictTerm, setActiveDictTerm] = useState<string | null>(null)
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null)

  const updateElement = useCallback((screenId: string, elId: string, patch: Partial<UiElement>) => {
    setProject((p) => {
      const screen = p.uiScreens[screenId]
      if (!screen) return p
      return {
        ...p,
        uiScreens: {
          ...p.uiScreens,
          [screenId]: {
            ...screen,
            elements: screen.elements.map((e) => (e.id === elId ? { ...e, ...patch } : e))
          }
        }
      }
    })
  }, [])

  const addElement = useCallback((screenId: string, el: UiElement) => {
    setProject((p) => {
      const screen = p.uiScreens[screenId]
      if (!screen) return p
      return {
        ...p,
        uiScreens: { ...p.uiScreens, [screenId]: { ...screen, elements: [...screen.elements, el] } }
      }
    })
  }, [])

  const removeElement = useCallback((screenId: string, elId: string) => {
    setProject((p) => {
      const screen = p.uiScreens[screenId]
      if (!screen) return p
      return {
        ...p,
        uiScreens: { ...p.uiScreens, [screenId]: { ...screen, elements: screen.elements.filter((e) => e.id !== elId) } }
      }
    })
  }, [])

  const addScreen = useCallback((screen: UiScreen) => {
    setProject((p) => ({ ...p, uiScreens: { ...p.uiScreens, [screen.name]: screen } }))
  }, [])

  const updateScreen = useCallback((name: string, patch: Partial<UiScreen>) => {
    setProject((p) => {
      const screen = p.uiScreens[name]
      if (!screen) return p
      return { ...p, uiScreens: { ...p.uiScreens, [name]: { ...screen, ...patch } } }
    })
  }, [])

  const groupElements = useCallback((screenId: string, elementIds: string[]) => {
    const groupId = uid('grp-')
    setProject((p) => {
      const screen = p.uiScreens[screenId]
      if (!screen) return p
      const set = new Set(elementIds)
      return {
        ...p,
        uiScreens: {
          ...p.uiScreens,
          [screenId]: {
            ...screen,
            elements: screen.elements.map((e) => (set.has(e.id) ? { ...e, groupId } : e))
          }
        }
      }
    })
  }, [])

  const ungroupElements = useCallback((screenId: string, elementIds: string[]) => {
    setProject((p) => {
      const screen = p.uiScreens[screenId]
      if (!screen) return p
      const set = new Set(elementIds)
      return {
        ...p,
        uiScreens: {
          ...p.uiScreens,
          [screenId]: {
            ...screen,
            elements: screen.elements.map((e) => (set.has(e.id) ? { ...e, groupId: undefined } : e))
          }
        }
      }
    })
  }, [])

  const addBlock = useCallback((chapterId: string, fragmentId: string, block: Block) => {
    setProject((p) => ({
      ...p,
      chapters: p.chapters.map((c) =>
        c.id === chapterId
          ? { ...c, fragments: c.fragments.map((f) => (f.id === fragmentId ? { ...f, blocks: [...f.blocks, block] } : f)) }
          : c
      )
    }))
  }, [])

  const updateBlock = useCallback((chapterId: string, fragmentId: string, blockId: string, patch: Partial<Block>) => {
    setProject((p) => ({
      ...p,
      chapters: p.chapters.map((c) =>
        c.id === chapterId
          ? {
              ...c,
              fragments: c.fragments.map((f) =>
                f.id === fragmentId
                  ? { ...f, blocks: f.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)) }
                  : f
              )
            }
          : c
      )
    }))
  }, [])

  const removeBlock = useCallback((chapterId: string, fragmentId: string, blockId: string) => {
    setProject((p) => ({
      ...p,
      chapters: p.chapters.map((c) =>
        c.id === chapterId
          ? { ...c, fragments: c.fragments.map((f) => (f.id === fragmentId ? { ...f, blocks: f.blocks.filter((b) => b.id !== blockId) } : f)) }
          : c
      )
    }))
  }, [])

  const addChapter = useCallback((c: Chapter) => {
    setProject((p) => ({ ...p, chapters: [...p.chapters, c], chapterOrder: [...p.chapterOrder, c.id] }))
  }, [])

  const removeChapter = useCallback((id: string) => {
    setProject((p) => ({
      ...p,
      chapters: p.chapters.filter((c) => c.id !== id),
      chapterOrder: p.chapterOrder.filter((x) => x !== id)
    }))
  }, [])

  const replaceChapter = useCallback((c: Chapter) => {
    setProject((p) => ({ ...p, chapters: p.chapters.map((x) => (x.id === c.id ? c : x)) }))
  }, [])

  const addFragment = useCallback((chapterId: string, f: Fragment) => {
    setProject((p) => ({
      ...p,
      chapters: p.chapters.map((c) => (c.id === chapterId ? { ...c, fragments: [...c.fragments, f] } : c))
    }))
  }, [])

  const removeFragment = useCallback((chapterId: string, fragmentId: string) => {
    setProject((p) => ({
      ...p,
      chapters: p.chapters.map((c) =>
        c.id === chapterId ? { ...c, fragments: c.fragments.filter((f) => f.id !== fragmentId) } : c
      )
    }))
  }, [])

  const updateCharacter = useCallback((id: string, patch: Partial<Character>) => {
    setProject((p) => ({ ...p, characters: p.characters.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))
  }, [])

  const addCharacter = useCallback((c: Character) => {
    setProject((p) => ({ ...p, characters: [...p.characters, c] }))
  }, [])

  const removeCharacter = useCallback((id: string) => {
    setProject((p) => ({ ...p, characters: p.characters.filter((c) => c.id !== id) }))
  }, [])

  const addScene = useCallback((s: Scene) => {
    setProject((p) => ({ ...p, scenes: [...p.scenes, s] }))
  }, [])

  const updateScene = useCallback((id: string, patch: Partial<Scene>) => {
    setProject((p) => ({ ...p, scenes: p.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))
  }, [])

  const addAsset = useCallback((a: AssetItem) => {
    setAssets((prev) => [...prev, a])
  }, [])

  const removeAsset = useCallback((id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const setAssetCategory = useCallback((id: string, category: AssetItem['category']) => {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, category } : a)))
  }, [])

  const setAssetsList = useCallback((list: AssetItem[]) => {
    setAssets(list)
  }, [])

  const addAchievement = useCallback((a: Achievement) => {
    setProject((p) => ({ ...p, achievements: [...p.achievements, a] }))
  }, [])

  const updateAchievement = useCallback((id: string, patch: Partial<Achievement>) => {
    setProject((p) => ({ ...p, achievements: p.achievements.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))
  }, [])

  const removeAchievement = useCallback((id: string) => {
    setProject((p) => ({ ...p, achievements: p.achievements.filter((a) => a.id !== id) }))
  }, [])

  const addDictionaryEntry = useCallback((d: DictionaryEntry) => {
    setProject((p) => ({ ...p, dictionary: [...p.dictionary, d] }))
  }, [])

  const updateDictionaryEntry = useCallback((id: string, patch: Partial<DictionaryEntry>) => {
    setProject((p) => ({ ...p, dictionary: p.dictionary.map((d) => (d.id === id ? { ...d, ...patch } : d)) }))
  }, [])

  const removeDictionaryEntry = useCallback((id: string) => {
    setProject((p) => ({ ...p, dictionary: p.dictionary.filter((d) => d.id !== id) }))
  }, [])

  const addVariable = useCallback((v: GameVariable) => {
    setProject((p) => ({ ...p, variables: [...p.variables, v] }))
  }, [])

  const updateVariable = useCallback((id: string, patch: Partial<GameVariable>) => {
    setProject((p) => ({ ...p, variables: p.variables.map((v) => (v.id === id ? { ...v, ...patch } : v)) }))
  }, [])

  const removeVariable = useCallback((id: string) => {
    setProject((p) => ({ ...p, variables: p.variables.filter((v) => v.id !== id) }))
  }, [])

  const updateDateSystem = useCallback((patch: Partial<DateSystem>) => {
    setProject((p) => ({ ...p, dateSystem: { ...p.dateSystem, ...patch } }))
  }, [])

  const addNews = useCallback((n: NewsEntry) => {
    setProject((p) => ({ ...p, news: [...p.news, n] }))
  }, [])

  const updateNews = useCallback((id: string, patch: Partial<NewsEntry>) => {
    setProject((p) => ({ ...p, news: p.news.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
  }, [])

  const removeNews = useCallback((id: string) => {
    setProject((p) => ({ ...p, news: p.news.filter((x) => x.id !== id) }))
  }, [])

  const addWeatherMap = useCallback((w: WeatherMap) => {
    setProject((p) => ({ ...p, weatherMaps: [...p.weatherMaps, w] }))
  }, [])

  const updateWeatherMap = useCallback((id: string, patch: Partial<WeatherMap>) => {
    setProject((p) => ({ ...p, weatherMaps: p.weatherMaps.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
  }, [])

  const removeWeatherMap = useCallback((id: string) => {
    setProject((p) => ({ ...p, weatherMaps: p.weatherMaps.filter((x) => x.id !== id) }))
  }, [])

  const updateWorldMap = useCallback((patch: Partial<WorldMap>) => {
    setProject((p) => ({ ...p, worldMap: { ...p.worldMap, ...patch } }))
  }, [])

  const addLocation = useCallback((l: MapLocation) => {
    setProject((p) => ({ ...p, worldMap: { ...p.worldMap, locations: [...p.worldMap.locations, l] } }))
  }, [])

  const updateLocation = useCallback((id: string, patch: Partial<MapLocation>) => {
    setProject((p) => ({
      ...p,
      worldMap: {
        ...p.worldMap,
        locations: p.worldMap.locations.map((x) => (x.id === id ? { ...x, ...patch } : x))
      }
    }))
  }, [])

  const removeLocation = useCallback((id: string) => {
    setProject((p) => ({
      ...p,
      worldMap: {
        ...p.worldMap,
        locations: p.worldMap.locations.filter((x) => x.id !== id),
        playerLocationId: p.worldMap.playerLocationId === id ? '' : p.worldMap.playerLocationId
      }
    }))
  }, [])

  const updateThemeFonts = useCallback((patch: Partial<ThemeFonts>) => {
    setProject((p) => ({ ...p, themeFonts: { ...p.themeFonts, ...patch } }))
  }, [])

  const loadProject = useCallback((p: Project) => {
    setProject(p)
  }, [])

  const value: Ctx = {
    project,
    activeTab,
    selectedScreen,
    selectedElementId,
    selectedBlockId,
    assets,
    previewScreen,
    playFromBlockId,
    activeDictTerm,
    currentProjectPath,
    setActiveTab,
    setSelectedScreen,
    setSelectedElement: setSelectedElementId,
    setSelectedBlock: setSelectedBlockId,
    updateElement,
    addElement,
    removeElement,
    addScreen,
    updateScreen,
    groupElements,
    ungroupElements,
    addBlock,
    updateBlock,
    removeBlock,
    addChapter,
    removeChapter,
    replaceChapter,
    addFragment,
    removeFragment,
    updateCharacter,
    addCharacter,
    removeCharacter,
    addScene,
    updateScene,
    addAsset,
    removeAsset,
    setAssetCategory,
    setAssets: setAssetsList,
    addAchievement,
    updateAchievement,
    removeAchievement,
    addDictionaryEntry,
    updateDictionaryEntry,
    removeDictionaryEntry,
    addVariable,
    updateVariable,
    removeVariable,
    updateDateSystem,
    addNews,
    updateNews,
    removeNews,
    addWeatherMap,
    updateWeatherMap,
    removeWeatherMap,
    updateWorldMap,
    addLocation,
    updateLocation,
    removeLocation,
    updateThemeFonts,
    loadProject,
    setCurrentProjectPath,
    setPreviewScreen,
    setPlayFromBlock: setPlayFromBlockId,
    setActiveDictTerm
  }

  return <C.Provider value={value}>{children}</C.Provider>
}

export function useEditor(): Ctx {
  const ctx = useContext(C)
  if (!ctx) throw new Error('useEditor must be used within EditorProvider')
  return ctx
}

export { uid }
