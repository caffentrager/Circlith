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

export function InputSettings({
  user,
  onChange,
  onClose,
}: {
  user: UserProfile;
  onChange: (u: UserProfile) => void;
  onClose: () => void;
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
          <h2>Settings → Input & Controls</h2>
          <button autoFocus onClick={onClose}>
            닫기
          </button>
        </div>
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
