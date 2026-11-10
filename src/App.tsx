import { useEffect, useState } from 'react'
import AnalysisBoard from './Analysis'
import { findOpening } from './data/catalog'
import Icon, { type IconName } from './Icon'
import { useStore } from './lib/store'
import Trainer from './Trainer'
import { OpeningsView, RepertoireView, StatsView, TrainView, type Item } from './views/Lists'
import OpeningDetail from './views/OpeningDetail'

type Tab = 'openings' | 'repertoire' | 'train' | 'analysis' | 'stats'

const TABS: { id: Tab; icon: IconName; label: string }[] = [
  { id: 'openings', icon: 'book', label: 'Eröffnungen' },
  { id: 'repertoire', icon: 'bookmark', label: 'Repertoire' },
  { id: 'train', icon: 'repeat', label: 'Training' },
  { id: 'analysis', icon: 'engine', label: 'Analyse' },
  { id: 'stats', icon: 'stats', label: 'Statistik' },
]

interface Session {
  items: Item[]
  index: number
  start: 'watch' | 'play'
}

export default function App() {
  const store = useStore()
  const [tab, setTab] = useState<Tab>('openings')
  const [open, setOpen] = useState<{ id: string; filter?: string } | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [draft, setDraft] = useState<string[]>([])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab, open?.id, session?.index, session === null])
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

  const opening = open ? findOpening(store.custom, open.id) : undefined
  if (opening) {
    return (
      <OpeningDetail
        key={opening.id}
        opening={opening}
        initialFilter={open?.filter}
        onBack={() => setOpen(null)}
        onStart={(o, lines, start) => setSession({ items: lines.map((line) => ({ opening: o, line })), index: 0, start })}
      />
    )
  }

  return (
    <>
      {tab === 'openings' && <OpeningsView onOpen={(id, filter) => setOpen({ id, filter })} />}
      {tab === 'repertoire' && <RepertoireView onOpen={(id) => setOpen({ id })} />}
      {tab === 'train' && <TrainView onStart={(items) => setSession({ items, index: 0, start: 'play' })} />}
      {tab === 'analysis' && (
        <AnalysisBoard title="Analysebrett" subtitle="Freies Brett mit Stockfish" initialMoves={draft} orientation="w" onChange={setDraft} withTabs />
      )}
      {tab === 'stats' && <StatsView />}
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={22} />
            {t.label}
            {t.id === 'train' && dueCount > 0 && <span className="badge">{dueCount}</span>}
          </button>
        ))}
      </nav>
    </>
  )
}
