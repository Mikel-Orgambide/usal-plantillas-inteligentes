import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ROUTINE_CATEGORIES, ROUTINE_CATEGORY_LABEL, type ItemKind, type ItemTarget, type RoutineCategory, type RoutineOrigin } from "@plantillas/training";
import { Button, Card, Chip, Header, Icon, Screen, Text, TextButton } from "../../presentation/components";
import { colors, fonts, radius, size, space } from "../../presentation/theme/tokens";
import { getRoutine, saveRoutine, type RoutineDraft } from "../../application/trainingStore";

type ItemDraft = RoutineDraft["items"][number] & { readonly key: string };

const KIND_LABEL: Record<ItemKind, string> = { strength: "Fuerza", walk_run: "Caminata / carrera", other: "Otro" };

function emptyTarget(kind: ItemKind): ItemTarget {
  if (kind === "strength") return { kind, sets: 3, reps: 10, weight_kg: null };
  if (kind === "walk_run") return { kind, duration_min: 20, distance_km: null, pace_note: null };
  return { kind, instructions: "" };
}
let keySeq = 0;
const newItem = (kind: ItemKind = "strength"): ItemDraft => ({ key: `k${++keySeq}`, kind, name: "", target: emptyTarget(kind), instructions: "", rest_sec: null });
const numOrNull = (v: string): number | null => (v.trim() === "" ? null : Number(v.replace(",", ".")));

/** Crear o editar una rutina y sus ejercicios (ADR 0013). Formularios simples; los valores son objetivos declarados. */
export default function RoutineEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [origin, setOrigin] = useState<RoutineOrigin>("own");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<RoutineCategory | null>(null);
  const [items, setItems] = useState<ItemDraft[]>([newItem()]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!id);

  useEffect(() => {
    if (!id) return;
    void getRoutine(id).then((r) => {
      if (!r) return;
      setName(r.routine.name); setGoal(r.routine.goal ?? ""); setOrigin(r.routine.origin); setNote(r.routine.professional_note ?? ""); setCategory(r.routine.category ?? null);
      setItems(r.items.map((i) => ({ key: i.id, id: i.id, kind: i.kind, name: i.name, target: i.target, instructions: i.instructions ?? "", rest_sec: i.rest_sec })));
      setLoaded(true);
    });
  }, [id]);

  const update = (key: string, patch: Partial<ItemDraft>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const setTarget = (key: string, patch: Partial<ItemTarget>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, target: { ...i.target, ...patch } as ItemTarget } : i)));
  const move = (key: string, dir: -1 | 1) => setItems((cur) => {
    const idx = cur.findIndex((i) => i.key === key); const j = idx + dir;
    if (idx < 0 || j < 0 || j >= cur.length) return cur;
    const next = [...cur]; [next[idx], next[j]] = [next[j]!, next[idx]!]; return next;
  });

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const r = await saveRoutine({ ...(id ? { id } : {}), name, goal, origin, professional_note: note, category, items: items.map(({ key: _k, ...rest }) => rest) });
    setSaving(false);
    if (r.errors.length) { setErrors(r.errors); return; }
    router.back();
  };

  return (
    <Screen footer={<Button variant="primary" disabled={saving || !loaded} onPress={() => void save()}>{saving ? "Guardando…" : "Guardar rutina"}</Button>}>
      <Header title={id ? "Editar rutina" : "Nueva rutina"} onBack={() => router.back()} />
      <Text variant="label" color={colors.textSecondary} style={styles.label}>Nombre</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Ej.: Pierna · semana 1" placeholderTextColor={colors.textSecondary} style={styles.input} maxLength={80} />
      <Text variant="label" color={colors.textSecondary} style={styles.label}>Objetivo (opcional)</Text>
      <TextInput value={goal} onChangeText={setGoal} placeholder="Ej.: fuerza, volver a caminar 30 min" placeholderTextColor={colors.textSecondary} style={styles.input} maxLength={120} />
      <Text variant="label" color={colors.textSecondary} style={styles.label}>Tipo (opcional)</Text>
      <View style={styles.chips}>
        {ROUTINE_CATEGORIES.map((c) => (
          <Chip key={c} variant={category === c ? "selected" : "neutral"} onPress={() => setCategory(category === c ? null : c)}>{ROUTINE_CATEGORY_LABEL[c]}</Chip>
        ))}
      </View>
      <Text variant="label" color={colors.textSecondary} style={styles.label}>Origen</Text>
      <View style={styles.chips}>
        <Chip variant={origin === "own" ? "selected" : "neutral"} onPress={() => setOrigin("own")}>Propia</Chip>
        <Chip variant={origin === "professional" ? "selected" : "neutral"} icon="user" onPress={() => setOrigin("professional")}>Indicada por un profesional</Chip>
      </View>
      {origin === "professional" ? (
        <>
          <Text variant="label" color={colors.textSecondary} style={styles.label}>Indicaciones del profesional (opcional)</Text>
          <TextInput value={note} onChangeText={setNote} placeholder="Tal cual te las dieron; la app no las interpreta" placeholderTextColor={colors.textSecondary} style={[styles.input, styles.multiline]} multiline maxLength={500} />
        </>
      ) : null}

      <Text variant="label" color={colors.textSecondary} style={[styles.label, { marginTop: space[6] }]}>Ejercicios</Text>
      {items.map((i, idx) => (
        <Card key={i.key} style={{ marginBottom: space[3] }}>
          <View style={styles.itemHead}>
            <Text variant="caption" color={colors.textSecondary}>{idx + 1}</Text>
            <TextInput value={i.name} onChangeText={(v) => update(i.key, { name: v })} placeholder="Ejercicio" placeholderTextColor={colors.textSecondary} style={[styles.input, { flex: 1, marginTop: 0 }]} maxLength={60} />
            <Pressable onPress={() => move(i.key, -1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Subir"><Icon name="chevron-up" size={20} color={colors.textSecondary} /></Pressable>
            <Pressable onPress={() => move(i.key, 1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Bajar"><Icon name="chevron-down" size={20} color={colors.textSecondary} /></Pressable>
            <Pressable onPress={() => setItems((cur) => cur.filter((x) => x.key !== i.key))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Quitar"><Icon name="close" size={20} color={colors.textSecondary} /></Pressable>
          </View>
          <View style={[styles.chips, { marginTop: space[3] }]}>
            {(Object.keys(KIND_LABEL) as ItemKind[]).map((k) => (
              <Chip key={k} variant={i.kind === k ? "selected" : "neutral"} onPress={() => update(i.key, { kind: k, target: i.kind === k ? i.target : emptyTarget(k) })}>{KIND_LABEL[k]}</Chip>
            ))}
          </View>
          {i.target.kind === "strength" ? (
            <View style={styles.row}>
              <Field label="Series" value={String(i.target.sets)} onChange={(v) => setTarget(i.key, { sets: Number(v) || 0 })} />
              <Field label="Repeticiones" value={String(i.target.reps)} onChange={(v) => setTarget(i.key, { reps: Number(v) || 0 })} />
              <Field label="Peso (kg)" value={i.target.weight_kg === null ? "" : String(i.target.weight_kg)} onChange={(v) => setTarget(i.key, { weight_kg: numOrNull(v) })} placeholder="—" />
            </View>
          ) : i.target.kind === "walk_run" ? (
            <View style={styles.row}>
              <Field label="Tiempo (min)" value={i.target.duration_min === null ? "" : String(i.target.duration_min)} onChange={(v) => setTarget(i.key, { duration_min: numOrNull(v) })} placeholder="—" />
              <Field label="Distancia (km)" value={i.target.distance_km === null ? "" : String(i.target.distance_km)} onChange={(v) => setTarget(i.key, { distance_km: numOrNull(v) })} placeholder="—" />
              <Field label="Ritmo (nota)" value={i.target.pace_note ?? ""} onChange={(v) => setTarget(i.key, { pace_note: v || null })} placeholder="suave" text />
            </View>
          ) : (
            <TextInput value={i.target.instructions} onChangeText={(v) => setTarget(i.key, { instructions: v })} placeholder="Qué hay que hacer" placeholderTextColor={colors.textSecondary} style={[styles.input, styles.multiline]} multiline maxLength={300} />
          )}
          <View style={styles.row}>
            <Field label="Descanso (s)" value={i.rest_sec === null ? "" : String(i.rest_sec)} onChange={(v) => update(i.key, { rest_sec: v.trim() === "" ? null : Math.round(Number(v)) || 0 })} placeholder="90" />
            <Field label="Indicaciones" value={i.instructions} onChange={(v) => update(i.key, { instructions: v })} placeholder="opcional" text grow />
          </View>
        </Card>
      ))}
      <TextButton icon="plus" onPress={() => setItems((cur) => [...cur, newItem()])}>Agregar ejercicio</TextButton>
      {errors.length ? <View style={{ marginTop: space[3], gap: 4 }}>{errors.map((e) => <Text key={e} variant="caption" color={colors.alert}>· {e}</Text>)}</View> : null}
      <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[4] }}>Los valores son objetivos declarados por vos o tu profesional. La app no propone rutinas ni ajusta cargas.</Text>
    </Screen>
  );
}

function Field({ label, value, onChange, placeholder, text, grow }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; text?: boolean; grow?: boolean }) {
  return (
    <View style={{ flex: grow ? 2 : 1, gap: 4 }}>
      <Text variant="caption" color={colors.textSecondary}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.textSecondary} keyboardType={text ? "default" : "decimal-pad"} style={[styles.input, { marginTop: 0 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: space[4], marginBottom: space[2] },
  input: { minHeight: size.controlHeight, borderRadius: radius.md, borderWidth: size.hairline, borderColor: colors.line, backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: space[4], fontFamily: fonts.regular, fontSize: 16 },
  multiline: { minHeight: 80, paddingTop: space[3], textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  itemHead: { flexDirection: "row", alignItems: "center", gap: space[2] },
  row: { flexDirection: "row", gap: space[2], marginTop: space[3] },
});
