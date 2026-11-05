import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import type { ChannelCode } from "@plantillas/contract";
import { ROUTINE_CATEGORY_LABEL } from "@plantillas/training";
import { isInstrumented } from "@plantillas/metrics";
import { AssistantFab, Button, Card, Chip, Halo, Icon, ListRow, MeterRow, Ring, Screen, Sheet, StatusBanner, Text, TextButton, ValueCard } from "../../presentation/components";
import { colors, formatDuration, formatNumber, radius, size, space } from "../../presentation/theme/tokens";
import { useSessionList } from "../../application/useSessions";
import { useActiveSession, ACTIVITY_LABEL, type Activity } from "../../application/sessionStore";
import { useActiveSource } from "../../application/activeSource";
import { useAuth } from "../../application/authStore";
import { availableDays, dayLabel, describeDistribution, todayKey, useDaySummary, type DaySummary } from "../../application/daySummary";
import { listRoutines, useTrainingVersion, workoutForDay, type RoutineWithItems, type WorkoutDetail } from "../../application/trainingStore";
import { cursorLabel, startActivity, useActivity } from "../../application/activityStore";

/**
 * Inicio («Hoy»): un día navegable con tres indicadores del día (reparto
 * izquierda/derecha, antepié/retropié y calidad de los datos), el resumen del
 * día, sus sesiones y la acción de grabar. Los indicadores son proporciones
 * entre medias de la señal en cuentas ADC (`dist-1.0`): describen el reparto
 * de la lectura, no fuerza, presión, rendimiento ni un puntaje.
 */

type Panel = "balance" | "zones" | "quality";


const DAYS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function formatDayLong(day: string): string {
  const [y, m, dd] = day.split("-").map(Number);
  const d = new Date(y!, m! - 1, dd!);
  return `${DAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
}

const POSITION_LABEL: Record<ChannelCode, string> = {
  L_HEEL: "Talón izq.", L_MEDIAL: "Medial izq.", L_LATERAL: "Lateral izq.", R_HEEL: "Talón der.", R_MEDIAL: "Medial der.", R_LATERAL: "Lateral der.",
};
const POSITION_ORDER: ChannelCode[] = ["L_HEEL", "R_HEEL", "L_MEDIAL", "R_MEDIAL", "L_LATERAL", "R_LATERAL"];

const pct = (f: number | null): string => (f === null ? "—" : `${Math.round(f * 100)} %`);
const timeOf = (iso: string): string => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

export default function HomeScreen() {
  const router = useRouter();
  const { sessions, error, reload } = useSessionList();
  const active = useActiveSession();
  const source = useActiveSource();
  const auth = useAuth();
  const [day, setDay] = useState(todayKey());
  const [panel, setPanel] = useState<Panel | null>(null);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  // Tocar la pestaña «Hoy» estando en Hoy vuelve al día de hoy (brief, enmienda 27/10).
  const navigation = useNavigation();
  useEffect(() => navigation.addListener("tabPress" as never, () => { if (navigation.isFocused()) setDay(todayKey()); }), [navigation]);
  const { summary, error: dayError } = useDaySummary(day, sessions);
  // Entrenamiento del día (ADR 0013): el de hoy en curso o terminado; para otros días, el de esa fecha.
  const trainingVersion = useTrainingVersion();
  const [workout, setWorkout] = useState<WorkoutDetail | undefined>();
  const [routines, setRoutines] = useState<RoutineWithItems[]>([]);
  const [pickRoutine, setPickRoutine] = useState(false);
  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      const w = await workoutForDay(day);
      const r = await listRoutines();
      if (alive) { setWorkout(w); setRoutines(r); }
    })().catch(() => undefined);
    return () => { alive = false; };
  }, [day, trainingVersion]));
  const run = useActivity();
  // Entrenar sin plantillas (ajuste 4/11): abre la actividad con la rutina elegida (o libre) sin fuente de datos.
  const beginWorkout = async (routineId: string | null) => {
    setPickRoutine(false);
    await startActivity(routineId);
    router.push("/grabacion");
  };

  const days = availableDays(sessions ?? []);
  const index = days.indexOf(day);
  const newer = index > 0 ? days[index - 1] : undefined;
  const older = index >= 0 && index < days.length - 1 ? days[index + 1] : undefined;
  const recording = active && !active.result;
  const d = summary?.distribution;
  const ready = summary !== undefined && summary.day === day;

  return (
    <>
    <Screen
      tabbed
      footer={
        recording ? (
          <Button variant="primary" icon="play" onPress={() => router.push("/grabacion")}>Volver a la sesión en curso</Button>
        ) : (
          <Button variant="primary" icon="plus" disabled={source.kind === "none"} onPress={() => router.push("/preparacion")}>Nueva sesión</Button>
        )
      }
    >
      <Halo />
      {/* Cabecera: día navegable, centrada; Ajustes vive en la barra inferior. */}
      <View style={styles.headerRow}>
        <Pressable onPress={older ? () => setDay(older) : undefined} disabled={!older} hitSlop={8} accessibilityRole="button" accessibilityLabel="Día anterior" style={[styles.navBtn, !older && { opacity: 0.3 }]}>
          <Icon name="chevron-left" color={colors.textPrimary} />
        </Pressable>
        <Pressable onPress={day !== todayKey() ? () => setDay(todayKey()) : undefined} disabled={day === todayKey()} accessibilityRole="button" accessibilityLabel="Volver a hoy" style={{ flex: 1, alignItems: "center" }}>
          <Text variant="title">{dayLabel(day)}</Text>
          <Text variant="caption" color={day === todayKey() ? colors.textSecondary : colors.accent} numberOfLines={1}>{day === todayKey() ? formatDayLong(day) : "Tocá para volver a hoy"}</Text>
        </Pressable>
        <Pressable onPress={newer ? () => setDay(newer) : undefined} disabled={!newer} hitSlop={8} accessibilityRole="button" accessibilityLabel="Día siguiente" style={[styles.navBtn, !newer && { opacity: 0.3 }]}>
          <Icon name="chevron-right" color={colors.textPrimary} />
        </Pressable>
      </View>
      <View style={styles.sourceRow}>
        <View style={[styles.dot, { backgroundColor: source.kind === "none" ? colors.stale : colors.accent }]} />
        <Text variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ flexShrink: 1 }}>{source.title}{auth.status === "signed_in" && auth.email ? ` · ${auth.email}` : ""}</Text>
      </View>

      {/* Tres indicadores del día, agrupados en una tarjeta. */}
      <Text variant="label" color={colors.textSecondary} style={styles.sectionLabel}>Indicadores del día</Text>
      <Card style={{ paddingVertical: space[6] }}>
        <View style={styles.rings}>
          <Ring layout="sides" value={ready ? d?.left_share ?? null : null} text={ready ? (d && !d.bilateral && !d.unavailable_reason ? "n/d" : pct(d?.left_share ?? null)) : "…"} inner={d && !d.bilateral && !d.unavailable_reason ? "ambos pies" : "pie izq."} label="Izq / der" legend={ready && d && d.left_share !== null ? [`${Math.round(d.left_share * 100)} izq`, `${Math.round((d.right_share ?? 0) * 100)} der`] : ["izq", "der"]} onPress={() => setPanel("balance")} />
          <Ring layout="top" value={ready ? d?.forefoot_share ?? null : null} text={ready ? pct(d?.forefoot_share ?? null) : "…"} inner="antepié" label="Antepié / talón" legend={ready && d && d.forefoot_share !== null ? [`${Math.round(d.forefoot_share * 100)} ante`, `${Math.round((d.rearfoot_share ?? 0) * 100)} talón`] : ["antepié", "talón"]} onPress={() => setPanel("zones")} />
          <Ring layout="progress" value={ready ? summary.quality : null} text={ready ? pct(summary.quality) : "…"} inner="recibido" label="Calidad" legend={ready && summary.quality !== null ? [`${formatNumber(summary.records)} reg.`, `${formatNumber(Math.max(0, summary.expected - summary.records))} falt.`] : ["recibido", "faltante"]} color={ready && summary.quality !== null && summary.quality < 0.98 ? colors.alert : colors.accent} onPress={() => setPanel("quality")} />
        </View>
      </Card>

      {error ? (
        <View style={{ marginTop: space[6] }}>
          <StatusBanner tone="alert" icon="alert" detail={error} actionLabel="Reintentar" onAction={() => void reload()}>No se pudo leer el historial</StatusBanner>
        </View>
      ) : null}
      {dayError ? <Text variant="caption" color={colors.alert} style={{ marginTop: space[3] }}>No se pudo resumir el día: {dayError}</Text> : null}

      {/* Resumen del día. */}
      <Text variant="label" color={colors.textSecondary} style={[styles.sectionLabel, { marginTop: space[8] }]}>Resumen del día</Text>
      <View style={styles.grid}>
        <ValueCard label="Sesiones" value={ready ? summary.sessions.length : "…"} sub={ready ? `${summary.physical} físicas · ${summary.simulated} simuladas` : ""} style={styles.half} />
        <ValueCard label="Tiempo grabado" value={ready ? formatDuration(summary.durationMs) : "…"} unit="min" sub={ready ? `${formatNumber(summary.records)} registros` : ""} style={styles.half} />
        <ValueCard label="Carga acumulada" value={ready ? (summary.load === null ? null : formatLoad(summary.load)) : "…"} unit={ready && summary.load !== null ? "cuentas·s" : undefined} sub="aproximada · sin calibración" style={styles.half} />
        <ValueCard label="Huecos y fallas" value={ready ? `${summary.gaps} · ${summary.readErrors}` : "…"} sub="huecos · lecturas fallidas" style={styles.half} />
      </View>

      {/* Entrenamiento (ADR 0013, ajuste 4/11): puerta a la actividad en curso, a iniciar una rutina o a gestionarlas. */}
      <Text variant="label" color={colors.textSecondary} style={[styles.sectionLabel, { marginTop: space[8] }]}>Entrenamiento</Text>
      {run && day === todayKey() ? (
        <ListRow
          lead="En curso"
          title={run.detail.routine?.routine.name ?? "Entrenamiento libre"}
          subtitle={`${cursorLabel(run)} · ${run.detail.summary.strength_sets} series · ${run.detail.links.length} sesión(es) vinculada(s)`}
          chip={<Chip variant="selected" icon="dumbbell">Seguir</Chip>}
          onPress={() => router.push("/grabacion")}
        />
      ) : workout ? (
        <ListRow
          lead={workout.workout.state === "in_progress" ? "En curso" : "Hecho"}
          title={workout.routine?.routine.name ?? "Entrenamiento libre"}
          subtitle={`${workout.summary.strength_sets} series · ${workout.summary.volume_kg} kg·rep · ${Math.round(workout.summary.walk_run_duration_s / 60)} min caminata · ${workout.links.length} sesión(es) vinculada(s)`}
          chip={<Chip variant="neutral" icon="dumbbell">Ver</Chip>}
          onPress={() => router.push({ pathname: "/entrenamiento", params: { id: workout.workout.id } })}
        />
      ) : day === todayKey() ? (
        <View style={styles.trainingEmpty}>
          <Icon name="dumbbell" size={24} />
          <Text variant="body" color={colors.textSecondary} style={{ flex: 1 }}>{routines.length ? "Iniciá una rutina o entrená libre; las series se vinculan a la sesión de plantillas si está grabando." : "Todavía no hay rutinas: creá una o empezá un entrenamiento libre."}</Text>
        </View>
      ) : (
        <Text variant="caption" color={colors.textSecondary}>Sin entrenamiento registrado este día.</Text>
      )}
      {day === todayKey() ? (
        <View style={styles.trainingActions}>
          {!run ? <TextButton icon="play" onPress={() => (routines.length ? setPickRoutine(true) : void beginWorkout(null))}>{routines.length ? "Iniciar rutina" : "Entrenar libre"}</TextButton> : null}
          <TextButton icon="plus" onPress={() => router.push("/ajustes/rutina")}>Crear rutina</TextButton>
          {routines.length ? <TextButton icon="chevron-right" onPress={() => router.push("/ajustes/rutinas")}>Ver rutinas</TextButton> : null}
        </View>
      ) : null}

      {/* Sesiones del día. */}
      <Text variant="label" color={colors.textSecondary} style={[styles.sectionLabel, { marginTop: space[6] }]}>Sesiones del día</Text>
      {sessions === null ? (
        <Text variant="caption" color={colors.textSecondary}>Cargando…</Text>
      ) : !ready || summary.sessions.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="foot" size={28} />
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: "center" }}>
            {day === todayKey() ? `Sin sesiones todavía. ${source.kind === "physical" ? "Las plantillas están conectadas." : source.kind === "simulated" ? "El simulador está listo." : "Conectá las plantillas."} Tocá Nueva sesión para grabar.` : "Sin sesiones este día."}
          </Text>
        </View>
      ) : (
        summary.sessions.map((s) => (
          <ListRow
            key={s.id}
            title={`${timeOf(s.started_at)} · ${ACTIVITY_LABEL[s.activity as Activity] ?? s.activity}`}
            subtitle={`${formatDuration(s.duration_ms ?? 0)} min · ${formatNumber(s.record_count)} registros${s.gap_count ? ` · ${s.gap_count} hueco(s)` : ""}`}
            chip={s.state === "incomplete" ? <Chip variant="alert">Incompleta</Chip> : s.source === "simulated" ? <Chip variant="sim" icon="settings">Simulada</Chip> : <Chip icon="bluetooth">Física</Chip>}
            onPress={() => router.push({ pathname: "/historial/sesion/[id]", params: { id: s.id } }, { withAnchor: true })}
          />
        ))
      )}
      {sessions && sessions.length > 0 ? (
        <TextButton icon="chevron-right" style={{ marginTop: space[3] }} onPress={() => router.navigate("/historial")}>
          {`Ver las ${formatNumber(sessions.length)} sesiones en Historial`}
        </TextButton>
      ) : null}
    </Screen>
    <AssistantFab bottomOffset={96} />
    <Sheet visible={pickRoutine} onDismiss={() => setPickRoutine(false)} title="¿Qué rutina?">
      <Text variant="caption" color={colors.textSecondary}>Entrenás sin plantillas; si querés medir, iniciá la sesión desde «Nueva sesión» y elegí la rutina ahí.</Text>
      {routines.map((r, idx) => <ListRow key={r.routine.id} title={r.routine.name} subtitle={`${r.routine.category ? `${ROUTINE_CATEGORY_LABEL[r.routine.category]} · ` : ""}${r.items.length} ejercicio(s)${r.routine.origin === "professional" ? " · profesional" : ""}`} onPress={() => void beginWorkout(r.routine.id)} last={idx === routines.length - 1} />)}
      <TextButton icon="plus" onPress={() => void beginWorkout(null)}>Entrenamiento libre (sin rutina)</TextButton>
    </Sheet>

    {/* Desglose del indicador elegido. */}
    <Sheet visible={panel !== null} onDismiss={() => setPanel(null)} floating title={panel === "balance" ? "Izquierda / derecha" : panel === "zones" ? "Antepié / talón" : "Calidad de los datos"}>
      {panel && ready ? <Breakdown panel={panel} summary={summary} /> : null}
    </Sheet>
    </>
  );
}

function formatLoad(load: number): string {
  if (load >= 1_000_000) return `${formatNumber(load / 1_000_000, 2)} M`;
  if (load >= 10_000) return `${formatNumber(load / 1000, 1)} k`;
  return formatNumber(load);
}

function Breakdown({ panel, summary }: { panel: Panel; summary: DaySummary }) {
  const d = summary.distribution;
  const ch = summary.channels;
  const note = (text: string) => <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[2] }}>{text}</Text>;

  if (panel === "quality") {
    return (
      <>
        <Text variant="body" color={colors.textSecondary}>Cuánto de lo que las plantillas emitieron llegó y se guardó. No describe al usuario: describe la captura.</Text>
        <MeterRow label="Registros recibidos" fraction={summary.quality} value={pct(summary.quality)} />
        <MeterRow label="Esperados" fraction={null} value={formatNumber(summary.expected)} />
        <MeterRow label="Huecos de secuencia" fraction={summary.expected ? Math.min(1, (summary.expected - summary.records) / summary.expected) : null} value={formatNumber(summary.gaps)} color={colors.alert} />
        <MeterRow label="Lecturas fallidas" fraction={summary.records ? Math.min(1, summary.readErrors / (summary.records * 6)) : null} value={formatNumber(summary.readErrors)} color={colors.alert} />
        {note(`${summary.measured} sesión(es) con capturas aportan a este día. Un registro trae una lectura por posición instrumentada (seis con ambos pies, tres con el módulo unilateral); una lectura fallida (read_error) se guarda como tal y no se interpola.`)}
      </>
    );
  }

  if (!d || !ch || d.unavailable_reason) {
    return (
      <>
        <Text variant="body" color={colors.textSecondary}>{d ? describeDistribution(d) : "Sin sesiones con capturas en este día."}</Text>
      </>
    );
  }

  if (panel === "balance") {
    if (!d.bilateral) {
      // Módulo unilateral: el reparto entre pies y la asimetría requieren ambos pies instrumentados.
      return (
        <>
          <Text variant="body" color={colors.textSecondary}>{describeDistribution(d)}</Text>
          <MeterRow label="Pie izquierdo" fraction={null} value="n/d" />
          <MeterRow label="Pie derecho" fraction={null} value="n/d" color={colors.accentDeep} />
          {note("Requiere ambos pies: la configuración actual instrumenta un solo pie (módulo unilateral). El reparto izquierda/derecha y la diferencia por zona quedan como no disponibles, no como cero.")}
        </>
      );
    }
    return (
      <>
        <Text variant="body" color={colors.textSecondary}>{describeDistribution(d)}</Text>
        <MeterRow label="Pie izquierdo" fraction={d.left_share} value={pct(d.left_share)} />
        <MeterRow label="Pie derecho" fraction={d.right_share} value={pct(d.right_share)} color={colors.accentDeep} />
        <Text variant="label" color={colors.textSecondary} style={{ marginTop: space[3] }}>Diferencia por zona (izq − der)</Text>
        <MeterRow label="Talón" fraction={d.asymmetry.heel} value={signedPct(d.asymmetry.heel)} centered />
        <MeterRow label="Medial" fraction={d.asymmetry.medial} value={signedPct(d.asymmetry.medial)} centered />
        <MeterRow label="Lateral" fraction={d.asymmetry.lateral} value={signedPct(d.asymmetry.lateral)} centered />
        {note(`El anillo sigue al cuerpo: lado izquierdo = pie izquierdo. Proporción entre las medias de las posiciones de cada pie (${formatNumber(d.total_mean)} cuentas en total). Positivo = más lectura a la izquierda. Es un descriptor de la lectura en cuentas ADC; sin calibración no equivale a fuerza ni a peso.`)}
      </>
    );
  }

  return (
    <>
      <Text variant="body" color={colors.textSecondary}>{describeDistribution(d)}</Text>
      <MeterRow label="Antepié (medial + lateral)" fraction={d.forefoot_share} value={pct(d.forefoot_share)} />
      <MeterRow label="Talón" fraction={d.rearfoot_share} value={pct(d.rearfoot_share)} color={colors.accentDeep} />
      <Text variant="label" color={colors.textSecondary} style={{ marginTop: space[3] }}>Media por posición (cuentas ADC)</Text>
      {POSITION_ORDER.map((code) => (
        <MeterRow key={code} label={POSITION_LABEL[code]} fraction={ch[code].sample_mean === null || d.total_mean === null ? null : ch[code].sample_mean / d.total_mean} value={!isInstrumented(ch[code]) ? "n/d" : ch[code].sample_mean === null ? "—" : formatNumber(ch[code].sample_mean)} />
      ))}
      <MeterRow label="Variabilidad (σ / media)" fraction={d.variability} value={d.variability === null ? "—" : formatNumber(d.variability, 2)} />
      {note("El anillo sigue al cuerpo: arriba = antepié, abajo = talón. Medias ponderadas por lecturas válidas de todas las capturas del día. La variabilidad indica cuánto cambian las lecturas alrededor de su media; no se interpreta como estabilidad del usuario sin evidencia experimental.")}
    </>
  );
}

const signedPct = (f: number | null): string => (f === null ? "—" : `${f > 0 ? "+" : f < 0 ? "−" : ""}${Math.round(Math.abs(f) * 100)} %`);

const styles = StyleSheet.create({
  trainingActions: { flexDirection: "row", flexWrap: "wrap", gap: space[4], marginTop: space[3] },
  trainingEmpty: { flexDirection: "row", alignItems: "center", gap: space[3], padding: space[3], borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: size.hairline, borderColor: colors.line },
  headerRow: { flexDirection: "row", alignItems: "center", gap: space[1] },
  sourceRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2], marginTop: space[2], marginBottom: space[6] },
  sectionLabel: { marginBottom: space[3] },
  navBtn: { width: size.controlHeight, height: size.controlHeight, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rings: { flexDirection: "row", justifyContent: "space-between", gap: space[2] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space[3] },
  half: { flexBasis: "47%", flexGrow: 1 },
  empty: { alignItems: "center", paddingVertical: space[6], paddingHorizontal: space[6], gap: space[3], backgroundColor: colors.surface, borderRadius: radius.md },
});
