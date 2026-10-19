import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ChannelCode } from "@plantillas/contract";
import { Button, Card, Chip, Header, Icon, LineChart, Screen, StatusBanner, Text, ValueCard } from "../presentation/components";
import { colors, formatDate, formatDuration, formatNumber, radius, space } from "../presentation/theme/tokens";
import { loadSessionDetail, type SessionDetail } from "../application/useSessions";
import { ACTIVITY_LABEL, type Activity } from "../application/sessionStore";

type Zone = "heel" | "medial" | "lateral";
const ZONE_CHANNELS: Record<Zone, [ChannelCode, ChannelCode]> = { heel: ["L_HEEL", "R_HEEL"], medial: ["L_MEDIAL", "R_MEDIAL"], lateral: ["L_LATERAL", "R_LATERAL"] };
const ZONE_LABEL: Record<Zone, string> = { heel: "Talón", medial: "Medial", lateral: "Lateral" };

interface Requirement { label: string; ok: boolean; detail: string }

/** Política de compatibilidad (etapa 5): misma configuración, misma unidad, misma procedencia. */
function compatibility(a: SessionDetail, b: SessionDetail): Requirement[] {
  const ca = a.captures[0], cb = b.captures[0];
  const sameConfig = !!ca && !!cb && ca.configuration_id === cb.configuration_id;
  return [
    { label: "Misma configuración", ok: sameConfig, detail: sameConfig ? `${ca?.configuration_id} · 6 posiciones` : `${ca?.configuration_id ?? "sin captura"} vs. ${cb?.configuration_id ?? "sin captura"}` },
    { label: "Misma unidad", ok: true, detail: "cuentas ADC 0–4095" },
    { label: "Misma procedencia", ok: a.session.source === b.session.source, detail: a.session.source === b.session.source ? (a.session.source === "simulated" ? "ambas simuladas" : "ambas físicas") : `${a.session.source === "simulated" ? "simulada" : "física"} vs. ${b.session.source === "simulated" ? "simulada" : "física"}` },
  ];
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

  useEffect(() => {
    if (!a || !b) return;
    Promise.all([loadSessionDetail(a, 80), loadSessionDetail(b, 80)])
      .then(([da, db]) => setData(da && db ? [da, db] : null))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [a, b]);

  if (error) {
    return <Screen footer={<Button onPress={() => router.back()}>Volver</Button>}><Header title="Comparar" onBack={() => router.back()} /><StatusBanner tone="alert" icon="alert" detail={error}>No se pudieron leer las sesiones</StatusBanner></Screen>;
  }
  if (data === undefined) return <Screen><Header title="Comparar" context="Cargando…" onBack={() => router.back()} /></Screen>;
  if (data === null) return <Screen footer={<Button onPress={() => router.back()}>Volver</Button>}><Header title="Comparar" onBack={() => router.back()} /><Text variant="body" color={colors.textSecondary}>Alguna de las sesiones no existe.</Text></Screen>;

  const [da, db] = data;
  const reqs = compatibility(da, db);
  const compatible = reqs.every((r) => r.ok);
  const [lc, rc] = ZONE_CHANNELS[zone];

  return (
    <Screen footer={<Button onPress={() => router.back()}>Cambiar sesiones</Button>}>
      <Header title="Comparar" context={compatible ? "Compatibles · misma configuración · cuentas ADC · misma procedencia" : "Estas dos sesiones no se pueden comparar por posición"} onBack={() => router.back()} />
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <SessionCard letter="A" d={da} color={colors.accent} />
        <SessionCard letter="B" d={db} color={colors.textSecondary} />
      </View>

      {!compatible ? (
        <>
          <View style={{ marginTop: space[4] }}>
            <StatusBanner tone="alert" icon="alert" detail={reqs.filter((r) => !r.ok).map((r) => r.detail).join(" · ")}>{`${reqs.filter((r) => !r.ok).map((r) => r.label.replace("Misma ", "")).join(" y ")} distinta(s)`}</StatusBanner>
          </View>
          <View style={{ marginTop: space[6] }}>
            <Card title="Requisitos para comparar">
              {reqs.map((r, i) => (
                <View key={r.label} style={[styles.reqRow, i < reqs.length - 1 && styles.reqBorder]}>
                  <Icon name={r.ok ? "check" : "alert"} size={20} color={r.ok ? colors.accent : colors.alert} />
                  <Text variant="body" color={r.ok ? colors.textPrimary : colors.alert} style={{ flex: 1 }}>{r.label}</Text>
                  <Text variant="caption" color={r.ok ? colors.textSecondary : colors.alert}>{r.detail}</Text>
                </View>
              ))}
            </Card>
          </View>
          <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[4] }}>Sí se pueden comparar duración, cantidad de registros y calidad de recepción.</Text>
        </>
      ) : null}

      <Text variant="heading" style={{ marginTop: space[6] }}>Calidad de recepción</Text>
      <View style={{ flexDirection: "row", gap: space[3], marginTop: space[3] }}>
        <ValueCard label="Datos recibidos · A" value={da.quality.expected ? formatNumber((da.quality.records / da.quality.expected) * 100, 1) : null} unit="%" sub={`${da.quality.gaps} hueco(s)`} style={{ flex: 1 }} />
        <ValueCard label="Datos recibidos · B" value={db.quality.expected ? formatNumber((db.quality.records / db.quality.expected) * 100, 1) : null} unit="%" sub={`${db.quality.gaps} hueco(s)`} style={{ flex: 1 }} />
      </View>

      {compatible ? (
        <>
          <Text variant="heading" style={{ marginTop: space[6] }}>Evolución · {ZONE_LABEL[zone].toLowerCase()}</Text>
          <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[1] }}>Las diferencias numéricas por posición se incorporan con las métricas (etapas 6 y 7).</Text>
          <View style={styles.chips}>
            {(Object.keys(ZONE_LABEL) as Zone[]).map((z) => (
              <Chip key={z} variant={z === zone ? "selected" : "neutral"} onPress={() => setZone(z)}>{ZONE_LABEL[z]}</Chip>
            ))}
          </View>
          <View style={{ marginTop: space[3], gap: space[4] }}>
            <LineChart series={[{ name: "A · izq.", values: da.series[lc] }, { name: "B · izq.", values: db.series[lc] }]} startLabel="0:00" endLabel="fin" label="Pie izquierdo · alineadas por tiempo de sesión" />
            <LineChart series={[{ name: "A · der.", values: da.series[rc] }, { name: "B · der.", values: db.series[rc] }]} startLabel="0:00" endLabel="fin" label="Pie derecho · alineadas por tiempo de sesión" />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sessionCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: space[3], paddingHorizontal: space[4], gap: space[1] },
  reqRow: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 48 },
  reqBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  chips: { flexDirection: "row", gap: space[2], marginTop: space[3] },
});
