import { useState, type ReactNode } from 'react';
import type { Circuit, Kind } from '../model/circuit';
import { gateKinds } from '../model/circuit';
import type { CircuitLabels } from './circuit-labels';

const categories: { name: string; kinds: Kind[] }[] = [
  { name: '논리 게이트', kinds: [...gateKinds] },
  { name: '입출력', kinds: ['Input', 'Output'] },
  { name: '순차소자', kinds: ['Clock', 'DFF'] },
];

export function EditorSidebar({ circuit, labels, selection, renderPart, searchCommand, onSelect, onReveal, onClose, busy, children }: {
  circuit: Circuit;
  labels: CircuitLabels;
  selection: string[];
  renderPart: (kind: Kind) => ReactNode;
  searchCommand: ReactNode;
  onSelect: (key: string, additive: boolean) => void;
  onReveal: (key: string) => void;
  onClose: () => void;
  busy: boolean;
  children: ReactNode;
}) {
  const [tab, setTab] = useState<'library' | 'scene'>('library');
  const [queries, setQueries] = useState({ library: '', scene: '' });
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const query = queries[tab].trim().toLocaleLowerCase();
  const match = (text: string) => text.toLocaleLowerCase().includes(query);
  const components = Object.values(circuit.components);
  const nets = Object.values(circuit.nets);
  const wires = Object.values(circuit.geometry.wires);
  const componentNames = labels.components;
  const pinName = (id: string) => {
    const pin = circuit.pins[id];
    return `${componentNames.get(pin.component)} · ${labels.pins.get(id)}`;
  };
  const wireName = (wire: typeof wires[number]) => {
    const name = (end: typeof wire.from) => end.type === 'pin' ? pinName(end.id) : '접속점';
    return `${name(wire.from)} → ${name(wire.to)}`;
  };
  const folder = (id: string, label: string, count: number, content: ReactNode) => <details
    key={id} className="outline-folder" open={query !== '' || !closed[id]}>
    <summary onClick={e => {
      // Keep native delayed toggle events from competing with search's forced-open state.
      // Keyboard activation of summary also dispatches click, preserving Enter/Space support.
      e.preventDefault();
      if (!query) setClosed(prev => ({ ...prev, [id]: !prev[id] }));
    }}><span>{label}</span><span className="outline-count">{count}</span></summary>
    <ul>{content}</ul>
  </details>;
  const row = (key: string, name: string, type: string) => <li key={key}>
    <button className={`outline-object${selection.includes(key) ? ' active' : ''}`}
      data-outline-object={key} aria-pressed={selection.includes(key)} disabled={busy}
      title={`${name}\n클릭: 선택 · Shift+클릭: 추가/해제 · 더블클릭: 화면 맞춤`}
      onClick={e => onSelect(key, e.shiftKey)} onDoubleClick={() => onReveal(key)}>
      <span className="outline-type" aria-hidden="true">{type}</span>
      <span className="outline-name">{name}</span>
    </button>
  </li>;
  const visibleComponents = components.filter(c => match(`${componentNames.get(c.id)} ${c.kind} 부품`));
  const visibleNets = nets.map((net, i) => {
    const label = labels.nets.get(net.id)!;
    const items = wires.filter(w => w.net === net.id && (match(`${label} 연결망 ${i + 1}`) || match(`배선 ${wireName(w)}`)));
    return { net, label, items };
  }).filter(n => n.items.length);
  const visibleCategories = categories.map(category => ({ ...category,
    kinds: category.kinds.filter(kind => match(category.name) || match(kind)),
  })).filter(category => category.kinds.length);

  return <aside id="workspace-library" className="library editor-sidebar" aria-label="에디터 탐색">
    <div className="panel-heading"><strong>탐색</strong><button aria-label="라이브러리 닫기" onClick={onClose}>×</button></div>
    <div className="sidebar-tabs" role="tablist" aria-label="탐색 패널">
      {(['library', 'scene'] as const).map((value, index, values) => <button key={value}
        id={`sidebar-${value}-tab`} role="tab" aria-selected={tab === value}
        aria-controls={`sidebar-${value}-panel`} tabIndex={tab === value ? 0 : -1}
        onClick={() => setTab(value)} onKeyDown={e => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
            e.preventDefault();
            const next = e.key === 'Home' ? 'library' : e.key === 'End' ? 'scene' : values[1 - index];
            setTab(next); document.getElementById(`sidebar-${next}-tab`)?.focus({preventScroll:true});
          }
        }}>{value === 'library' ? '라이브러리' : '도면 트리'}</button>)}
    </div>
    <div role="tabpanel" id={`sidebar-${tab}-panel`} aria-labelledby={`sidebar-${tab}-tab`}>
      <label className="sidebar-search"><span>{tab === 'library' ? '라이브러리 검색' : '도면 트리 검색'}</span>
        <input type="search" value={queries[tab]} placeholder={tab === 'library' ? '이름·종류 검색' : '부품·배선 검색'}
          onChange={e => setQueries({ ...queries, [tab]: e.target.value })}/>
      </label>
      {tab === 'library' ? <>
        {searchCommand}
        <section className="sidebar-outline" aria-label="부품 라이브러리">
          {visibleCategories.map(category => folder(`library-${category.name}`, category.name, category.kinds.length,
            category.kinds.map(kind => <li key={kind}>{renderPart(kind)}</li>)))}
          {!visibleCategories.length && <p className="sidebar-empty">검색 결과가 없습니다.</p>}
        </section>
      </> : <>
        <p className="sidebar-summary">부품 {components.length} · 배선 {wires.length}</p>
        {busy && <p className="sidebar-empty">초안을 확정하거나 취소하면 항목을 선택할 수 있습니다.</p>}
        <section className="sidebar-outline" aria-label="도면 객체">
          {folder('scene-components', '부품', visibleComponents.length,
            visibleComponents.map(c => row(c.id, componentNames.get(c.id)!, c.kind)))}
          {folder('scene-nets', '연결망', visibleNets.length,
            visibleNets.map(({net,label,items}) => <li key={net.id}>
              {folder(`net-${net.id}`,label,items.length,
                items.map((w) => row(w.id,wireName(w),'선')))}
            </li>))}
          {!components.length && !wires.length ? <p className="sidebar-empty">아직 배치된 객체가 없습니다.<br/>라이브러리에서 부품을 가져오세요.</p>
            : !visibleComponents.length && !visibleNets.length && <p className="sidebar-empty">검색 결과가 없습니다.</p>}
        </section>
        <p className="sidebar-empty">Shift+클릭: 추가 선택<br/>더블클릭: 선택 항목 화면 맞춤</p>
      </>}
    </div>
    <details className="sidebar-help"><summary>조작 안내</summary>{children}</details>
  </aside>;
}
