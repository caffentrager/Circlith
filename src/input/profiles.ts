import Ajv2020 from "ajv/dist/2020";
import schema from "./data/schema/input-profile.schema.json";
import catalog from "./data/preset-catalog.json";
import extensions from "./data/native-extensions.json";
import adaptations from "./data/profile-adaptations.json";
import { registry } from "./registry";
import {
  bindingId,
  conflicts,
  contextsOverlap,
  keySteps,
  signature,
  type Binding,
  type Profile,
  type UserProfile,
} from "./types";
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateSchema = ajv.compile(schema);
const contexts = new Set([
  "global",
  "canvas",
  "text-input",
  "modal",
  "placement",
  "move",
  "wire-draft",
]);
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
export function validateProfile(value: unknown): asserts value is Profile {
  if (
    value &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    value.schemaVersion !== "1.0"
  )
    throw new Error(
      `지원하지 않는 프로필 버전: ${String(value.schemaVersion)}. 버전 1.0 JSON을 사용하세요.`,
    );
  if (!validateSchema(value))
    throw new Error(ajv.errorsText(validateSchema.errors));
  const p = value as Profile;
  if (p.schemaVersion !== "1.0")
    throw new Error(
      `지원하지 않는 프로필 버전: ${p.schemaVersion}. 버전 1.0 JSON을 사용하세요.`,
    );
  for (const b of p.bindings) {
    if (!registry.has(b.command))
      throw new Error(`알 수 없는 명령: ${b.command}`);
    if (b.context?.some((c) => !contexts.has(c)))
      throw new Error("알 수 없는 입력 context");
    const i = b.input;
    if (
      (i.type === "key" && !i.key?.trim()) ||
      (i.type === "keyChord" && !i.keys?.length) ||
      (i.type === "keySequence" &&
        (!i.sequence?.length || i.sequence.some((k) => !k.trim())))
    )
      throw new Error("키 바인딩의 key/keys/sequence가 필요합니다.");
    if (
      i.type.startsWith("mouse") &&
      !["left", "middle", "right"].includes(i.button ?? "")
    )
      throw new Error("마우스 button은 left/middle/right여야 합니다.");
    if (
      i.modifiers?.some(
        (m) => !["Ctrl", "Shift", "Alt", "Meta", "Space"].includes(m),
      )
    )
      throw new Error("지원하지 않는 modifier");
    if (
      i.thresholdPx !== undefined &&
      (!Number.isFinite(i.thresholdPx) ||
        i.thresholdPx < 1 ||
        i.thresholdPx > 50)
    )
      throw new Error("drag threshold 범위는 1–50px입니다.");
  }
  const timeout = p.behavior?.sequenceTimeoutMs;
  if (
    timeout !== undefined &&
    (typeof timeout !== "number" ||
      !Number.isFinite(timeout) ||
      timeout < 100 ||
      timeout > 10000)
  )
    throw new Error("sequence timeout 범위는 100–10000ms입니다.");
  if (
    p.behavior?.reverseWheel !== undefined &&
    typeof p.behavior.reverseWheel !== "boolean"
  )
    throw new Error("reverseWheel은 boolean이어야 합니다.");
  if (
    p.behavior?.moveSemantics &&
    p.behavior.moveSemantics !== "preserve-connectivity"
  )
    throw new Error("연결을 끊는 Move는 지원하지 않습니다.");
}
const assets = import.meta.glob<Profile>("./data/presets/*.json", {
  eager: true,
  import: "default",
});
export const builtins: readonly Profile[] = freeze(
  catalog.presets.map((entry) => {
    const profile = assets[`./data/presets/${entry.id}.json`];
    if (!profile || profile.id !== entry.id)
      throw new Error(`누락되거나 잘못된 preset asset: ${entry.id}`);
    return profile;
  }),
);
for (const p of builtins) validateProfile(p);
export function preset(id: string, seen = new Set<string>()): Profile {
  const own = builtins.find((p) => p.id === id);
  if (!own) throw new Error(`알 수 없는 프리셋: ${id}`);
  if (seen.has(id)) throw new Error("순환 basePreset");
  seen.add(id);
  const base = own.basePreset ? preset(own.basePreset, seen) : null;
  let inherited = base?.bindings ?? [];
  const seedBindings =
    own.id === "circlith-modern"
      ? [...own.bindings, ...(extensions.bindings as Binding[])]
      : own.bindings;
  const child = [
    ...seedBindings,
    ...(((adaptations as Record<string, unknown>)[own.id] as Binding[]) ?? []),
  ];
  inherited = inherited.filter(
    (b) =>
      !child.some((c) => {
        if (b.command === c.command) return true;
        if (!contextsOverlap(b, c)) return false;
        if (signature(b.input) === signature(c.input)) return true;
        const bs = keySteps(b.input),
          cs = keySteps(c.input);
        return (
          bs.length &&
          cs.length &&
          bs
            .slice(0, Math.min(bs.length, cs.length))
            .every((s, i) => s === cs[i])
        );
      }),
  );
  return {
    ...structuredClone(own),
    behavior: {
      ...base?.behavior,
      ...own.behavior,
      sequenceTimeoutMs:
        own.behavior?.sequenceTimeoutMs ??
        base?.behavior?.sequenceTimeoutMs ??
        900,
    },
    bindings: structuredClone([...inherited, ...child]),
  };
}
export const freshUser = (presetId = catalog.defaultPreset): UserProfile => ({
  schemaVersion: "1.0",
  presetId,
  overrides: {},
  behavior: {},
});
export function effective(user: UserProfile): Profile {
  const base = preset(user.presetId);
  const entries = base.bindings.map((b) => bindingId(b));
  const bindings = base.bindings.flatMap((b) => {
    const key = bindingId(b);
    return key in user.overrides
      ? user.overrides[key]
        ? [user.overrides[key]!]
        : []
      : [b];
  });
  for (const [key, b] of Object.entries(user.overrides))
    if (!entries.includes(key) && b) bindings.push(b);
  return {
    ...base,
    name:
      base.name +
      (Object.keys(user.overrides).length || Object.keys(user.behavior).length
        ? " (Modified)"
        : ""),
    behavior: { ...base.behavior, ...user.behavior },
    bindings,
  };
}
export const storageKey = "circlith.input-profile.v1";
export function validateUser(value: unknown): UserProfile {
  const u = value as UserProfile;
  if (!u || u.schemaVersion !== "1.0")
    throw new Error("지원하지 않는 사용자 프로필 버전. 버전 1.0을 사용하세요.");
  if (
    !u.overrides ||
    typeof u.overrides !== "object" ||
    Array.isArray(u.overrides) ||
    !u.behavior ||
    typeof u.behavior !== "object" ||
    Array.isArray(u.behavior)
  )
    throw new Error("overrides/behavior 객체가 필요합니다.");
  const p = effective(u);
  validateProfile(p);
  if (conflicts(p.bindings).some((c) => c.type === "collision"))
    throw new Error("동일 입력과 겹치는 context에 충돌하는 바인딩이 있습니다.");
  return structuredClone(u);
}
export function importUser(json: string): UserProfile {
  const value = JSON.parse(json);
  if ("presetId" in value) return validateUser(value);
  validateProfile(value);
  if (value.basePreset && !builtins.some((p) => p.id === value.basePreset))
    throw new Error("알 수 없는 basePreset");
  const u = freshUser(value.basePreset ?? "circlith-modern");
  for (const b of preset(u.presetId).bindings) u.overrides[bindingId(b)] = null;
  value.bindings.forEach(
    (b: Binding, i: number) => (u.overrides[`custom-${i}`] = b),
  );
  u.behavior = value.behavior ?? {};
  return validateUser(u);
}
