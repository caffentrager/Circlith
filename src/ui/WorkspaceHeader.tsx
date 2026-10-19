import { simulationAvailable } from '../config/app-mode';

export function WorkspaceHeader({ tool, simulationEnabled, sequential = false, canUndo, canRedo, edits, projectName, onProjectName, hint, onCommand, onSimulation, onSettings }: {
  sequential?: boolean;
  tool: 'SELECT' | 'WIRE';
  simulationEnabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  edits: number;
  projectName: string;
  onProjectName: (name: string) => void;
  hint: (command: string) => string;
  onCommand: (command: string) => void;
  onSimulation: () => void;
  onSettings: () => void;
}) {
  return <header className="workspace-header" data-edit-count={edits}>
    <strong className="brand"><i aria-hidden="true" className="brand-mark">C</i>Circlith
      <small>{simulationAvailable ? sequential ? '시간 시뮬레이션' : '조합논리 시뮬레이션' : '회로 편집기'}</small>
    </strong>
    <div className="project-heading">
      <input aria-label="프로젝트 이름" value={projectName} onChange={e => onProjectName(e.target.value)} />
      <small className="unsaved-state" title="회로와 이름은 저장되지 않습니다. 새로고침하거나 탭을 닫으면 사라집니다.">저장 안 됨 · 새로고침 시 사라짐</small>
    </div>
    <div className="header-group history-actions" role="group" aria-label="편집 기록">
      <button disabled={!canUndo} title={hint('history.undo')} onClick={() => onCommand('history.undo')}><i aria-hidden="true">↶</i> Undo</button>
      <button disabled={!canRedo} title={hint('history.redo')} onClick={() => onCommand('history.redo')}><i aria-hidden="true">↷</i> Redo</button>
    </div>
    <div className="header-group tool-actions" role="group" aria-label="도면 도구">
      <button aria-pressed={tool === 'SELECT'} onClick={() => onCommand('tool.select')}>선택 <kbd>{hint('tool.select')}</kbd></button>
      <button aria-pressed={tool === 'WIRE'} onClick={() => onCommand('wire.start')}>배선 <kbd>{hint('wire.start')}</kbd></button>
    </div>
    <div className="header-group workspace-actions">
      {simulationAvailable && <button className="logic-switch" aria-pressed={simulationEnabled}
        title={`시뮬레이션 표시 ${simulationEnabled ? '켜짐' : '꺼짐'}`} onClick={onSimulation}>시뮬레이션<i aria-hidden="true" className="switch-track" /></button>}
      <button onClick={onSettings}><i aria-hidden="true">⚙</i> 설정</button>
    </div>
  </header>;
}
