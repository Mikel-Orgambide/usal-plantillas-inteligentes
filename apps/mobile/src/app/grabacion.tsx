import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import type { ChannelCode } from "@plantillas/contract";
import { Button, Chip, FootMap, Icon, LineChart, Screen, Sheet, StatusBanner, Text, ValueCard } from "../presentation/components";
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
const MODULE_LABEL: Record<string, string> = { identified: "sin enlace", connected: "conectado", stale: "sin datos", disconnected: "perdido", reconnecting: "reconectando" };
const FOOT_SHORT: Record<string, string> = { left: "Izq", right: "Der" };

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
  const finished = !!active?.result;
  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [finished]);

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
    ...(v[lc].status !== "unavailable" ? [{ name: "Izquierdo", values: liveSeries(live, lc), stale }] : []),
    ...(v[rc].status !== "unavailable" ? [{ name: "Derecho", values: liveSeries(live, rc), stale }] : []),
  ];
  const feetLabel = series.length === 2 ? "izquierdo y derecho" : v[lc].status !== "unavailable" ? "izquierdo · derecho no instrumentado" : "derecho · izquierdo no instrumentado";
  const rate = snapshot.durationMs > 0 ? snapshot.stats.accepted / (snapshot.durationMs / 1000) : 0;

  const finish = async () => {
    setConfirm(false);
    setStopping(true);
    await stopSession();
    setStopping(false);
  };

  const close = () => {
    const id = active.coordinator.sessionId;
    clearSession();
    router.replace({ pathname: "/historial/sesion/[id]", params: { id } });
  };

  return (
    <>
    <Screen
      footer={
        finished ? (
          // key distinta: elemento nativo nuevo, no el de «Finalizar» reciclado tras pasar por disabled.
          <Button key="ver" variant="primary" onPress={close}>Ver la sesión</Button>
        ) : (
          <Button key="finalizar" variant="primary" icon="stop" disabled={stopping} onPress={() => setConfirm(true)}>{stopping ? "Finalizando…" : "Finalizar"}</Button>
        )
      }
    >
      {keepAwake && !finished ? <KeepAwake /> : null}

      <View style={styles.statusRow}>
        {!finished ? (
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver al inicio; la sesión sigue grabando" hitSlop={8} style={styles.back}>
            <Icon name="chevron-right" size={20} color={colors.textSecondary} />
          </Pressable>
        ) : null}
        <View style={[styles.dot, { backgroundColor: stale ? colors.alert : finished ? colors.stale : colors.accent }]} />
        <Text variant="caption" color={colors.textSecondary}>
          {STATE_LABEL[snapshot.state]} · {active.sourceTitle} · {active.sourceKind === "physical" ? "físicas" : "simuladas"} · {ACTIVITY_LABEL[active.activity]}
        </Text>
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
    </Screen>

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
});
