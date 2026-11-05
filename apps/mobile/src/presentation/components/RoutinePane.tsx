import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { describeEntry, describeTarget, doneSets, targetSets, type ItemKind, type RoutineItem } from "@plantillas/training";
import { Button } from "./Button";
import { Card } from "./Card";
import { Chip } from "./Chip";
import { Icon } from "./Icon";
import { ListRow } from "./ListRow";
import { Text } from "./Text";
import { TextButton } from "./TextButton";
import { colors, fonts, formatDuration, radius, size, space } from "../theme/tokens";
import {
  currentItem, cursorLabel, declareFreeEntry, declareSet, draftForCurrent, jumpToItem, restLeft, skipRestNow, walkDiscard, walkLeft, walkSeconds, walkToggle,
  type ActivityRun,
} from "../../application/activityStore";
import { deleteEntry, type EntryDraft } from "../../application/trainingStore";

const KIND_LABEL: Record<ItemKind, string> = { strength: "Fuerza", walk_run: "Caminata / carrera", other: "Otro" };
const numOrNull = (v: string): number | null => (v.trim() === "" ? null : Number(v.replace(",", ".")));
const fmtKg = (n: number | null): string => (n === null ? "" : Number.isInteger(n) ? String(n) : String(n));

/**
 * Rutina ejercicio por ejercicio (ajuste 4/11): la serie en curso con sus
 * valores precargados y editables, «Listo» la declara y abre el descanso;
 * la caminata corre con cronómetro; la progresión queda debajo. Todo lo
 * que se carga es declarado por la persona; la app no lo mide.
 */
export function RoutinePane({ run }: { run: ActivityRun }) {
  const cur = currentItem(run);
  const rest = restLeft(run);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [free, setFree] = useState<EntryDraft | null>(null);
  const cursorKey = cur ? `${cur.item.id}:${cur.setIndex}` : "none";
  const lastKey = useRef<string>("");
  const scroll = useRef<ScrollView>(null);
  // El borrador se rearma cuando cambia la serie en curso (nunca mientras la persona escribe).
  useEffect(() => {
    if (lastKey.current === cursorKey) return;
    lastKey.current = cursorKey;
    setDraft(cur ? draftForCurrent(run, cur) : null);
    setErrors([]);
  }, [cursorKey, cur, run]);

  const patch = (p: Partial<EntryDraft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const done = async () => {
    if (!draft || !cur) return;
    setSaving(true);
    const d = cur.item.kind === "walk_run" ? { ...draft, duration_s: draft.duration_s ?? walkSeconds(run) } : draft;
    const errs = await declareSet(d);
    setSaving(false);
    setErrors(errs);
    if (!errs.length && cur.item.kind === "walk_run") walkDiscard();
  };

  const items = run.items;
  const entries = run.detail.entries;

  return (
    <View>
      {/* Progreso por ejercicio: tocá uno para saltar a él. */}
      {items.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.progress}>
          {items.map((it, idx) => {
            const d = doneSets(it, entries), t = targetSets(it);
            const on = cur?.index === idx;
            return (
              <Chip key={it.id} variant={on ? "selected" : "neutral"} icon={d >= t ? "check" : undefined} onPress={() => jumpToItem(idx)}>{`${idx + 1} · ${it.name}${t > 1 ? ` ${d}/${t}` : d >= t ? "" : ""}`}</Chip>
            );
          })}
        </ScrollView>
      ) : null}

      {rest > 0 ? (
        <Card elevated style={styles.rest}>
          <Text variant="label" color={colors.textSecondary}>Descanso</Text>
          <Text variant="numXl" color={colors.accent}>{formatDuration(rest * 1000)}</Text>
          <Text variant="caption" color={colors.textSecondary}>{cur ? `Después: ${cursorLabel(run).replace(/^Ejercicio \d+ de \d+ · /, "")}` : "Rutina completa"}</Text>
          <View style={{ marginTop: space[3] }}>
            <Button onPress={skipRestNow}>Saltar descanso</Button>
          </View>
        </Card>
      ) : null}

      {cur && draft ? (
        <Card style={{ marginTop: space[4] }}>
          <Text variant="caption" color={colors.textSecondary}>{cursorLabel(run)}</Text>
          <Text variant="heading" style={{ marginTop: space[1] }}>{cur.item.name}</Text>
          <Text variant="caption" color={colors.textSecondary}>{KIND_LABEL[cur.item.kind]} · objetivo {describeTarget(cur.item)}</Text>
          {cur.item.instructions ? <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[1] }}>{cur.item.instructions}</Text> : null}

          {cur.item.kind === "strength" ? (
            <View style={styles.row}>
              <Field label="Repeticiones" value={draft.reps === null ? "" : String(draft.reps)} onChange={(v) => patch({ reps: numOrNull(v) })} />
              <Field label="Peso (kg)" value={fmtKg(draft.weight_kg)} onChange={(v) => patch({ weight_kg: numOrNull(v) })} />
              <Field label="RPE 1–10" value={draft.rpe === null ? "" : String(draft.rpe)} onChange={(v) => patch({ rpe: numOrNull(v) })} />
            </View>
          ) : cur.item.kind === "walk_run" ? (
            <WalkTimer run={run} item={cur.item} draft={draft} patch={patch} />
          ) : (
            <Text variant="body" color={colors.textSecondary} style={{ marginTop: space[3] }}>{cur.item.target.kind === "other" ? cur.item.target.instructions : ""}</Text>
          )}

          <TextInput value={draft.discomfort_note ?? ""} onChangeText={(v) => patch({ discomfort_note: v || null })} placeholder="Molestia o dolor (se anota tal cual, no se interpreta)" placeholderTextColor={colors.textSecondary} style={[styles.input, { marginTop: space[3] }]} />
          {errors.map((e) => <Text key={e} variant="caption" color={colors.alert} style={{ marginTop: space[1] }}>· {e}</Text>)}
          <View style={{ marginTop: space[3] }}>
            <Button variant="primary" icon="check" disabled={saving} onPress={() => void done()}>{cur.item.kind === "strength" ? `Listo · serie ${cur.setIndex} de ${cur.sets}` : cur.item.kind === "walk_run" ? "Terminé la caminata" : "Hecho"}</Button>
          </View>
          <DoneSets item={cur.item} run={run} />
        </Card>
      ) : items.length ? (
        <Card style={{ marginTop: space[4] }}>
          <Text variant="heading">Rutina completa</Text>
          <Text variant="body" color={colors.textSecondary}>{run.detail.summary.strength_sets} series · {run.detail.summary.volume_kg} kg·rep · caminata {formatDuration(run.detail.summary.walk_run_duration_s * 1000)}. Podés seguir con ejercicios fuera de la rutina o finalizar.</Text>
        </Card>
      ) : null}

      {/* Fuera de la rutina (o entrenamiento libre). */}
      <Card title={items.length ? "Fuera de la rutina" : "Ejercicios"} style={{ marginTop: space[4] }}>
        {entries.filter((e) => !e.item_id).map((e, idx, arr) => (
          <View key={e.id} style={styles.entryRow}>
            <View style={{ flex: 1 }}><ListRow title={describeEntry(e)} subtitle={e.discomfort_note ? `molestia: ${e.discomfort_note}` : undefined} chevron={false} last={idx === arr.length - 1} /></View>
            <Pressable onPress={() => void deleteEntry(e.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Quitar"><Icon name="close" size={18} color={colors.textSecondary} /></Pressable>
          </View>
        ))}
        {free ? (
          <FreeEntryForm draft={free} onChange={setFree} onCancel={() => setFree(null)} onSave={async () => { const errs = await declareFreeEntry(free); if (!errs.length) setFree(null); else setErrors(errs); }} />
        ) : (
          <TextButton icon="plus" style={{ marginTop: space[2] }} onPress={() => setFree({ item_id: null, item_name: "", kind: "strength", set_index: 1, reps: null, weight_kg: null, duration_s: null, distance_m: null, rpe: null, discomfort_note: null, notes: null })}>Cargar ejercicio</TextButton>
        )}
      </Card>
      <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[3] }}>Lo que cargás acá lo declarás vos; la app no lo mide. Si hay una sesión de plantillas grabando, cada serie queda vinculada a ella.</Text>
    </View>
  );
}

function WalkTimer({ run, item, draft, patch }: { run: ActivityRun; item: RoutineItem; draft: EntryDraft; patch: (p: Partial<EntryDraft>) => void }) {
  const running = run.state.walk !== null && run.state.walk.started_at !== null;
  const elapsed = walkSeconds(run);
  const left = walkLeft(run, item);
  const hasTarget = item.target.kind === "walk_run" && item.target.duration_min !== null;
  return (
    <View style={{ marginTop: space[3] }}>
      <View style={{ alignItems: "center" }}>
        <Text variant="label" color={colors.textSecondary}>{hasTarget ? (left > 0 ? "Falta" : "Objetivo cumplido") : "Transcurrido"}</Text>
        <Text variant="numXl" color={running ? colors.accent : colors.textPrimary}>{formatDuration((hasTarget && left > 0 ? left : elapsed) * 1000)}</Text>
        {hasTarget ? <Text variant="caption" color={colors.textSecondary}>{formatDuration(elapsed * 1000)} transcurridos</Text> : null}
      </View>
      <View style={[styles.row, { marginTop: space[3] }]}>
        <View style={{ flex: 1 }}><Button variant={running ? "secondary" : "primary"} icon={running ? "stop" : "play"} onPress={walkToggle}>{running ? "Pausar" : elapsed ? "Reanudar" : "Iniciar"}</Button></View>
      </View>
      <View style={[styles.row, { marginTop: space[3] }]}>
        <Field label="Distancia (km)" value={draft.distance_m === null ? "" : String(draft.distance_m / 1000)} onChange={(v) => patch({ distance_m: numOrNull(v) === null ? null : Math.round((numOrNull(v) ?? 0) * 1000) })} />
        <Field label="RPE 1–10" value={draft.rpe === null ? "" : String(draft.rpe)} onChange={(v) => patch({ rpe: numOrNull(v) })} />
      </View>
      <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[2] }}>Al terminar se guarda el tiempo del cronómetro{hasTarget ? "; el objetivo es orientativo" : ""}.</Text>
    </View>
  );
}

function DoneSets({ item, run }: { item: RoutineItem; run: ActivityRun }) {
  const mine = run.detail.entries.filter((e) => e.item_id === item.id);
  if (!mine.length) return null;
  return (
    <View style={{ marginTop: space[3] }}>
      <Text variant="label" color={colors.textSecondary}>Hechas</Text>
      {mine.map((e, idx) => (
        <View key={e.id} style={styles.entryRow}>
          <View style={{ flex: 1 }}><ListRow title={describeEntry(e).replace(`${e.item_name} · `, "")} subtitle={e.discomfort_note ? `molestia: ${e.discomfort_note}` : undefined} chevron={false} last={idx === mine.length - 1} /></View>
          <Pressable onPress={() => void deleteEntry(e.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Quitar serie"><Icon name="close" size={18} color={colors.textSecondary} /></Pressable>
        </View>
      ))}
    </View>
  );
}

function FreeEntryForm({ draft, onChange, onCancel, onSave }: { draft: EntryDraft; onChange: (d: EntryDraft) => void; onCancel: () => void; onSave: () => Promise<void> }) {
  const patch = (p: Partial<EntryDraft>) => onChange({ ...draft, ...p });
  return (
    <View style={{ marginTop: space[3], gap: space[2] }}>
      <TextInput value={draft.item_name} onChangeText={(v) => patch({ item_name: v })} placeholder="Ejercicio" placeholderTextColor={colors.textSecondary} style={styles.input} />
      <View style={styles.chips}>
        {(Object.keys(KIND_LABEL) as ItemKind[]).map((k) => <Chip key={k} variant={draft.kind === k ? "selected" : "neutral"} onPress={() => patch({ kind: k })}>{KIND_LABEL[k]}</Chip>)}
      </View>
      <View style={styles.row}>
        {draft.kind === "strength" ? (
          <>
            <Field label="Serie" value={String(draft.set_index ?? "")} onChange={(v) => patch({ set_index: numOrNull(v) })} />
            <Field label="Reps" value={draft.reps === null ? "" : String(draft.reps)} onChange={(v) => patch({ reps: numOrNull(v) })} />
            <Field label="Peso (kg)" value={fmtKg(draft.weight_kg)} onChange={(v) => patch({ weight_kg: numOrNull(v) })} />
          </>
        ) : (
          <>
            <Field label="Tiempo (min)" value={draft.duration_s === null ? "" : String(Math.round(draft.duration_s / 60))} onChange={(v) => patch({ duration_s: numOrNull(v) === null ? null : Math.round((numOrNull(v) ?? 0) * 60) })} />
            {draft.kind === "walk_run" ? <Field label="Distancia (km)" value={draft.distance_m === null ? "" : String(draft.distance_m / 1000)} onChange={(v) => patch({ distance_m: numOrNull(v) === null ? null : Math.round((numOrNull(v) ?? 0) * 1000) })} /> : null}
          </>
        )}
        <Field label="RPE" value={draft.rpe === null ? "" : String(draft.rpe)} onChange={(v) => patch({ rpe: numOrNull(v) })} />
      </View>
      <View style={[styles.row, { marginTop: space[1] }]}>
        <View style={{ flex: 1 }}><Button onPress={onCancel}>Cancelar</Button></View>
        <View style={{ flex: 1 }}><Button variant="primary" onPress={() => void onSave()}>Guardar</Button></View>
      </View>
    </View>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text variant="caption" color={colors.textSecondary}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={colors.textSecondary} style={styles.input} selectTextOnFocus />
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { gap: space[2], paddingVertical: space[1] },
  rest: { marginTop: space[4], alignItems: "center", gap: space[1] },
  row: { flexDirection: "row", gap: space[2], marginTop: space[3] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  entryRow: { flexDirection: "row", alignItems: "center", gap: space[2] },
  input: { minHeight: size.controlHeight, borderRadius: radius.md, borderWidth: size.hairline, borderColor: colors.line, backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: space[4], fontFamily: fonts.regular, fontSize: 16 },
});
