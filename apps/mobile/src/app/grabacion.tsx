import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import type { ChannelCode } from "@plantillas/contract";
import { Button, Chip, FootMap, LineChart, Screen, Sheet, StatusBanner, Text, ValueCard } from "../presentation/components";
import { colors, formatDuration, formatNumber, radius, space } from "../presentation/theme/tokens";
import { ACTIVITY_LABEL, clearSession, liveSeries, stopSession, useActiveSession } from "../application/sessionStore";
import { loadSettings } from "../infrastructure/settings/settings";

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

function KeepAwake() {
  useKeepAwake();
  return null;
}

/** Grabación en vivo: duración, siluetas, gráfico de la ventana reciente y Finalizar. */
export default function RecordingScreen() {
  const router = useRouter();
  const active = useActiveSession();
  const [zone, setZone] = useState<Zone>("heel");
  const [confirm, setConfirm] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [, tick] = useState(0);
  const keepAwake = loadSettings().keepAwake;

  // Refresco del reloj y del gráfico aunque no lleguen registros (huecos visibles).
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  if (!active) {
    return (
      <Screen footer={<Button variant="primary" onPress={() => router.replace("/")}>Volver al inicio</Button>}>
        <Text variant="heading">No hay una sesión en curso</Text>
      </Screen>
    );
  }

  const { snapshot, live, result } = active;
  const stale = snapshot.state === "interrupted";
  const v = snapshot.values;
  const left = { heel: v.L_HEEL.value, medial: v.L_MEDIAL.value, lateral: v.L_LATERAL.value };
  const right = { heel: v.R_HEEL.value, medial: v.R_MEDIAL.value, lateral: v.R_LATERAL.value };
  const [lc, rc] = ZONE_CHANNELS[zone];
  const series = [
    { name: "Izquierdo", values: liveSeries(live, lc), stale },
    { name: "Derecho", values: liveSeries(live, rc), stale },
  ];
  const rate = snapshot.durationMs > 0 ? snapshot.stats.accepted / (snapshot.durationMs / 1000) : 0;
  const finished = !!result;

  const finish = async () => {
    setConfirm(false);
    setStopping(true);
    await stopSession();
    setStopping(false);
  };

  const close = () => {
    const id = active.coordinator.sessionId;
    clearSession();
    router.replace({ pathname: "/sesion/[id]", params: { id } });
  };

  return (
    <Screen
      footer={
        finished ? (
          <Button variant="primary" onPress={close}>Ver la sesión</Button>
        ) : (
          <Button variant="primary" icon="stop" disabled={stopping} onPress={() => setConfirm(true)}>{stopping ? "Finalizando…" : "Finalizar"}</Button>
        )
      }
    >
      {keepAwake && !finished ? <KeepAwake /> : null}

      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: stale ? colors.alert : finished ? colors.stale : colors.accent }]} />
        <Text variant="caption" color={colors.textSecondary}>
          {STATE_LABEL[snapshot.state]} · SIM-001 · simuladas · {ACTIVITY_LABEL[active.activity]}
        </Text>
      </View>

      {stale ? (
        <View style={{ marginTop: space[4] }}>
          <StatusBanner tone="alert" icon="bluetooth-off" detail="Los valores en gris son anteriores a la desconexión">Conexión interrumpida</StatusBanner>
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
        style={{ marginTop: space[6] }}
      />

      <View style={{ marginTop: space[6] }}>
        <FootMap left={left} right={right} stale={stale} />
      </View>

      <View style={styles.chips}>
        {(Object.keys(ZONE_LABEL) as Zone[]).map((z) => (
          <Chip key={z} variant={z === zone ? "selected" : "neutral"} onPress={() => setZone(z)}>{ZONE_LABEL[z]}</Chip>
        ))}
      </View>
      <View style={{ marginTop: space[3] }}>
        <LineChart series={series} startLabel="−10 s" endLabel="ahora" label={`${ZONE_LABEL[zone]} · izquierdo y derecho · últimos 10 segundos${snapshot.stats.gaps ? ` · ${snapshot.stats.gaps} hueco(s)` : ""}`} />
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

      <Sheet visible={confirm} onDismiss={() => setConfirm(false)}>
        <Text variant="heading">Finalizar la sesión</Text>
        <Text variant="body" color={colors.textSecondary}>
          Se guardan <Text variant="body">{formatDuration(snapshot.durationMs)}</Text> min y <Text variant="body">{formatNumber(snapshot.stats.accepted)}</Text> registros. Una sesión finalizada no se puede reanudar.
        </Text>
        <View style={{ gap: space[3], marginTop: space[3] }}>
          <Button variant="danger" icon="stop" onPress={() => void finish()}>Finalizar</Button>
          <Button onPress={() => setConfirm(false)}>Seguir grabando</Button>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: "row", alignItems: "center", gap: space[2], paddingTop: space[3] },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  chips: { flexDirection: "row", gap: space[2], marginTop: space[6] },
  counters: { flexDirection: "row", justifyContent: "space-between", marginTop: space[3] },
});
