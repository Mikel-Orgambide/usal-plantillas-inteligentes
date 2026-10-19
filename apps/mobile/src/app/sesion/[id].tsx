import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ChannelCode } from "@plantillas/contract";
import type { ChannelMetrics } from "@plantillas/metrics";
import { Button, Card, Chip, FootMap, Header, LineChart, ListRow, Screen, StatusBanner, Text, ValueCard } from "../../presentation/components";
import { colors, formatDate, formatDuration, formatNumber, space } from "../../presentation/theme/tokens";
import { useSessionDetail } from "../../application/useSessions";
import { ACTIVITY_LABEL, type Activity } from "../../application/sessionStore";

type Zone = "heel" | "medial" | "lateral";
const ZONE_CHANNELS: Record<Zone, [ChannelCode, ChannelCode]> = { heel: ["L_HEEL", "R_HEEL"], medial: ["L_MEDIAL", "R_MEDIAL"], lateral: ["L_LATERAL", "R_LATERAL"] };
const ZONE_LABEL: Record<Zone, string> = { heel: "Talón", medial: "Medial", lateral: "Lateral" };
const EVENT_LABEL: Record<string, string> = {
  session_started: "Sesión iniciada", session_stopped: "Sesión finalizada", capture_started: "Captura iniciada", capture_restarted: "Reinicio de captura",
  capture_stopped: "Captura detenida", connected: "Conectado", disconnected: "Desconectado", reconnected: "Reconectado", sequence_gap: "Hueco de secuencia",
  out_of_order: "Registro fuera de orden", recovered_incomplete: "Recuperada como incompleta", source_error: "Error de la fuente",
};

function eventDetail(e: { type: string; detail: string | null; received_at: string }, startedAt: string): string {
  const t = formatDuration(Math.max(0, Date.parse(e.received_at) - Date.parse(startedAt)));
  if (!e.detail) return t;
  try {
    const d = JSON.parse(e.detail) as Record<string, unknown>;
    if (e.type === "sequence_gap") return `${t} · faltan ${String(d["missing_count"])} registros (${String(d["missing_from"])}–${String(d["missing_to"])})`;
    if (e.type === "capture_restarted") return `${t} · nueva captura ${String(d["capture_id"])}`;
    if (e.type === "session_stopped") return `${t} · ${String(d["state"])}${d["reason"] ? ` · ${String(d["reason"])}` : ""}`;
    if (e.type === "recovered_incomplete") return `${t} · ${String(d["reason"])}`;
    if (e.type === "disconnected") return `${t} · ${String(d["reason"])}`;
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
  if (m.sample_mean === null) return `${m.unavailable_reason ?? "no disponible"} · ${m.n_valid}/${m.n_received} válidas`;
  return `máx ${formatNumber(m.sample_max ?? 0)} · σ ${formatNumber(m.sample_sd_population ?? 0, 1)} · ${formatNumber(m.n_valid)}/${formatNumber(m.n_received)} válidas`;
}

/** Detalle de sesión: calidad, métricas por posición, gráfico de la sesión completa y eventos. */
export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { detail, error } = useSessionDetail(id);
  const [zone, setZone] = useState<Zone>("heel");
  const [showEvents, setShowEvents] = useState(false);
  const [captureIndex, setCaptureIndex] = useState(0);

  if (error) {
    return (
      <Screen footer={<Button onPress={() => router.back()}>Volver</Button>}>
        <Header title="Sesión" onBack={() => router.back()} />
        <StatusBanner tone="alert" icon="alert" detail={error}>No se pudo leer la sesión</StatusBanner>
      </Screen>
    );
  }
  if (detail === undefined) {
    return <Screen><Header title="Sesión" context="Cargando…" onBack={() => router.back()} /></Screen>;
  }
  if (detail === null) {
    return (
      <Screen footer={<Button onPress={() => router.back()}>Volver</Button>}>
        <Header title="Sesión" onBack={() => router.back()} />
        <Text variant="body" color={colors.textSecondary}>No existe una sesión con ese identificador.</Text>
      </Screen>
    );
  }

  const { session, captures, events, quality, series, metrics } = detail;
  const window = metrics[Math.min(captureIndex, Math.max(0, metrics.length - 1))];
  const [lc, rc] = ZONE_CHANNELS[zone];
  const duration = session.duration_ms ?? 0;
  const received = quality.expected > 0 ? (quality.records / quality.expected) * 100 : 0;
  const sorted = [...events].sort((a, b) => a.id - b.id);

  return (
    <Screen footer={<Button icon="compare" onPress={() => router.push("/historial")}>Comparar con…</Button>}>
      <Header
        title={ACTIVITY_LABEL[session.activity as Activity] ?? session.activity}
        context={`${formatDate(session.started_at)} · ${formatDuration(duration)} min · ${session.state === "completed" ? "completa" : session.state === "incomplete" ? "incompleta" : session.state}`}
        onBack={() => router.back()}
      />
      <View style={styles.metaRow}>
        <Chip variant={session.source === "simulated" ? "sim" : "neutral"} icon={session.source === "simulated" ? "settings" : "bluetooth"}>{session.source === "simulated" ? "Simulada" : "Física"}</Chip>
        <Text variant="caption" color={colors.textSecondary} style={{ flexShrink: 1 }}>{captures[0]?.device_id ?? "—"} · {captures[0]?.configuration_id ?? "—"} · 6 posiciones · cuentas ADC 0–4095</Text>
      </View>
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
        <ValueCard label="Capturas" value={quality.captures} sub={quality.captures > 1 ? `${quality.captures - 1} reinicio(s)` : "sin reinicios"} style={styles.half} />
      </View>

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
              left={{ heel: window.metrics.L_HEEL.sample_mean, medial: window.metrics.L_MEDIAL.sample_mean, lateral: window.metrics.L_LATERAL.sample_mean }}
              right={{ heel: window.metrics.R_HEEL.sample_mean, medial: window.metrics.R_MEDIAL.sample_mean, lateral: window.metrics.R_LATERAL.sample_mean }}
            />
          </View>
          <View style={styles.grid}>
            {POSITION_ORDER.map((code) => {
              const m = window.metrics[code];
              return (
                <ValueCard
                  key={code}
                  label={POSITION_LABEL[code]}
                  value={m.sample_mean === null ? null : Math.round(m.sample_mean)}
                  unit={m.sample_mean === null ? undefined : "cuentas"}
                  sub={metricSub(m)}
                  style={styles.half}
                />
              );
            })}
          </View>
        </>
      )}

      <Text variant="heading" style={{ marginTop: space[6], marginBottom: space[3] }}>Sesión completa</Text>
      <View style={styles.chipsRow}>
        {(Object.keys(ZONE_LABEL) as Zone[]).map((z) => (
          <Chip key={z} variant={z === zone ? "selected" : "neutral"} onPress={() => setZone(z)}>{ZONE_LABEL[z]}</Chip>
        ))}
      </View>
      <View style={{ marginTop: space[3] }}>
        {series[lc].length === 0 ? (
          <Text variant="caption" color={colors.textSecondary}>Sin datos para graficar.</Text>
        ) : (
          <LineChart
            series={[{ name: "Izquierdo", values: series[lc] }, { name: "Derecho", values: series[rc] }]}
            startLabel="0:00"
            endLabel={formatDuration(duration)}
            label={`${ZONE_LABEL[zone]} · izquierdo y derecho${captures.length > 1 ? " · primera captura" : ""}${quality.gaps ? ` · ${quality.gaps} hueco(s)` : ""}`}
          />
        )}
      </View>

      <View style={{ marginTop: space[6] }}>
        <Card>
          <View style={styles.eventsHeader}>
            <Text variant="heading">Eventos <Text variant="label" color={colors.textSecondary}>· {events.length}</Text></Text>
            <Text variant="label" color={colors.accent} onPress={() => setShowEvents((s) => !s)}>{showEvents ? "Ocultar" : "Ver"}</Text>
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
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: "row", alignItems: "center", gap: space[3] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space[3], marginTop: space[3] },
  half: { width: "47%", flexGrow: 1 },
  chipsRow: { flexDirection: "row", gap: space[2] },
  eventsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
