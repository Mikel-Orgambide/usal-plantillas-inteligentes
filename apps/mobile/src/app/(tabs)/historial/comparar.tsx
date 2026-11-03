import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ChannelCode } from "@plantillas/contract";
import { assessComparability, compareMetrics, type ChannelDifference, type Comparability } from "@plantillas/metrics";
import { Button, Card, Chip, Header, Icon, LineChart, Screen, StatusBanner, Text, ValueCard } from "../../../presentation/components";
import { colors, formatDate, formatDuration, formatNumber, radius, space } from "../../../presentation/theme/tokens";
import { loadSessionDetail, type SessionDetail } from "../../../application/useSessions";
import { ACTIVITY_LABEL, type Activity } from "../../../application/sessionStore";
import { shareComparisonReport } from "../../../infrastructure/report/report";

type Zone = "heel" | "medial" | "lateral";
const ZONE_CHANNELS: Record<Zone, [ChannelCode, ChannelCode]> = { heel: ["L_HEEL", "R_HEEL"], medial: ["L_MEDIAL", "R_MEDIAL"], lateral: ["L_LATERAL", "R_LATERAL"] };
const ZONE_LABEL: Record<Zone, string> = { heel: "Talón", medial: "Medial", lateral: "Lateral" };

const REQ_LABEL = { configuration: "Misma configuración", unit: "Misma unidad", source: "Misma procedencia", metric_version: "Misma versión de métrica" } as const;
const CAVEAT_LABEL = { activity: "Actividad distinta", context: "Contexto distinto", multiple_captures: "Sesión con reinicios" } as const;
const POSITION_LABEL: Record<ChannelCode, string> = {
  L_HEEL: "Talón izq.", L_MEDIAL: "Medial izq.", L_LATERAL: "Lateral izq.",
  R_HEEL: "Talón der.", R_MEDIAL: "Medial der.", R_LATERAL: "Lateral der.",
};
const POSITION_ORDER: ChannelCode[] = ["L_HEEL", "R_HEEL", "L_MEDIAL", "R_MEDIAL", "L_LATERAL", "R_LATERAL"];

function sourceLabel(s: string): string { return s === "simulated" ? "simulada" : "física"; }

/** Política de comparación (etapa 7): requisitos que bloquean y condiciones que solo se señalan. Compara la primera captura de cada sesión. */
function assess(a: SessionDetail, b: SessionDetail): Comparability {
  const side = (d: SessionDetail) => ({
    configuration_id: d.captures[0]?.configuration_id ?? "sin captura",
    source: d.session.source,
    unit: d.metrics[0]?.metrics.L_HEEL.unit ?? "adc_count",
    metric_version: d.metrics[0]?.metrics.L_HEEL.metric_version ?? "—",
    activity: ACTIVITY_LABEL[d.session.activity as Activity] ?? d.session.activity,
    context: d.session.context,
    capture_count: d.captures.length,
  });
  return assessComparability(side(a), side(b));
}

function signed(v: number, decimals = 0): string {
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${formatNumber(Math.abs(v), decimals)}`;
}

function DifferenceRow({ d, last }: { d: ChannelDifference; last: boolean }) {
  const unavailable = d.delta_mean === null;
  return (
    <View style={[styles.diffRow, !last && styles.reqBorder]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body">{POSITION_LABEL[d.channel]}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {unavailable
            ? `A ${d.a.sample_mean === null ? d.a.unavailable_reason : formatNumber(d.a.sample_mean)} · B ${d.b.sample_mean === null ? d.b.unavailable_reason : formatNumber(d.b.sample_mean)}`
            : `A ${formatNumber(d.a.sample_mean!)} · B ${formatNumber(d.b.sample_mean!)} · máx ${signed(d.delta_max!)} · σ ${signed(d.delta_sd!, 1)}`}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Text variant="numMd" color={unavailable ? colors.textSecondary : colors.textPrimary}>{unavailable ? "—" : signed(d.delta_mean!)}</Text>
        <Text variant="caption" color={colors.textSecondary}>{unavailable ? "no disponible" : d.delta_mean_ratio === null ? "cuentas" : `${signed(d.delta_mean_ratio * 100, 1)} %`}</Text>
      </View>
    </View>
  );
}

function SessionCard({ letter, d, color }: { letter: string; d: SessionDetail; color: string }) {
  return (
    <View style={styles.sessionCard}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <View style={{ width: 12, height: 2, backgroundColor: color }} />
        <Text variant="label">{letter} · {formatDate(d.session.started_at)}</Text>
      </View>
      <Text variant="caption" color={colors.textSecondary}>{ACTIVITY_LABEL[d.session.activity as Activity] ?? d.session.activity} · {formatDuration(d.session.duration_ms ?? 0)} · {formatNumber(d.quality.records)} reg.</Text>
      <Text variant="caption" color={colors.textSecondary}>{d.session.source === "simulated" ? "Simulada" : "Física"} · {d.captures[0]?.device_id ?? "—"}</Text>
    </View>
  );
}

/** Comparación de dos sesiones: solo si son compatibles; si no, explica por qué. */
export default function CompareScreen() {
  const { a, b } = useLocalSearchParams<{ a: string; b: string }>();
  const router = useRouter();
  const [data, setData] = useState<[SessionDetail, SessionDetail] | null | undefined>(undefined);
  const [error, setError] = useState<string | undefined>();
  const [zone, setZone] = useState<Zone>("heel");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | undefined>();

  useEffect(() => {
    if (!a || !b) return;
    Promise.all([loadSessionDetail(a, 80), loadSessionDetail(b, 80)])
      .then(([da, db]) => setData(da && db ? [da, db] : null))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [a, b]);

  if (error) {
    return <Screen tabbed footer={<Button onPress={() => router.back()}>Volver</Button>}><Header title="Comparar" onBack={() => router.back()} /><StatusBanner tone="alert" icon="alert" detail={error}>No se pudieron leer las sesiones</StatusBanner></Screen>;
  }
  if (data === undefined) return <Screen tabbed><Header title="Comparar" context="Cargando…" onBack={() => router.back()} /></Screen>;
  if (data === null) return <Screen tabbed footer={<Button onPress={() => router.back()}>Volver</Button>}><Header title="Comparar" onBack={() => router.back()} /><Text variant="body" color={colors.textSecondary}>Alguna de las sesiones no existe.</Text></Screen>;

  const [da, db] = data;
  const policy = assess(da, db);
  const exportReport = async () => {
    setReportError(undefined);
    setReportBusy(true);
    try { await shareComparisonReport(da.session.id, db.session.id); } catch (e) { setReportError(e instanceof Error ? e.message : String(e)); } finally { setReportBusy(false); }
  };
  const compatible = policy.compatible;
  const failed = policy.requirements.filter((r) => !r.ok);
  const differences = compatible && da.metrics[0] && db.metrics[0] ? compareMetrics(da.metrics[0].metrics, db.metrics[0].metrics) : null;
  const [lc, rc] = ZONE_CHANNELS[zone];

  return (
    <Screen tabbed footer={<View style={{ gap: space[2] }}>{compatible ? <Button icon="export" disabled={reportBusy} onPress={() => void exportReport()}>{reportBusy ? "Generando informe…" : "Exportar informe (PDF)"}</Button> : null}<Button onPress={() => router.back()}>Cambiar sesiones</Button></View>}>
      {reportError ? <Text variant="caption" color={colors.alert} style={{ marginBottom: space[2] }}>No se pudo generar el informe: {reportError}</Text> : null}
      <Header title="Comparar" context={compatible ? "Compatibles · misma configuración · cuentas ADC · misma procedencia · misma métrica" : "Estas dos sesiones no se pueden comparar por posición"} onBack={() => router.back()} />
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <SessionCard letter="A" d={da} color={colors.accent} />
        <SessionCard letter="B" d={db} color={colors.textSecondary} />
      </View>

      {!compatible ? (
        <>
          <View style={{ marginTop: space[4] }}>
            <StatusBanner tone="alert" icon="alert" detail={failed.map((r) => `${r.a} vs. ${r.b}`).join(" · ")}>{`${failed.map((r) => REQ_LABEL[r.code].replace("Misma ", "")).join(" y ")} distinta(s)`}</StatusBanner>
          </View>
          <View style={{ marginTop: space[6] }}>
            <Card title="Requisitos para comparar">
              {policy.requirements.map((r, i) => (
                <View key={r.code} style={[styles.reqRow, i < policy.requirements.length - 1 && styles.reqBorder]}>
                  <Icon name={r.ok ? "check" : "alert"} size={20} color={r.ok ? colors.accent : colors.alert} />
                  <Text variant="body" color={r.ok ? colors.textPrimary : colors.alert} style={{ flex: 1 }}>{REQ_LABEL[r.code]}</Text>
                  <Text variant="caption" color={r.ok ? colors.textSecondary : colors.alert}>{r.ok ? (r.code === "source" ? `ambas ${sourceLabel(r.a)}s` : r.a) : `${r.code === "source" ? sourceLabel(r.a) : r.a} vs. ${r.code === "source" ? sourceLabel(r.b) : r.b}`}</Text>
                </View>
              ))}
            </Card>
          </View>
          <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[4] }}>Sí se pueden comparar duración, cantidad de registros y calidad de recepción.</Text>
        </>
      ) : null}

      {policy.caveats.length > 0 ? (
        <View style={{ marginTop: space[4], gap: space[2] }}>
          {policy.caveats.map((c) => (
            <StatusBanner key={c.code} tone="alert" icon="alert" detail={c.code === "multiple_captures" ? `A ${c.a} · B ${c.b} capturas · se compara la primera de cada una` : `A ${c.a || "—"} · B ${c.b || "—"}`}>{CAVEAT_LABEL[c.code]}</StatusBanner>
          ))}
        </View>
      ) : null}

      {differences ? (
        <>
          <Text variant="heading" style={{ marginTop: space[6] }}>Diferencia por posición</Text>
          <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[1], marginBottom: space[3] }}>
            B − A sobre la media de la señal original, en cuentas ADC y en % de A. Son diferencias de lectura, no un juicio de rendimiento.
          </Text>
          <Card>
            {POSITION_ORDER.filter((code) => differences.some((x) => x.channel === code)).map((code, i, list) => (
              <DifferenceRow key={code} d={differences.find((x) => x.channel === code)!} last={i === list.length - 1} />
            ))}
            {differences.length < POSITION_ORDER.length ? (
              <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[2] }}>Las posiciones no instrumentadas en esta configuración no se comparan.</Text>
            ) : null}
          </Card>
        </>
      ) : compatible ? (
        <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[4] }}>Sin métricas calculadas para alguna de las dos sesiones (sin capturas).</Text>
      ) : null}

      <Text variant="heading" style={{ marginTop: space[6] }}>Calidad de recepción</Text>
      <View style={{ flexDirection: "row", gap: space[3], marginTop: space[3] }}>
        <ValueCard label="Datos recibidos · A" value={da.quality.expected ? formatNumber((da.quality.records / da.quality.expected) * 100, 1) : null} unit="%" sub={`${da.quality.gaps} hueco(s)`} style={{ flex: 1 }} />
        <ValueCard label="Datos recibidos · B" value={db.quality.expected ? formatNumber((db.quality.records / db.quality.expected) * 100, 1) : null} unit="%" sub={`${db.quality.gaps} hueco(s)`} style={{ flex: 1 }} />
      </View>

      {compatible ? (
        <>
          <Text variant="heading" style={{ marginTop: space[6] }}>Evolución · {ZONE_LABEL[zone].toLowerCase()}</Text>
          <View style={styles.chips}>
            {(Object.keys(ZONE_LABEL) as Zone[]).map((z) => (
              <Chip key={z} variant={z === zone ? "selected" : "neutral"} onPress={() => setZone(z)}>{ZONE_LABEL[z]}</Chip>
            ))}
          </View>
          <View style={{ marginTop: space[3], gap: space[4] }}>
            {da.series[lc].length > 0 || db.series[lc].length > 0 ? (
              <LineChart series={[{ name: "A · izq.", values: da.series[lc] }, { name: "B · izq.", values: db.series[lc] }]} startLabel="0:00" endLabel="fin" label="Pie izquierdo · alineadas por tiempo de sesión" />
            ) : <Text variant="caption" color={colors.textSecondary}>Pie izquierdo no instrumentado en esta configuración.</Text>}
            {da.series[rc].length > 0 || db.series[rc].length > 0 ? (
              <LineChart series={[{ name: "A · der.", values: da.series[rc] }, { name: "B · der.", values: db.series[rc] }]} startLabel="0:00" endLabel="fin" label="Pie derecho · alineadas por tiempo de sesión" />
            ) : <Text variant="caption" color={colors.textSecondary}>Pie derecho no instrumentado en esta configuración.</Text>}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sessionCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: space[3], paddingHorizontal: space[4], gap: space[1] },
  reqRow: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 48 },
  diffRow: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 56, paddingVertical: space[2] },
  reqBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  chips: { flexDirection: "row", gap: space[2], marginTop: space[3] },
});
