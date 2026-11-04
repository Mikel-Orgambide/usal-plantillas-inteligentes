import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ChannelCode } from "@plantillas/contract";
import { isInstrumented, type ChannelMetrics } from "@plantillas/metrics";
import { AssistantFab, Button, Card, Chip, FootMap, Header, LineChart, ListRow, Screen, StatusBanner, Text, TextButton, ValueCard } from "../../../../presentation/components";
import { colors, formatDate, formatDuration, formatNumber, space } from "../../../../presentation/theme/tokens";
import { useSessionDetail } from "../../../../application/useSessions";
import { ACTIVITY_LABEL, type Activity } from "../../../../application/sessionStore";
import { shareSessionBundle } from "../../../../infrastructure/backup/backup";
import { shareSessionCsv, shareSessionReport } from "../../../../infrastructure/report/report";
import { useAuth } from "../../../../application/authStore";
import { describeOutcome, syncOne, useSessionSyncState, useSync } from "../../../../application/syncStore";

type Zone = "heel" | "medial" | "lateral";
const ZONE_CHANNELS: Record<Zone, [ChannelCode, ChannelCode]> = { heel: ["L_HEEL", "R_HEEL"], medial: ["L_MEDIAL", "R_MEDIAL"], lateral: ["L_LATERAL", "R_LATERAL"] };
const ZONE_LABEL: Record<Zone, string> = { heel: "Talón", medial: "Medial", lateral: "Lateral" };
const EVENT_LABEL: Record<string, string> = {
  session_started: "Sesión iniciada", session_stopped: "Sesión finalizada", capture_started: "Captura iniciada", capture_restarted: "Reinicio de captura",
  capture_stopped: "Captura detenida", connected: "Conectado", disconnected: "Desconectado", reconnected: "Reconectado", sequence_gap: "Hueco de secuencia",
  out_of_order: "Registro fuera de orden", recovered_incomplete: "Recuperada como incompleta", source_error: "Error de la fuente",
  module_lost: "Módulo perdido", module_recovered: "Módulo recuperado",
};
const FOOT_WORD: Record<string, string> = { left: "izquierdo", right: "derecho" };

function eventDetail(e: { type: string; detail: string | null; received_at: string }, startedAt: string): string {
  const t = formatDuration(Math.max(0, Date.parse(e.received_at) - Date.parse(startedAt)));
  if (!e.detail) return t;
  try {
    const d = JSON.parse(e.detail) as Record<string, unknown>;
    if (e.type === "sequence_gap") return `${t} · faltan ${String(d["missing_count"])} registros (${String(d["missing_from"])}–${String(d["missing_to"])})`;
    if (e.type === "capture_restarted") return `${t} · nueva captura ${String(d["capture_id"])}`;
    if (e.type === "session_stopped") return `${t} · ${String(d["state"])}${d["reason"] ? ` · ${String(d["reason"])}` : ""}`;
    if (e.type === "recovered_incomplete") return `${t} · ${String(d["reason"])}`;
    if (e.type === "disconnected") return `${t} · ${String(d["reason"])}${d["device_id"] ? ` · ${String(d["device_id"])}` : ""}`;
    if (e.type === "module_lost") return `${t} · ${String(d["device_id"])}${d["foot"] ? ` (${FOOT_WORD[String(d["foot"])] ?? String(d["foot"])})` : ""} · la sesión siguió con el otro módulo`;
    if (e.type === "module_recovered") return `${t} · ${String(d["device_id"])} · tramo incompleto de ${formatDuration(Number(d["incomplete_ms"] ?? 0))}`;
    if (d["device_id"]) return `${t} · ${String(d["device_id"])}`;
  } catch { /* detalle no interpretable */ }
  return t;
}

const POSITION_LABEL: Record<ChannelCode, string> = {
  L_HEEL: "Talón izq.", L_MEDIAL: "Medial izq.", L_LATERAL: "Lateral izq.",
  R_HEEL: "Talón der.", R_MEDIAL: "Medial der.", R_LATERAL: "Lateral der.",
};
const POSITION_ORDER: ChannelCode[] = ["L_HEEL", "R_HEEL", "L_MEDIAL", "R_MEDIAL", "L_LATERAL", "R_LATERAL"];

/** Texto secundario de una posición: máximo, dispersión y cantidades, o el motivo de no disponibilidad. */
function metricSub(m: ChannelMetrics): string {
  if (!isInstrumented(m)) return "no instrumentada en esta configuración";
  if (m.sample_mean === null) return `${m.unavailable_reason ?? "no disponible"} · ${m.n_valid}/${m.n_received} válidas`;
  return `máx ${formatNumber(m.sample_max ?? 0)} · σ ${formatNumber(m.sample_sd_population ?? 0, 1)} · ${formatNumber(m.n_valid)}/${formatNumber(m.n_received)} válidas`;
}

/** Valor para la silueta: «n/d» si la posición no está instrumentada en la configuración de la captura. */
function footValue(m: ChannelMetrics): number | null | "unavailable" {
  return isInstrumented(m) ? m.sample_mean : "unavailable";
}

/** Detalle de sesión: calidad, métricas por posición, gráfico de la sesión completa y eventos. */
export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { detail, error } = useSessionDetail(id);
  const [zone, setZone] = useState<Zone>("heel");
  const [showEvents, setShowEvents] = useState(false);
  const [captureIndex, setCaptureIndex] = useState(0);
  const [exportError, setExportError] = useState<string | undefined>();
  const auth = useAuth();
  const sync = useSync();
  const syncRow = useSessionSyncState(id);
  const [syncMessage, setSyncMessage] = useState<string | undefined>();
  const syncNow = async (sessionId: string) => {
    setSyncMessage(undefined);
    try { setSyncMessage(describeOutcome(await syncOne(sessionId))); } catch (e) { setSyncMessage(e instanceof Error ? e.message : String(e)); }
  };
  const exportSession = async (sessionId: string) => {
    setExportError(undefined);
    try { await shareSessionBundle(sessionId); } catch (e) { setExportError(e instanceof Error ? e.message : String(e)); }
  };
  const [reportBusy, setReportBusy] = useState(false);
  const exportReport = async (sessionId: string) => {
    setExportError(undefined);
    setReportBusy(true);
    try { await shareSessionReport(sessionId); } catch (e) { setExportError(e instanceof Error ? e.message : String(e)); } finally { setReportBusy(false); }
  };
  const [csvBusy, setCsvBusy] = useState(false);
  const exportCsv = async (sessionId: string) => {
    setExportError(undefined);
    setCsvBusy(true);
    try { await shareSessionCsv(sessionId); } catch (e) { setExportError(e instanceof Error ? e.message : String(e)); } finally { setCsvBusy(false); }
  };

  if (error) {
    return (
      <Screen tabbed footer={<Button onPress={() => router.back()}>Volver</Button>}>
        <Header title="Sesión" onBack={() => router.back()} />
        <StatusBanner tone="alert" icon="alert" detail={error}>No se pudo leer la sesión</StatusBanner>
      </Screen>
    );
  }
  if (detail === undefined) {
    return <Screen tabbed><Header title="Sesión" context="Cargando…" onBack={() => router.back()} /></Screen>;
  }
  if (detail === null) {
    return (
      <Screen tabbed footer={<Button onPress={() => router.back()}>Volver</Button>}>
        <Header title="Sesión" onBack={() => router.back()} />
        <Text variant="body" color={colors.textSecondary}>No existe una sesión con ese identificador.</Text>
      </Screen>
    );
  }

  const { session, captures, events, quality, series, metrics, modules, bilateral } = detail;
  const multi = modules.length > 1;
  const window = metrics[Math.min(captureIndex, Math.max(0, metrics.length - 1))];
  const [lc, rc] = ZONE_CHANNELS[zone];
  const duration = session.duration_ms ?? 0;
  const received = quality.expected > 0 ? (quality.records / quality.expected) * 100 : 0;
  const sorted = [...events].sort((a, b) => a.id - b.id);
  const closed = session.state === "completed" || session.state === "incomplete";
  const otherAccount = session.user_id !== auth.localUserId;
  const syncChip = otherAccount
    ? <Chip variant="alert" icon="user">De otra cuenta</Chip>
    : syncRow?.status === "confirmed"
    ? <Chip icon="cloud">Sincronizada</Chip>
    : auth.status === "signed_in" && closed && captures.length > 0
      ? <Chip icon="cloud" variant={syncRow?.status === "failed" || syncRow?.status === "pending" ? "alert" : "neutral"} onPress={sync.running ? undefined : () => void syncNow(session.id)}>{sync.running ? "Sincronizando…" : syncRow ? "Reintentar sincronización" : "Sincronizar"}</Chip>
      : <Chip>Sólo en este teléfono</Chip>;

  return (
    <>
    <Screen tabbed footer={<View style={{ gap: space[2] }}><Button icon="compare" onPress={() => router.navigate({ pathname: "/historial", params: { select: session.id } })}>Comparar con…</Button>{closed && captures.length > 0 ? <Button icon="export" disabled={reportBusy} onPress={() => void exportReport(session.id)}>{reportBusy ? "Generando informe…" : "Exportar informe (PDF)"}</Button> : null}{closed && captures.length > 0 ? <Button icon="export" disabled={csvBusy} onPress={() => void exportCsv(session.id)}>{csvBusy ? "Generando CSV…" : "Exportar sesión (CSV)"}</Button> : null}</View>}>
      <Header
        title={ACTIVITY_LABEL[session.activity as Activity] ?? session.activity}
        context={`${formatDate(session.started_at)} · ${formatDuration(duration)} min · ${session.state === "completed" ? "completa" : session.state === "incomplete" ? "incompleta" : session.state}`}
        onBack={() => router.back()}
        action="export"
        actionLabel="Exportar sesión"
        onAction={() => void exportSession(session.id)}
      />
      {exportError ? <Text variant="caption" color={colors.alert} style={{ marginBottom: space[3] }}>No se pudo exportar: {exportError}</Text> : null}
      <View style={styles.metaRow}>
        <Chip variant={session.source === "simulated" ? "sim" : "neutral"} icon={session.source === "simulated" ? "settings" : "bluetooth"}>{session.source === "simulated" ? "Simulada" : "Física"}</Chip>
        <Text variant="caption" color={colors.textSecondary} style={{ flexShrink: 1 }}>{multi ? modules.map((m) => `${m.foot === "left" ? "izq" : m.foot === "right" ? "der" : ""} ${m.device_id}`.trim()).join(" + ") : `${captures[0]?.device_id ?? "—"} · ${captures[0]?.configuration_id ?? "—"}`} · {multi ? `${modules.reduce((n, m) => n + (m.captures[0] ? 1 : 0), 0) * 3} posiciones · dos módulos` : window ? `${POSITION_ORDER.filter((c) => isInstrumented(window.metrics[c])).length} posiciones` : "posiciones"} · cuentas ADC 0–4095</Text>
      </View>
      <View style={[styles.metaRow, { marginTop: space[2] }]}>
        {syncChip}
        {syncRow && syncRow.status !== "confirmed" && syncRow.last_error ? <Text variant="caption" color={colors.textSecondary} style={{ flexShrink: 1 }} numberOfLines={2}>{syncRow.last_error}</Text> : null}
      </View>
      {otherAccount ? <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[2] }}>Grabada con otra cuenta en este teléfono: se conserva, pero no se sincroniza con la cuenta activa ni aparece en su historial.</Text> : null}
      {syncMessage ? <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[2] }}>{syncMessage}</Text> : null}
      {session.context ? <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[2] }}>Contexto: {session.context}</Text> : null}
      {session.state === "incomplete" ? (
        <View style={{ marginTop: space[4] }}>
          <StatusBanner tone="alert" icon="alert" detail="Lo que llegó quedó guardado; la duración puede ser estimada">Sesión incompleta</StatusBanner>
        </View>
      ) : null}

      <Text variant="heading" style={{ marginTop: space[6] }}>Calidad</Text>
      <View style={styles.grid}>
        <ValueCard label="Registros" value={quality.records} unit="reg." sub={quality.expected ? `${formatNumber(received, 1)} % de ${formatNumber(quality.expected)} esperados` : "sin registros"} style={styles.half} />
        <ValueCard label="Huecos" value={quality.gaps} sub={quality.gaps ? "ver eventos" : "sin discontinuidades"} style={styles.half} />
        <ValueCard label="Lecturas fallidas" value={quality.readErrors} unit="read_error" sub={quality.records ? `${formatNumber((quality.readErrors / (quality.records * 6)) * 100, 2)} % de los canales` : "—"} style={styles.half} />
        <ValueCard label="Capturas" value={quality.captures} sub={multi ? `${modules.length} módulos${quality.captures > modules.length ? ` · ${quality.captures - modules.length} reinicio(s)` : ""}` : quality.captures > 1 ? `${quality.captures - 1} reinicio(s)` : "sin reinicios"} style={styles.half} />
      </View>
      {multi ? (
        <View style={{ marginTop: space[3] }}>
          <Card title="Calidad por módulo">
            {modules.map((m, i) => (
              <ListRow key={m.device_id} title={`${m.foot ? `Pie ${FOOT_WORD[m.foot]}` : "Ambos pies"} · ${m.device_id}`} subtitle={`${m.configuration_id} · ${formatNumber(m.records)} registros · ${m.gaps} hueco(s) · ${m.readErrors} fallidas · ${m.captures.length} captura(s)`} chevron={false} last={i === modules.length - 1} />
            ))}
            {bilateral ? (
              <ListRow
                title="Correspondencia entre módulos"
                subtitle={bilateral.offset_ms === null ? bilateral.unavailable_reason ?? "n/d" : `desfase estimado ${formatNumber(Math.abs(bilateral.offset_ms))} ms (por recepción; no se corrige) · ${formatNumber(bilateral.complete_fraction * 100, 0)} % del tiempo con ambos módulos${bilateral.complete_intervals.length > 1 ? ` · ${bilateral.complete_intervals.length} tramos` : ""}`}
                chevron={false}
                last
              />
            ) : null}
          </Card>
        </View>
      ) : null}

      <Text variant="heading" style={{ marginTop: space[6], marginBottom: space[1] }}>Carga por posición</Text>
      <Text variant="caption" color={colors.textSecondary}>
        Media de la señal original por posición, en cuentas ADC. Descriptores de la lectura; no son fuerza, presión ni un puntaje.
      </Text>
      {metrics.length > 1 ? (
        <View style={[styles.chipsRow, { marginTop: space[3] }]}>
          {metrics.map((m, i) => (
            <Chip key={m.capture.id} variant={i === captureIndex ? "selected" : "neutral"} onPress={() => setCaptureIndex(i)}>{`Captura ${i + 1}`}</Chip>
          ))}
        </View>
      ) : null}
      {!window ? (
        <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[3] }}>
          {session.state === "completed" || session.state === "incomplete" ? "Sin capturas: no hay lecturas sobre las que calcular." : "Disponibles al finalizar la sesión."}
        </Text>
      ) : (
        <>
          <View style={{ marginTop: space[4] }}>
            <FootMap
              left={{ heel: footValue(window.metrics.L_HEEL), medial: footValue(window.metrics.L_MEDIAL), lateral: footValue(window.metrics.L_LATERAL) }}
              right={{ heel: footValue(window.metrics.R_HEEL), medial: footValue(window.metrics.R_MEDIAL), lateral: footValue(window.metrics.R_LATERAL) }}
            />
          </View>
          <View style={styles.grid}>
            {POSITION_ORDER.map((code) => {
              const m = window.metrics[code];
              return (
                <ValueCard
                  key={code}
                  label={POSITION_LABEL[code]}
                  value={!isInstrumented(m) ? "n/d" : m.sample_mean === null ? null : Math.round(m.sample_mean)}
                  unit={m.sample_mean === null ? undefined : "cuentas"}
                  sub={metricSub(m)}
                  style={styles.half}
                />
              );
            })}
          </View>
        </>
      )}

      {bilateral ? (
        <>
          <Text variant="heading" style={{ marginTop: space[6], marginBottom: space[1] }}>Izquierda / derecha</Text>
          <Text variant="caption" color={colors.textSecondary}>
            Calculado sólo en los tramos con ambos módulos presentes ({formatNumber(bilateral.complete_fraction * 100, 0)} % de la sesión). Reparto entre medias de cuentas ADC, sin calibración.
          </Text>
          <View style={styles.grid}>
            <ValueCard label="Izquierdo" value={bilateral.distribution?.left_share === null || bilateral.distribution?.left_share === undefined ? "n/d" : Math.round(bilateral.distribution.left_share * 100)} unit={bilateral.distribution?.left_share != null ? "%" : undefined} sub={bilateral.distribution?.left_share == null ? bilateral.unavailable_reason ?? bilateral.distribution?.unavailable_reason ?? "sin tramo completo" : "de la suma de medias"} style={styles.half} />
            <ValueCard label="Derecho" value={bilateral.distribution?.right_share == null ? "n/d" : Math.round(bilateral.distribution.right_share * 100)} unit={bilateral.distribution?.right_share != null ? "%" : undefined} sub={bilateral.distribution?.right_share == null ? "requiere ambos módulos" : "de la suma de medias"} style={styles.half} />
            {(["heel", "medial", "lateral"] as const).map((z) => {
              const a = bilateral.distribution?.asymmetry[z];
              return <ValueCard key={z} label={`Asimetría ${ZONE_LABEL[z].toLowerCase()}`} value={a == null ? "n/d" : formatNumber(a, 2)} sub={a == null ? "n/d" : a > 0 ? "más carga a la izquierda" : a < 0 ? "más carga a la derecha" : "simétrico"} style={styles.half} />;
            })}
          </View>
        </>
      ) : null}

      <Text variant="heading" style={{ marginTop: space[6], marginBottom: space[3] }}>Sesión completa</Text>
      <View style={styles.chipsRow}>
        {(Object.keys(ZONE_LABEL) as Zone[]).map((z) => (
          <Chip key={z} variant={z === zone ? "selected" : "neutral"} onPress={() => setZone(z)}>{ZONE_LABEL[z]}</Chip>
        ))}
      </View>
      <View style={{ marginTop: space[3] }}>
        {series[lc].length === 0 && series[rc].length === 0 ? (
          <Text variant="caption" color={colors.textSecondary}>Sin datos para graficar.</Text>
        ) : (
          <LineChart
            series={[
              ...(series[lc].length > 0 ? [{ name: "Izquierdo", values: series[lc] }] : []),
              ...(series[rc].length > 0 ? [{ name: "Derecho", values: series[rc] }] : []),
            ]}
            startLabel="0:00"
            endLabel={formatDuration(duration)}
            label={`${ZONE_LABEL[zone]} · ${series[lc].length > 0 && series[rc].length > 0 ? "izquierdo y derecho" : series[lc].length > 0 ? "izquierdo · derecho no instrumentado" : "derecho · izquierdo no instrumentado"}${captures.length > 1 ? " · primera captura" : ""}${quality.gaps ? ` · ${quality.gaps} hueco(s)` : ""}`}
          />
        )}
      </View>

      <View style={{ marginTop: space[6] }}>
        <Card>
          <View style={styles.eventsHeader}>
            <Text variant="heading">Eventos <Text variant="label" color={colors.textSecondary}>· {events.length}</Text></Text>
            <TextButton onPress={() => setShowEvents((s) => !s)}>{showEvents ? "Ocultar" : "Ver"}</TextButton>
          </View>
          {showEvents ? (
            <View style={{ marginTop: space[1] }}>
              {sorted.map((e) => (
                <ListRow key={e.id} title={EVENT_LABEL[e.type] ?? e.type} subtitle={eventDetail(e, session.started_at)} chevron={false} />
              ))}
            </View>
          ) : null}
        </Card>
      </View>
    </Screen>
    <AssistantFab sessionId={session.id} bottomOffset={closed && captures.length > 0 ? 200 : 96} />
    </>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: "row", alignItems: "center", gap: space[3] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space[3], marginTop: space[3] },
  half: { width: "47%", flexGrow: 1 },
  chipsRow: { flexDirection: "row", gap: space[2] },
  eventsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
