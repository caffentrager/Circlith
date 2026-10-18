import { useState } from "react";
import {
  builtins,
  effective,
  preset,
  freshUser,
  importUser,
  validateUser,
} from "../input/profiles";
import {
  bindingId,
  conflicts,
  signature,
  type Binding,
  type UserProfile,
} from "../input/types";
import { commands } from "../input/registry";
import { defaultRouting, type RoutingSettings } from "../geometry/routing";
import type { WireDisplaySettings } from '../geometry/wire-bridges';

export function InputSettings({
  user,
  onChange,
  onClose,
  routing,
  onRoutingChange,
  wireDisplay,
  onWireDisplayChange,
}: {
  user: UserProfile;
  onChange: (u: UserProfile) => void;
  onClose: () => void;
  routing: RoutingSettings;
  onRoutingChange: (settings: RoutingSettings) => void;
  wireDisplay: WireDisplaySettings;
  onWireDisplayChange: (settings: WireDisplaySettings) => void;
}) {
  const [error, setError] = useState(""),
    [editing, setEditing] = useState<{ key: string; json: string } | null>(
      null,
    );
  const profile = effective(user),
    base = preset(user.presetId),
    issues = conflicts(profile.bindings);
  const apply = (next: UserProfile) => {
    try {
      onChange(validateUser(next));
      setError("");
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    }
  };
  const reset = (key: string) => {
    const next = structuredClone(user);
    delete next.overrides[key];
    apply(next);
  };
  const mix = (id: string) => {
    const next = structuredClone(user),
      nav = new Set(["view.pan", "view.zoom", "view.zoomIn", "view.zoomOut"]);
    for (const b of base.bindings)
      if (nav.has(b.command)) next.overrides[bindingId(b)] = null;
    for (const [key, b] of Object.entries(next.overrides))
      if (b && nav.has(b.command)) next.overrides[key] = null;
    preset(id)
      .bindings.filter((b) => nav.has(b.command))
      .forEach((b, i) => (next.overrides[`navigation-${i}`] = b));
    apply(next);
  };
  const row = (b: Binding, index: number) => {
    const key =
      Object.entries(user.overrides).find(
        ([, v]) => v && JSON.stringify(v) === JSON.stringify(b),
      )?.[0] ?? bindingId(b);
    return (
      <tr key={index}>
        <td>{b.command}</td>
        <td>{signature(b.input)}</td>
        <td>{(b.context ?? ["canvas"]).join(", ")}</td>
        <td>
          {commands.find((c) => c.id === b.command)?.available
            ? "available"
            : "unavailable"}
        </td>
        <td>
          <button
            onClick={() =>
              setEditing({ key, json: JSON.stringify(b, null, 2) })
            }
          >
            수정
          </button>
          <button onClick={() => reset(key)}>개별 초기화</button>
          <button
            onClick={() =>
              apply({ ...user, overrides: { ...user.overrides, [key]: null } })
            }
          >
            해제
          </button>
        </td>
      </tr>
    );
  };
  return (
    <div
      className="overlay settings-overlay"
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-label="Input & Controls"
        aria-modal="true"
        className="input-settings"
      >
        <div className="settings-heading">
          <h2>설정 · 배선 및 입력</h2>
          <button autoFocus onClick={onClose}>
            닫기
          </button>
        </div>
        <fieldset className="routing-settings">
          <legend>배선 설정</legend>
          <label>경로 생성 방식
            <select aria-label="경로 생성 방식" value={routing.pathMode} onChange={(e) => onRoutingChange({ ...routing, pathMode: e.target.value as RoutingSettings["pathMode"] })}>
              <option value="smart">스마트 자동</option><option value="horizontal">가로 우선</option><option value="vertical">세로 우선</option>
            </select>
          </label>
          <label>부품과 겹칠 때
            <select aria-label="부품과 겹칠 때" value={routing.overlapMode} onChange={(e) => onRoutingChange({ ...routing, overlapMode: e.target.value as RoutingSettings["overlapMode"] })}>
              <option value="avoid">자동 우회</option><option value="warn">경고하며 허용</option>
            </select>
          </label>
          <p>스마트 자동은 핀 방향과 꺾임을 고려합니다. 자동 우회는 부품 몸체에서 여유를 두며, 가로·세로 우선도 장애물을 피합니다.</p>
          <p>설정은 바로 저장되며 새 배선·경로 정리·이동에 적용됩니다. 기존 회로는 유지됩니다. 고정 경유점이 우회를 막으면 확정 전에 표시합니다.</p>
          <p>배선 중 Shift+Space: 이번 구간 꺾임 전환 · 부품 드래그 중 R / Shift+R: 반시계 / 시계 회전</p>
          <button onClick={() => onRoutingChange({ ...defaultRouting })}>배선 설정 초기화</button>
        </fieldset>
        <fieldset className="routing-settings wire-display-settings">
          <legend>배선 표시</legend>
          <label><input type="checkbox" checked={wireDisplay.enabled}
            onChange={e => onWireDisplayChange({ ...wireDisplay, enabled: e.target.checked })}/>
            미접속 교차 점프
          </label>
          <label>점프할 배선
            <select aria-label="점프할 배선" value={wireDisplay.axis} disabled={!wireDisplay.enabled}
              onChange={e => onWireDisplayChange({ ...wireDisplay, axis: e.target.value as WireDisplaySettings['axis'] })}>
              <option value="horizontal">가로선</option><option value="vertical">세로선</option>
            </select>
          </label>
          <p>가로선은 위로, 세로선은 오른쪽으로 넘습니다. 접속점·끝점·모서리 근처와 촘촘한 교차는 생략합니다. 연결 관계와 Undo 기록은 바뀌지 않습니다.</p>
        </fieldset>
        <label>
          Control Preset{" "}
          <select
            aria-label="Control Preset"
            value={user.presetId}
            onChange={(e) => {
              setEditing(null);
              apply(freshUser(e.target.value));
            }}
          >
            {builtins.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.compatibility.level}
              </option>
            ))}
          </select>
        </label>
        <h3>{profile.name}</h3>
        <p>{profile.description}</p>
        <p>
          자료 호환 수준: {profile.compatibility.level} · 1:1 호환을 보장하지
          않습니다.
        </p>
        {profile.compatibility.notes?.map((note, i) => (
          <p key={i} className="note">
            {note}
          </p>
        ))}
        <h3>Navigation</h3>
        <label>
          다른 프리셋의 navigation 혼합{" "}
          <select
            aria-label="Navigation preset"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) mix(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">선택…</option>
            {builtins.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={profile.behavior?.reverseWheel === true}
            onChange={(e) =>
              apply({
                ...user,
                behavior: { ...user.behavior, reverseWheel: e.target.checked },
              })
            }
          />
          휠 확대 방향 반전
        </label>
        <label>
          순차 키 대기 시간(ms)
          <input
            aria-label="Sequence timeout"
            type="number"
            min="100"
            max="10000"
            value={Number(profile.behavior?.sequenceTimeoutMs ?? 900)}
            onChange={(e) =>
              apply({
                ...user,
                behavior: {
                  ...user.behavior,
                  sequenceTimeoutMs: Number(e.target.value),
                },
              })
            }
          />
        </label>
        <button
          onClick={() => {
            setEditing(null);
            apply(freshUser(user.presetId));
          }}
        >
          프리셋 전체 초기화
        </button>
        <details>
          <summary>Built-in preset (immutable)</summary>
          <pre>
            {JSON.stringify(
              builtins.find((p) => p.id === user.presetId),
              null,
              2,
            )}
          </pre>
        </details>
        <h3>Effective bindings — Keyboard / Mouse / Selection / Schematic</h3>
        <button
          onClick={() =>
            setEditing({
              key: `custom-${crypto.randomUUID()}`,
              json: JSON.stringify(
                {
                  command: "tool.select",
                  context: ["canvas"],
                  input: { type: "key", key: "T" },
                },
                null,
                2,
              ),
            })
          }
        >
          바인딩 추가
        </button>
        <table>
          <thead>
            <tr>
              <th>Command</th>
              <th>Input</th>
              <th>Context</th>
              <th>Status</th>
              <th>편집</th>
            </tr>
          </thead>
          <tbody>{profile.bindings.map(row)}</tbody>
        </table>
        {editing && (
          <div className="binding-editor">
            <label>
              바인딩 JSON
              <textarea
                aria-label="Binding JSON"
                value={editing.json}
                onChange={(e) =>
                  setEditing({ ...editing, json: e.target.value })
                }
              />
            </label>
            <button
              onClick={() => {
                try {
                  const binding = JSON.parse(editing.json);
                  if (
                    apply({
                      ...user,
                      overrides: { ...user.overrides, [editing.key]: binding },
                    })
                  )
                    setEditing(null);
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              바인딩 적용
            </button>
            <button onClick={() => setEditing(null)}>수정 취소</button>
          </div>
        )}
        <h3>User overrides</h3>
        {Object.keys(user.overrides).length ||
        Object.keys(user.behavior).length ? (
          <>
            <pre>
              {JSON.stringify(
                { overrides: user.overrides, behavior: user.behavior },
                null,
                2,
              )}
            </pre>
            {Object.keys(user.overrides).map((key) => (
              <button key={key} onClick={() => reset(key)}>
                수정 초기화: {key}
              </button>
            ))}
          </>
        ) : (
          <p>사용자 수정 없음</p>
        )}
        <h3>Conflicts / ambiguities</h3>
        {issues.length ? (
          issues.map((c, i) => (
            <p key={i}>
              {c.type}: {profile.bindings[c.a].command} ↔{" "}
              {profile.bindings[c.b].command}
              {c.type === "gesture"
                ? " · drag threshold로 구분"
                : c.type === "contexts"
                  ? " · 서로 겹치지 않는 context"
                  : c.type === "prefix"
                    ? " · timeout 동안 대기 후 구분"
                    : ""}
            </p>
          ))
        ) : (
          <p>충돌 없음</p>
        )}
        <h3>Unsupported / unmapped target actions</h3>
        {profile.unmappedTargetActions?.length ? (
          profile.unmappedTargetActions.map((a, i) => (
            <p key={i}>
              <strong>{a.action}</strong> — {a.reason}
            </p>
          ))
        ) : (
          <p>자료에 별도 미지원 동작 없음</p>
        )}
        <h3>Unavailable Circlith commands</h3>
        {commands
          .filter((c) => !c.available)
          .map((c) => (
            <p key={c.id}>
              {c.id} — {c.label}: 현재 Editor handler 미구현
            </p>
          ))}
        <h3>Import / Export</h3>
        <label>
          사용자 JSON 가져오기
          <input
            aria-label="Import profile JSON"
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                apply(importUser(await file.text()));
              } catch (err) {
                setError(String(err));
              }
              e.target.value = "";
            }}
          />
        </label>
        <button
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(user, null, 2)], {
                type: "application/json",
              }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "circlith-input-profile.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          사용자 JSON 내보내기
        </button>
        <details>
          <summary>Source metadata</summary>
          <pre>{JSON.stringify(profile.sources, null, 2)}</pre>
        </details>
        {error && <p role="alert">{error}</p>}
      </section>
    </div>
  );
}
