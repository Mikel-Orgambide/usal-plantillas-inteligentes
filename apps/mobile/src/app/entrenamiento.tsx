import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { describeEntry, describeTarget, fmtDuration, routineProgress, type ItemKind, type RoutineItem, type WorkoutEntry } from "@plantillas/training";
import { Button, Card, Chip, Header, Icon, ListRow, Screen, Sheet, StatusBanner, Text, TextButton, ValueCard } from "../presentation/components";
import { colors, fonts, radius, size, space } from "../presentation/theme/tokens";
import { addEntry, deleteEntry, finishWorkout, getWorkout, nextSetIndex, setPendingLink, useTrainingVersion, type EntryDraft, type WorkoutDetail } from "../application/trainingStore";
import { useActiveSession } from "../application/sessionStore";
import { useActiveSource } from "../application/activeSource";
import { useActivity } from "../application/activityStore";

const KIND_LABEL: Record<ItemKind, string> = { strength: "Fuerza", walk_run: "Caminata / carrera", other: "Otro" };
const numOrNull = (v: string): number | null => (v.trim() === "" ? null : Number(v.replace(",", ".")));

/**
 * Entrenamiento del día (ADR 0013): la lista de ejercicios de la rutina con
 * la carga rápida por serie (reps, peso, duración, RPE, nota) precargada con
 * los objetivos; «Grabar con plantillas» abre una sesión ya vinculada al
 * ejercicio y la serie. Al finalizar, resumen de lo declarado. Nada de esto
 * se mide: se anota lo que la persona dice.
 */
export default function WorkoutScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const version = useTrainingVersion();
  const [detail, setDetail] = useState<WorkoutDetail | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [editing, setEditing] = useState<{ item: RoutineItem | null; draft: EntryDraft } | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [notes, setNotes] = useState("");
  // Todos los hooks antes del primer `return`: un hook declarado después de la salida temprana
  // («Cargando…») cambiaba la cantidad de hooks entre renders y cerraba la app al abrir un entrenamiento.
  const [entryErrors, setEntryErrors] = useState<string[]>([]);
  const active = useActiveSession();
  const source = useActiveSource();
  const run = useActivity();
  const reload = useCallback(() => { if (id) getWorkout(id).then(setDetail).catch((e) => setError(e instanceof Error ? e.message : String(e))); }, [id]);
  useFocusEffect(useCallback(() => { reload(); }, [reload, version]));
  useEffect(() => { reload(); }, [reload, version]);

  if (!detail) {
    return <Screen footer={<Button onPress={() => router.back()}>Volver</Button>}><Header title="Entrenamiento" context={error ?? "Cargando…"} onBack={() => router.back()} /></Screen>;
  }
  const { workout, routine, entries, summary } = detail;
  const done = workout.state === "completed";
  const items = routine?.items ?? [];
  const progress = routineProgress(items, entries);
  const freeEntries = entries.filter((e) => !e.item_id || !items.some((i) => i.id === e.item_id));
  const recording = active && !active.result;

  const startEntry = (item: RoutineItem | null) => {
    const t = item?.target;
    const kind: ItemKind = item?.kind ?? "strength";
    setEditing({
      item,
      draft: {
        item_id: item?.id ?? null, item_name: item?.name ?? "", kind,
        set_index: nextSetIndex(entries, item?.id ?? null, item?.name ?? ""),
        reps: t?.kind === "strength" ? t.reps : null, weight_kg: t?.kind === "strength" ? t.weight_kg : null,
        duration_s: t?.kind === "walk_run" && t.duration_min !== null ? Math.round(t.duration_min * 60) : null,
        distance_m: t?.kind === "walk_run" && t.distance_km !== null ? Math.round(t.distance_km * 1000) : null,
        rpe: null, discomfort_note: null, notes: null,
      },
    });
  };
  const saveEntry = async () => {
    if (!editing) return;
    const r = await addEntry(workout.id, editing.draft);
    if (r.errors.length) { setEntryErrors(r.errors); return; }
    setEntryErrors([]); setEditing(null);
  };
  const recordWith = (item: RoutineItem | null, setIndex: number) => {
    const label = `${item?.name ?? "ejercicio"} · serie ${setIndex}`;
    setPendingLink({ workout_id: workout.id, entry_id: null, label });
    router.push({ pathname: "/preparacion", params: { context: label, activity: item?.kind === "walk_run" ? "caminata" : "fuerza" } });
  };
  const patch = (p: Partial<EntryDraft>) => setEditing((cur) => (cur ? { ...cur, draft: { ...cur.draft, ...p } } : cur));

  return (
    <>
    <Screen footer={done ? <Button onPress={() => router.back()}>Volver</Button> : <Button variant="primary" icon="check" onPress={() => setConfirmFinish(true)}>Finalizar entrenamiento</Button>}>
      <Header title={routine?.routine.name ?? "Entrenamiento libre"} context={`${workout.date} · ${done ? "terminado" : "en curso"}${routine?.routine.origin === "professional" ? " · indicada por un profesional" : ""}`} onBack={() => router.back()} />
      {run && run.detail.workout.id === workout.id ? (
        <StatusBanner icon="play" actionLabel="Seguir" onAction={() => router.push("/grabacion")}>Este entrenamiento está en curso: se sigue ejercicio por ejercicio desde la actividad</StatusBanner>
      ) : recording ? <StatusBanner icon="play" actionLabel="Ver" onAction={() => router.push("/grabacion")}>Hay una sesión de plantillas grabando</StatusBanner> : null}
      {routine?.routine.professional_note ? <Text variant="caption" color={colors.textSecondary} style={{ marginBottom: space[3] }}>Indicaciones: {routine.routine.professional_note}</Text> : null}

      <View style={styles.grid}>
        <ValueCard label="Series" value={summary.strength_sets} sub="declaradas" style={styles.third} />
        <ValueCard label="Volumen" value={summary.volume_kg} unit="kg·rep" sub="Σ reps × kg" style={styles.third} />
        <ValueCard label="Caminata" value={Math.round(summary.walk_run_duration_s / 60)} unit="min" sub={summary.rpe_mean !== null ? `RPE medio ${summary.rpe_mean}` : "sin RPE"} style={styles.third} />
      </View>

      {items.map((item) => {
        const p = progress.find((x) => x.item_id === item.id)!;
        const mine = entries.filter((e) => e.item_id === item.id);
        return (
          <Card key={item.id} style={{ marginBottom: space[3] }}>
            <View style={styles.itemHead}>
              <View style={{ flex: 1 }}>
                <Text variant="heading">{item.name}</Text>
                <Text variant="caption" color={colors.textSecondary}>{KIND_LABEL[item.kind]} · objetivo {describeTarget(item)}{item.rest_sec ? ` · descanso ${item.rest_sec} s` : ""}</Text>
              </View>
              <Chip variant={p.done >= p.target ? "selected" : "neutral"} icon={p.done >= p.target ? "check" : undefined}>{`${p.done} / ${p.target}`}</Chip>
            </View>
            {item.instructions ? <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[1] }}>{item.instructions}</Text> : null}
            {mine.map((e, idx) => <EntryRow key={e.id} e={e} last={idx === mine.length - 1} editable={!done} />)}
            {!done ? (
              <View style={styles.actions}>
                <TextButton icon="plus" onPress={() => startEntry(item)}>Cargar serie</TextButton>
                <TextButton icon="play" onPress={() => recordWith(item, nextSetIndex(entries, item.id, item.name))}>{source.kind === "none" ? "Grabar (sin fuente)" : "Grabar con plantillas"}</TextButton>
              </View>
            ) : null}
          </Card>
        );
      })}

      <Card title={items.length ? "Fuera de la rutina" : "Ejercicios"} style={{ marginBottom: space[3] }}>
        {freeEntries.length === 0 ? <Text variant="caption" color={colors.textSecondary}>{items.length ? "Nada por fuera de la rutina." : "Todavía no cargaste series."}</Text> : null}
        {freeEntries.map((e, idx) => <EntryRow key={e.id} e={e} last={idx === freeEntries.length - 1} editable={!done} />)}
        {!done ? (
          <View style={styles.actions}>
            <TextButton icon="plus" onPress={() => startEntry(null)}>Cargar ejercicio</TextButton>
            <TextButton icon="play" onPress={() => recordWith(null, nextSetIndex(entries, null, "ejercicio"))}>Grabar con plantillas</TextButton>
          </View>
        ) : null}
      </Card>
      {workout.notes ? <Text variant="body" color={colors.textSecondary}>Notas: {workout.notes}</Text> : null}
      <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[2] }}>Lo que cargás acá lo declarás vos; la app no lo mide. Las sesiones de plantillas vinculadas aparecen en Historial con el ejercicio y la serie.</Text>
    </Screen>

    <Sheet visible={!!editing} onDismiss={() => { setEditing(null); setEntryErrors([]); }} title={editing?.item ? `${editing.item.name} · serie ${editing.draft.set_index}` : "Cargar ejercicio"}>
      {editing ? (
        <>
          {!editing.item ? (
            <>
              <TextInput value={editing.draft.item_name} onChangeText={(v) => patch({ item_name: v })} placeholder="Ejercicio" placeholderTextColor={colors.textSecondary} style={styles.input} />
              <View style={styles.chips}>
                {(Object.keys(KIND_LABEL) as ItemKind[]).map((k) => <Chip key={k} variant={editing.draft.kind === k ? "selected" : "neutral"} onPress={() => patch({ kind: k })}>{KIND_LABEL[k]}</Chip>)}
              </View>
            </>
          ) : null}
          <View style={styles.row}>
            {editing.draft.kind === "walk_run" ? (
              <>
                <Field label="Tiempo (min)" value={editing.draft.duration_s === null ? "" : String(Math.round(editing.draft.duration_s / 60))} onChange={(v) => patch({ duration_s: numOrNull(v) === null ? null : Math.round((numOrNull(v) ?? 0) * 60) })} />
                <Field label="Distancia (km)" value={editing.draft.distance_m === null ? "" : String(editing.draft.distance_m / 1000)} onChange={(v) => patch({ distance_m: numOrNull(v) === null ? null : Math.round((numOrNull(v) ?? 0) * 1000) })} />
              </>
            ) : editing.draft.kind === "strength" ? (
              <>
                <Field label="Serie" value={String(editing.draft.set_index ?? "")} onChange={(v) => patch({ set_index: numOrNull(v) })} />
                <Field label="Repeticiones" value={editing.draft.reps === null ? "" : String(editing.draft.reps)} onChange={(v) => patch({ reps: numOrNull(v) })} />
                <Field label="Peso (kg)" value={editing.draft.weight_kg === null ? "" : String(editing.draft.weight_kg)} onChange={(v) => patch({ weight_kg: numOrNull(v) })} />
              </>
            ) : (
              <Field label="Tiempo (min)" value={editing.draft.duration_s === null ? "" : String(Math.round(editing.draft.duration_s / 60))} onChange={(v) => patch({ duration_s: numOrNull(v) === null ? null : Math.round((numOrNull(v) ?? 0) * 60) })} />
            )}
            <Field label="RPE 1–10" value={editing.draft.rpe === null ? "" : String(editing.draft.rpe)} onChange={(v) => patch({ rpe: numOrNull(v) })} />
          </View>
          <TextInput value={editing.draft.discomfort_note ?? ""} onChangeText={(v) => patch({ discomfort_note: v || null })} placeholder="Molestia o dolor (se anota tal cual, no se interpreta)" placeholderTextColor={colors.textSecondary} style={styles.input} />
          <TextInput value={editing.draft.notes ?? ""} onChangeText={(v) => patch({ notes: v || null })} placeholder="Notas" placeholderTextColor={colors.textSecondary} style={styles.input} />
          {entryErrors.map((e) => <Text key={e} variant="caption" color={colors.alert}>· {e}</Text>)}
          <Button variant="primary" onPress={() => void saveEntry()}>Guardar serie</Button>
        </>
      ) : null}
    </Sheet>

    <Sheet visible={confirmFinish} onDismiss={() => setConfirmFinish(false)} title="Finalizar entrenamiento">
      <Text variant="body" color={colors.textSecondary}>{summary.strength_sets} series · volumen {summary.volume_kg} kg·rep · caminata {fmtDuration(summary.walk_run_duration_s)} · {detail.links.length} sesión(es) vinculada(s).</Text>
      <TextInput value={notes} onChangeText={setNotes} placeholder="Notas del entrenamiento (opcional)" placeholderTextColor={colors.textSecondary} style={styles.input} />
      <Button variant="primary" onPress={() => { setConfirmFinish(false); void finishWorkout(workout.id, notes); }}>Finalizar</Button>
    </Sheet>
    </>
  );
}

function EntryRow({ e, last, editable }: { e: WorkoutEntry; last: boolean; editable: boolean }) {
  return (
    <View style={styles.entryRow}>
      <View style={{ flex: 1 }}>
        <ListRow title={describeEntry(e)} subtitle={[e.discomfort_note ? `molestia: ${e.discomfort_note}` : null, e.notes].filter(Boolean).join(" · ") || undefined} chevron={false} last={last} />
      </View>
      {editable ? (
        <Pressable onPress={() => void deleteEntry(e.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Quitar serie"><Icon name="close" size={18} color={colors.textSecondary} /></Pressable>
      ) : null}
    </View>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text variant="caption" color={colors.textSecondary}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={colors.textSecondary} style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", gap: space[2], marginBottom: space[4] },
  third: { flex: 1 },
  itemHead: { flexDirection: "row", alignItems: "center", gap: space[3] },
  actions: { flexDirection: "row", gap: space[4], marginTop: space[2], flexWrap: "wrap" },
  entryRow: { flexDirection: "row", alignItems: "center", gap: space[2] },
  row: { flexDirection: "row", gap: space[2] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  input: { minHeight: size.controlHeight, borderRadius: radius.md, borderWidth: size.hairline, borderColor: colors.line, backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: space[4], fontFamily: fonts.regular, fontSize: 16 },
});
