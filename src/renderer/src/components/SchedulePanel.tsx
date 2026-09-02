import { useState } from 'react'
import { useEditor } from '../store'
import { uid } from '../model'
import type { NewsEntry, WeatherMap } from '../model'

// ============================================================
// 日程系统：开局日期 + 天气/地图规则 + 每日日报新闻
//   · 日期：公历 xxxx年x月x日，随着「结束今天」块推进
//   · 天气：晴天/下雨/下雪，由变量触发或随机出现，可绑定地图背景
//   · 新闻：每日日报的大小新闻，由变量触发或随机出现
// ============================================================

export default function SchedulePanel(): JSX.Element {
  const { project } = useEditor()
  const [tab, setTab] = useState<'date' | 'weather' | 'news'>('date')

  return (
    <div className="schedule-panel">
      <div className="schedule-tabs">
        <button className={'chip' + (tab === 'date' ? ' active' : '')} onClick={() => setTab('date')}>日期</button>
        <button className={'chip' + (tab === 'weather' ? ' active' : '')} onClick={() => setTab('weather')}>天气 / 地图</button>
        <button className={'chip' + (tab === 'news' ? ' active' : '')} onClick={() => setTab('news')}>日报新闻</button>
      </div>

      {tab === 'date' && <DateSection />}
      {tab === 'weather' && <WeatherSection />}
      {tab === 'news' && <NewsSection />}
    </div>
  )
}

// ---------- 日期 ----------

function DateSection(): JSX.Element {
  const { project, updateDateSystem } = useEditor()
  const d = project.dateSystem
  const set = (k: 'startYear' | 'startMonth' | 'startDay', v: number): void => {
    updateDateSystem({ [k]: v })
  }
  return (
    <div className="detail-panel">
      <div className="panel-title">开局日期</div>
      <div className="panel-section">
        <p className="hint-text">游戏开始时显示为「公历 xxxx年x月x日」，每天的日期由脚本里的「结束今天」块推进。</p>
        <div className="grid-3">
          <Field label="年">
            <input type="number" value={d.startYear} onChange={(e) => set('startYear', +e.target.value)} />
          </Field>
          <Field label="月">
            <input type="number" min={1} max={12} value={d.startMonth} onChange={(e) => set('startMonth', +e.target.value)} />
          </Field>
          <Field label="日">
            <input type="number" min={1} max={31} value={d.startDay} onChange={(e) => set('startDay', +e.target.value)} />
          </Field>
        </div>
        <div className="field-label" style={{ color: '#999' }}>
          预览：公历 {d.startYear}年{d.startMonth}月{d.startDay}日
        </div>
      </div>
    </div>
  )
}

// ---------- 天气 / 地图 ----------

function WeatherSection(): JSX.Element {
  const { project, addWeatherMap, updateWeatherMap, removeWeatherMap } = useEditor()
  const [selectedId, setSelectedId] = useState<string | null>(project.weatherMaps[0]?.id ?? null)
  const w = project.weatherMaps.find((x) => x.id === selectedId) ?? null

  const add = (): void => {
    const nw: WeatherMap = { id: uid('wm-'), name: '晴天', effect: 'sunny', triggerVariableId: '', weight: 50, mapImage: '' }
    addWeatherMap(nw)
    setSelectedId(nw.id)
  }

  return (
    <div className="split-panel">
      <div className="side-list">
        <div className="side-list-header">
          <span>天气 / 地图</span>
          <button className="btn btn-sm" onClick={add}>+ 新增</button>
        </div>
        {project.weatherMaps.map((x) => (
          <div key={x.id} className={'side-item' + (x.id === selectedId ? ' active' : '')} onClick={() => setSelectedId(x.id)}>
            <span className="side-item-name">{x.name}</span>
            <span className="side-item-meta">{effectLabel(x.effect)}</span>
            <button className="block-del" title="删除" onClick={(e) => { e.stopPropagation(); removeWeatherMap(x.id); if (selectedId === x.id) setSelectedId(null) }}>✕</button>
          </div>
        ))}
      </div>

      {w ? (
        <div className="detail-panel">
          <div className="panel-title">
            <input className="title-input" value={w.name} onChange={(e) => updateWeatherMap(w.id, { name: e.target.value })} />
            <button className="btn btn-sm btn-danger" onClick={() => { removeWeatherMap(w.id); setSelectedId(null) }}>删除</button>
          </div>
          <div className="panel-section">
            <Field label="视觉效果">
              <select value={w.effect} onChange={(e) => updateWeatherMap(w.id, { effect: e.target.value as WeatherMap['effect'] })}>
                <option value="sunny">晴天（无特效）</option>
                <option value="rain">下雨（雨幕）</option>
                <option value="snow">下雪（雪花）</option>
              </select>
            </Field>
            <Field label="触发变量（变量为真时强制该天气）">
              <select value={w.triggerVariableId} onChange={(e) => updateWeatherMap(w.id, { triggerVariableId: e.target.value })}>
                <option value="">（随机出现）</option>
                {project.variables.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </Field>
            <Field label="随机权重（0-100，越大越容易）">
              <input type="number" min={0} max={100} value={w.weight} onChange={(e) => updateWeatherMap(w.id, { weight: +e.target.value })} />
            </Field>
            <Field label="该天气地图背景（留空则不换地图）">
              <input value={w.mapImage} onChange={(e) => updateWeatherMap(w.id, { mapImage: e.target.value })} placeholder="背景图路径 / 图片标签" />
            </Field>
            <p className="hint-text">地图背景会随天气自动切换；在脚本里可用「设置场景」块覆盖为任意背景。</p>
          </div>
        </div>
      ) : (
        <div className="empty-state">选择或新增一个天气规则</div>
      )}
    </div>
  )
}

// ---------- 新闻 ----------

function NewsSection(): JSX.Element {
  const { project, addNews, updateNews, removeNews } = useEditor()
  const [selectedId, setSelectedId] = useState<string | null>(project.news[0]?.id ?? null)
  const n = project.news.find((x) => x.id === selectedId) ?? null

  const add = (): void => {
    const nn: NewsEntry = { id: uid('news-'), title: '新新闻', body: '新闻正文…', size: 'small', triggerVariableId: '', weight: 50 }
    addNews(nn)
    setSelectedId(nn.id)
  }

  return (
    <div className="split-panel">
      <div className="side-list">
        <div className="side-list-header">
          <span>日报新闻</span>
          <button className="btn btn-sm" onClick={add}>+ 新增</button>
        </div>
        {project.news.map((x) => (
          <div key={x.id} className={'side-item' + (x.id === selectedId ? ' active' : '')} onClick={() => setSelectedId(x.id)}>
            <span className="side-item-name">{x.title}</span>
            <span className="side-item-meta">{x.size === 'large' ? '大' : '小'}</span>
            <button className="block-del" title="删除" onClick={(e) => { e.stopPropagation(); removeNews(x.id); if (selectedId === x.id) setSelectedId(null) }}>✕</button>
          </div>
        ))}
      </div>

      {n ? (
        <div className="detail-panel">
          <div className="panel-title">
            <input className="title-input" value={n.title} onChange={(e) => updateNews(n.id, { title: e.target.value })} />
            <button className="btn btn-sm btn-danger" onClick={() => { removeNews(n.id); setSelectedId(null) }}>删除</button>
          </div>
          <div className="panel-section">
            <Field label="标题">
              <input value={n.title} onChange={(e) => updateNews(n.id, { title: e.target.value })} />
            </Field>
            <Field label="正文">
              <textarea rows={4} value={n.body} onChange={(e) => updateNews(n.id, { body: e.target.value })} />
            </Field>
            <Field label="新闻大小">
              <select value={n.size} onChange={(e) => updateNews(n.id, { size: e.target.value as NewsEntry['size'] })}>
                <option value="large">大新闻（醒目标题）</option>
                <option value="small">小新闻（次要条目）</option>
              </select>
            </Field>
            <Field label="触发变量（变量为真时出现）">
              <select value={n.triggerVariableId} onChange={(e) => updateNews(n.id, { triggerVariableId: e.target.value })}>
                <option value="">（随机出现）</option>
                {project.variables.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </Field>
            <Field label="随机权重（0-100，越大越容易）">
              <input type="number" min={0} max={100} value={n.weight} onChange={(e) => updateNews(n.id, { weight: +e.target.value })} />
            </Field>
            <p className="hint-text">每天结束时（「结束今天」块）会根据触发变量 + 权重生成当天的新闻。</p>
          </div>
        </div>
      ) : (
        <div className="empty-state">选择或新增一条新闻</div>
      )}
    </div>
  )
}

// ---------- 通用 ----------

function effectLabel(e: string): string {
  if (e === 'rain') return '🌧 下雨'
  if (e === 'snow') return '❄️ 下雪'
  return '☀️ 晴天'
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      {children}
    </div>
  )
}
