import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import type { ChannelCode } from "@plantillas/contract";
import { BigNumbers, Button, Chip, FootMap, Icon, LineChart, RoutinePane, Screen, Segmented, Sheet, StatusBanner, Text, ValueCard } from "../presentation/components";
import { colors, fonts, formatDuration, formatNumber, radius, size, space } from "../presentation/theme/tokens";
import { ACTIVITY_LABEL, clearSession, liveSeries, stopSession, useActiveSession, type ActiveSession } from "../application/sessionStore";
import { loadSettings, saveSettings } from "../infrastructure/settings/settings";
import { cursorLabel, finishActivity, isEmptyRun, useActivity } from "../application/activityStore";

type Zone = "heel" | "medial" | "lateral";
const ZONE_CHANNELS: Record<Zone, [ChannelCode, ChannelCode]> = {
  heel: ["L_HEEL", "R_HEEL"],
  medial: ["L_MEDIAL", "R_MEDIAL"],
  lateral: ["L_LATERAL", "R_LATERAL"],
};
const ZONE_LABEL: Record<Zone, string> = { heel: "Talón", medial: "Medial", lateral: "Lateral" };
const STATE_LABEL: Record<string, string> = {
  prepared: "Preparada", recording: "Grabando", interrupted: "Interrumpida", finalizing: "Finalizando", completed: "Completa", incomplete: "Incompleta",
};
const MODULE_LABEL: Record<string, string> = { identified: "sin enlace", connected: "conectado", stale: "sin datos", disconnected: "perdido", reconnecting: "reconectando" };
const FOOT_SHORT: Record<string, string> = { left: "Izq", right: "Der" };

function KeepAwake() {
  useKeepAwake();
  return null;
}

type Pane = "measure" | "routine";

/**
 * Actividad (ajuste 4/11): una sola pantalla para la sesión de plantillas y
 * la rutina. Con ambas en curso, pestañas Medición | Rutina; con una sola,
 * sólo esa. La isla flotante trae de vuelta acá desde cualquier pantalla.
 */
export default function ActivityScreen() {
  const router = useRouter();
  const active = useActiveSession();
  const run = useActivity();
  const recording = !!active && !active.result;
  const [pane, setPane] = useState<Pane>(recording ? "measure" : "routine");
  const [confirmFinishWorkout, setConfirmFinishWorkout] = useState(false);
  const [notes, setNotes] = useState("");
  const [stopping, setStopping] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [, tick] = useState(0);

  // Refresco del reloj y del gráfico aunque no lleguen registros (huecos visibles).
  const finished = !!active?.result;
  useEffect(() => {
    if (finished || !active) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [finished, active]);

  const both = !!active && !!run;
  const showPane: Pane = both ? pane : active ? "measure" : "routine";

  if (!active && !run) {
    return (
      <Screen footer={<Button variant="primary" onPress={() => router.replace("/")}>Volver al inicio</Button>}>
        <Text variant="heading">No hay una actividad en curso</Text>
        <Text variant="body" color={colors.textSecondary} style={{ marginTop: space[2] }}>Iniciá una sesión o un entrenamiento desde Hoy.</Text>
      </Screen>
    );
  }

  // Finalizar la sesión de plantillas termina toda la actividad (pulido 4/11): también el entrenamiento
  // vinculado, que se descarta si no tiene ninguna serie. «Terminar rutina» cierra sólo el entrenamiento.
  const finish = async () => {
    setConfirm(false);
    setStopping(true);
    await stopSession();
    if (run) await finishActivity();
    setStopping(false);
  };
  // El detalle se abre dentro de la pila de Historial con su lista debajo (withAnchor):
  // «atrás» vuelve a la lista y, al cambiar de pestaña, Historial vuelve a su raíz.
  const close = () => {
    const id = active!.coordinator.sessionId;
    clearSession();
    router.replace({ pathname: "/historial/sesion/[id]", params: { id } }, { withAnchor: true });
  };
  const emptyRun = isEmptyRun(run);

  const footer = showPane === "measure" && active ? (
    finished ? (
      // key distinta: elemento nativo nuevo, no el de «Finalizar» reciclado tras pasar por disabled.
      <Button key="ver" variant="primary" onPress={close}>Ver la sesión</Button>
    ) : (
      <Button key="finalizar" variant="primary" icon="stop" disabled={stopping} onPress={() => setConfirm(true)}>{stopping ? "Finalizando…" : "Finalizar sesión"}</Button>
    )
  ) : run ? (
    <Button key="fin-entreno" variant={active ? "secondary" : "primary"} icon="check" onPress={() => setConfirmFinishWorkout(true)}>{active ? "Terminar rutina" : "Finalizar entrenamiento"}</Button>
  ) : undefined;

  return (
    <>
    <Screen footer={footer}>
      {loadSettings().keepAwake && (recording || run) ? <KeepAwake /> : null}
      <View style={styles.statusRow}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver al inicio; la actividad sigue" hitSlop={8} style={styles.back}>
          <Icon name="chevron-right" size={20} color={colors.textSecondary} />
        </Pressable>
        {active ? (
          <>
            <View style={[styles.dot, { backgroundColor: active.snapshot.state === "interrupted" ? colors.alert : finished ? colors.stale : colors.accent }]} />
            <Text variant="caption" color={colors.textSecondary} style={{ flex: 1 }} numberOfLines={1}>
              {STATE_LABEL[active.snapshot.state]} · {active.sourceTitle} · {active.sourceKind === "physical" ? "físicas" : "simuladas"} · {ACTIVITY_LABEL[active.activity]}
            </Text>
          </>
        ) : run ? (
          <>
            <View style={[styles.dot, { backgroundColor: colors.alert }]} />
            <Text variant="caption" color={colors.textSecondary} style={{ flex: 1 }} numberOfLines={1}>Entrenamiento · {run.detail.routine?.routine.name ?? "libre"} · {cursorLabel(run)}</Text>
          </>
        ) : null}
      </View>
      {both ? (
        <View style={{ marginTop: space[3] }}>
          <Segmented value={pane} options={[{ value: "measure", label: "Medición" }, { value: "routine", label: `Rutina${run?.detail.routine ? "" : " libre"}` }]} onChange={setPane} />
        </View>
      ) : null}
      {showPane === "measure" && active ? <MeasurementPane active={active} /> : run ? <View style={{ marginTop: space[3] }}><RoutinePane run={run} /></View> : null}
    </Screen>

      {active ? (
        <Sheet visible={confirm} onDismiss={() => setConfirm(false)}>
          <Text variant="heading">{run ? "Finalizar sesión y entrenamiento" : "Finalizar la sesión"}</Text>
          <Text variant="body" color={colors.textSecondary}>
            Se guardan <Text variant="body">{formatDuration(active.snapshot.durationMs)}</Text> min y <Text variant="body">{formatNumber(active.snapshot.stats.accepted)}</Text> registros. Una sesión finalizada no se puede reanudar.
            {run ? (emptyRun ? " El entrenamiento no tiene series: se descarta." : ` También se cierra el entrenamiento (${run.detail.summary.strength_sets} series).`) : ""}
          </Text>
          <View style={{ gap: space[3], marginTop: space[3] }}>
            <Button variant="danger" icon="stop" onPress={() => void finish()}>{run ? "Finalizar todo" : "Finalizar"}</Button>
            <Button onPress={() => setConfirm(false)}>Seguir grabando</Button>
          </View>
        </Sheet>
      ) : null}
      {run ? (
        <Sheet visible={confirmFinishWorkout} onDismiss={() => setConfirmFinishWorkout(false)} title={recording ? "Terminar rutina" : "Finalizar entrenamiento"}>
          {emptyRun ? (
            <Text variant="body" color={colors.textSecondary}>No cargaste ninguna serie. El entrenamiento vacío se descarta{recording ? "; la sesión de plantillas sigue grabando" : ""}.</Text>
          ) : (
            <>
              <Text variant="body" color={colors.textSecondary}>{run.detail.summary.strength_sets} series · volumen {run.detail.summary.volume_kg} kg·rep · caminata {formatDuration(run.detail.summary.walk_run_duration_s * 1000)} · {run.detail.links.length} sesión(es) vinculada(s){recording ? ". La sesión de plantillas sigue grabando." : "."}</Text>
              <TextInput value={notes} onChangeText={setNotes} placeholder="Notas del entrenamiento (opcional)" placeholderTextColor={colors.textSecondary} style={styles.input} />
            </>
          )}
          <Button variant={emptyRun ? "danger" : "primary"} onPress={() => { setConfirmFinishWorkout(false); void finishActivity(emptyRun ? undefined : notes).then(() => { setNotes(""); if (!recording) router.replace("/"); }); }}>{emptyRun ? "Descartar entrenamiento vacío" : "Finalizar"}</Button>
          <Button onPress={() => setConfirmFinishWorkout(false)}>{recording ? "Seguir con la rutina" : "Seguir entrenando"}</Button>
        </Sheet>
      ) : null}
    </>
  );
}

/** Medición en vivo: duración, siluetas o números grandes, gráfico de la ventana reciente y contadores. */
function MeasurementPane({ active }: { active: ActiveSession }) {
  const [zone, setZone] = useState<Zone>("heel");
  const [bigNumbers, setBigNumbers] = useState(loadSettings().bigNumbers);
  const toggleBigNumbers = () => setBigNumbers((b) => saveSettings({ bigNumbers: !b }).bigNumbers);
  const { snapshot, result } = active;
  const finished = !!result;
  const stale = snapshot.state === "interrupted";
  const v = snapshot.values;
  // Con dos módulos (ADR 0011): si uno se pierde la sesión sigue con el otro; el tramo queda incompleto.
  const multi = snapshot.modules.length > 1;
  const lostModules = snapshot.modules.filter((m) => m.status === "reconnecting" || m.status === "disconnected");
  const partial = multi && !stale && !finished && lostModules.length > 0;
  // Una posición no instrumentada por la configuración se muestra como «n/d», nunca como cero.
  const fv = (c: ChannelCode): number | null | "unavailable" => (v[c].status === "unavailable" ? "unavailable" : v[c].value);
  const left = { heel: fv("L_HEEL"), medial: fv("L_MEDIAL"), lateral: fv("L_LATERAL") };
  const right = { heel: fv("R_HEEL"), medial: fv("R_MEDIAL"), lateral: fv("R_LATERAL") };
  const [lc, rc] = ZONE_CHANNELS[zone];
  const series = [
    ...(v[lc].status !== "unavailable" ? [{ name: "Izquierdo", values: liveSeries(active.live, lc), stale }] : []),
    ...(v[rc].status !== "unavailable" ? [{ name: "Derecho", values: liveSeries(active.live, rc), stale }] : []),
  ];
  const feetLabel = series.length === 2 ? "izquierdo y derecho" : v[lc].status !== "unavailable" ? "izquierdo · derecho no instrumentado" : "derecho · izquierdo no instrumentado";
  const rate = snapshot.durationMs > 0 ? snapshot.stats.accepted / (snapshot.durationMs / 1000) : 0;

  return (
    <>
      {/* Vista de la carga (pulido 4/11): siluetas o números grandes para mirar el teléfono de lejos. */}
      <View style={{ marginTop: space[3] }}>
        <Segmented value={bigNumbers ? "numbers" : "feet"} options={[{ value: "feet", label: "Pies" }, { value: "numbers", label: "Números grandes" }]} onChange={(v) => { if ((v === "numbers") !== bigNumbers) toggleBigNumbers(); }} />
      </View>

      {multi ? (
        <View style={styles.modules}>
          {snapshot.modules.map((m) => (
            <Chip key={m.device_id} variant={m.status === "connected" ? "selected" : "neutral"} icon={m.status === "connected" ? "bluetooth" : "bluetooth-off"}>
              {`${m.foot ? FOOT_SHORT[m.foot] : "Ambos"} · ${MODULE_LABEL[m.status]}`}
            </Chip>
          ))}
        </View>
      ) : null}
      {stale ? (
        <View style={{ marginTop: space[4] }}>
          <StatusBanner tone="alert" icon="bluetooth-off" detail="Los valores en gris son anteriores a la desconexión">Conexión interrumpida</StatusBanner>
        </View>
      ) : partial ? (
        <View style={{ marginTop: space[4] }}>
          <StatusBanner tone="alert" icon="bluetooth-off" detail={`${lostModules.map((m) => m.device_id).join(", ")} · la sesión sigue con el otro pie; este tramo no cuenta para izquierda/derecha`}>
            {`Módulo ${lostModules[0]!.foot === "left" ? "izquierdo" : "derecho"} ${MODULE_LABEL[lostModules[0]!.status]}`}
          </StatusBanner>
        </View>
      ) : null}
      {finished && result?.reason ? (
        <View style={{ marginTop: space[4] }}>
          <StatusBanner tone="alert" icon="alert" detail={result.reason}>Sesión incompleta</StatusBanner>
        </View>
      ) : null}

      <ValueCard
        label="Duración"
        value={formatDuration(snapshot.durationMs)}
        unit="min"
        size="xl"
        live={!finished}
        sub={stale ? "La duración sigue; el hueco queda registrado" : undefined}
        style={{ marginTop: space[4] }}
      />

      <View style={{ marginTop: space[6] }}>
        {bigNumbers ? <BigNumbers left={left} right={right} stale={stale} /> : <FootMap left={left} right={right} stale={stale} />}
      </View>

      <View style={styles.chips}>
        {(Object.keys(ZONE_LABEL) as Zone[]).map((z) => (
          <Chip key={z} variant={z === zone ? "selected" : "neutral"} onPress={() => setZone(z)}>{ZONE_LABEL[z]}</Chip>
        ))}
      </View>
      <View style={{ marginTop: space[3] }}>
        <LineChart series={series} startLabel="−10 s" endLabel="ahora" label={`${ZONE_LABEL[zone]} · ${feetLabel} · últimos 10 segundos${snapshot.stats.gaps ? ` · ${snapshot.stats.gaps} hueco(s)` : ""}`} />
      </View>

      <View style={styles.counters}>
        <Text variant="caption" color={colors.textSecondary}>{formatNumber(snapshot.stats.accepted)} registros</Text>
        <Text variant="caption" color={snapshot.stats.gaps ? colors.alert : colors.textSecondary}>{snapshot.stats.gaps} {snapshot.stats.gaps === 1 ? "hueco" : "huecos"}</Text>
        <Text variant="caption" color={colors.textSecondary}>{formatNumber(rate, 1)} reg/s</Text>
      </View>
      <View style={styles.counters}>
        <Text variant="caption" color={colors.textSecondary}>guardados {formatNumber(snapshot.stats.committed)}</Text>
        <Text variant="caption" color={colors.textSecondary}>en cola {snapshot.stats.pending}</Text>
        <Text variant="caption" color={snapshot.stats.rejected ? colors.alert : colors.textSecondary}>rechazados {snapshot.stats.rejected}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: "row", alignItems: "center", gap: space[2], paddingTop: space[3] },
  modules: { flexDirection: "row", gap: space[2], marginTop: space[3] },
  back: { width: 32, height: 32, alignItems: "center", justifyContent: "center", marginLeft: -8, transform: [{ scaleX: -1 }] },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  chips: { flexDirection: "row", gap: space[2], marginTop: space[6] },
  counters: { flexDirection: "row", justifyContent: "space-between", marginTop: space[3] },
  input: { minHeight: size.controlHeight, borderRadius: radius.md, borderWidth: size.hairline, borderColor: colors.line, backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: space[4], fontFamily: fonts.regular, fontSize: 16 },
});
