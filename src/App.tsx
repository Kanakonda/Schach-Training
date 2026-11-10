import { useEffect, useState } from 'react'
import { allOpenings, useStore } from './lib/store'
import type { Line } from './lib/types'
import Trainer from './Trainer'
import { OpeningsView, RepertoireView, StatsView, TrainView, type Item } from './views/Lists'
import OpeningDetail from './views/OpeningDetail'

type Tab = 'openings' | 'repertoire' | 'train' | 'stats'

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'openings', icon: '♞', label: 'Eröffnungen' },
  { id: 'repertoire', icon: '✎', label: 'Repertoire' },
  { id: 'train', icon: '↻', label: 'Training' },
  { id: 'stats', icon: '▤', label: 'Statistik' },
]

interface Session {
  items: Item[]
  index: number
  start: 'watch' | 'play'
}

export default function App() {
  const store = useStore()
  const [tab, setTab] = useState<Tab>('openings')
  const [openId, setOpenId] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab, openId, session?.index, session === null])
  const now = Date.now()
  const dueCount = Object.values(store.progress).filter((p) => p.due <= now).length

  if (session) {
    const item = session.items[session.index]
    return (
      <Trainer
        key={session.index}
        opening={item.opening}
        line={item.line}
        start={session.start}
        position={`${session.index + 1}/${session.items.length}`}
        hasNext={session.index + 1 < session.items.length}
        onNext={() => setSession({ ...session, index: session.index + 1 })}
        onExit={() => setSession(null)}
      />
    )
  }

  const opening = openId ? allOpenings(store).find((o) => o.id === openId) : undefined
  if (opening) {
    return (
      <OpeningDetail
        opening={opening}
        onBack={() => setOpenId(null)}
        onStart={(lines: Line[], start) =>
          setSession({ items: lines.map((line) => ({ opening, line })), index: 0, start })
        }
      />
    )
  }

  return (
    <>
      {tab === 'openings' && <OpeningsView onOpen={setOpenId} />}
      {tab === 'repertoire' && <RepertoireView onOpen={setOpenId} />}
      {tab === 'train' && <TrainView onStart={(items) => setSession({ items, index: 0, start: 'play' })} />}
      {tab === 'stats' && <StatsView />}
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            {t.label}
            {t.id === 'train' && dueCount > 0 && <span className="badge">{dueCount}</span>}
          </button>
        ))}
      </nav>
    </>
  )
}
