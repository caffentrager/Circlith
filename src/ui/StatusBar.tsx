import { simulationAvailable } from '../config/app-mode';
import { useEffect, useState } from 'react';

const operations: Record<string, string> = {
  NONE: '입력 대기', PLACE: '부품 배치', MOVE: '연결 유지 이동', WIRE_DRAFT: '배선 중',
  WIRE_ROUTE: '경로 수정', SEGMENT_MOVE: '선분 편집', BOX_SELECT: '영역 선택', WIRE_CLEANUP: '중복 정리',
};

export function StatusBar({ tool, operation, selection, zoom, grid, simulationEnabled, message, messageKind, messageId, profile, pending }: {
  tool: string; operation: string; selection: number; zoom: number; grid: boolean;
  simulationEnabled: boolean; diagnostics: number; message: string; profile: string;
  pending: string[]; hint: (command: string) => string;
  messageKind: 'info' | 'error';
  messageId: number;
}) {
  const [visibleMessage, setVisibleMessage] = useState(message);
  useEffect(() => {
    setVisibleMessage(message);
    if (!message || messageKind === 'error') return;
    const timer = window.setTimeout(() => setVisibleMessage(''), 5000);
    return () => window.clearTimeout(timer);
  }, [message, messageKind, messageId]);
  const feedback = pending.length ? `순차 키 대기: ${pending.join(' → ')}` : visibleMessage;
  return <footer className="status-bar" role="status" data-input-profile={profile}>
    <strong className="status-tool">{tool === 'WIRE' ? '배선' : '선택'}</strong>
    <span className="status-selection">선택 {selection}</span>
    <span className="status-operation">{operations[operation] ?? operation}</span>
    <span className={`status-feedback ${messageKind === 'error' && visibleMessage ? 'status-error' : ''}`} title={feedback}>{messageKind === 'error' && visibleMessage ? '⚠ ' : ''}{feedback}</span>
    <span className="status-view">{Math.round(zoom * 100)}% · Grid {grid ? '10' : 'OFF'}</span>
    {simulationAvailable && simulationEnabled && <span className="status-logic">조합논리</span>}
  </footer>;
}
