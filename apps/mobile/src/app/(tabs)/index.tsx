import { View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Button, Card, Header, Icon, Screen, StatusBanner, Text, TextButton, ValueCard } from "../../presentation/components";
import { colors, formatDate, formatDuration, formatNumber, space } from "../../presentation/theme/tokens";
import { useSessionList } from "../../application/useSessions";
import { useActiveSession, ACTIVITY_LABEL, type Activity } from "../../application/sessionStore";
import { loadSettings } from "../../infrastructure/settings/settings";

/** Inicio («Hoy»): estado del dispositivo, última sesión y las dos acciones. */
export default function HomeScreen() {
  const router = useRouter();
  const { sessions, error, reload } = useSessionList();
  const active = useActiveSession();
  const settings = loadSettings();
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const last = sessions?.[0];
  const recording = active && !active.result;
  const stateLabel = (s: string) => ({ completed: "completa", incomplete: "incompleta" }[s] ?? s);

  return (
    <Screen
      tabbed
      footer={
        recording ? (
          <Button variant="primary" icon="play" onPress={() => router.push("/grabacion")}>Volver a la sesión en curso</Button>
        ) : (
          <Button variant="primary" icon="plus" onPress={() => router.push("/preparacion")}>Nueva sesión</Button>
        )
      }
    >
      <Header
        title="Hoy"
        status={settings.simulatorMode ? "connected" : "off"}
        context={settings.simulatorMode ? "Simulador · SIM-001 · plantillas simuladas" : "Sin dispositivo"}
        action="settings"
        actionLabel="Ajustes"
        onAction={() => router.push("/ajustes")}
      />

      <Text variant="label" color={colors.textSecondary} style={{ marginBottom: space[2] }}>Dispositivo</Text>
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <ValueCard label="Posiciones" value="6" unit="de 6" sub="talón · medial · lateral" style={{ flex: 1 }} />
        <ValueCard label="Fuente activa" value={settings.simulatorMode ? "Simulada" : "—"} sub={settings.simulatorMode ? `SIM-CONFIG-001 · escenario ${settings.scenario}` : "conectá las plantillas"} style={{ flex: 1 }} />
      </View>

      {error ? (
        <View style={{ marginTop: space[6] }}>
          <StatusBanner tone="alert" icon="alert" detail={error} actionLabel="Reintentar" onAction={() => void reload()}>No se pudo leer el historial</StatusBanner>
        </View>
      ) : sessions === null ? (
        <View style={{ marginTop: space[6] }}>
          <Card title="Última sesión"><Text variant="caption" color={colors.textSecondary}>Cargando…</Text></Card>
        </View>
      ) : last ? (
        <View style={{ marginTop: space[6] }}>
          <Card title="Última sesión">
            <Text variant="caption" color={colors.textSecondary} style={{ marginBottom: space[3] }}>
              {formatDate(last.started_at)} · {ACTIVITY_LABEL[last.activity as Activity] ?? last.activity} · {last.source === "simulated" ? "simulada" : "física"} · {stateLabel(last.state)}
            </Text>
            <View style={{ flexDirection: "row", gap: space[3] }}>
              <ValueCard elevated label="Duración" value={formatDuration(last.duration_ms ?? 0)} unit="min" style={{ flex: 1 }} />
              <ValueCard elevated label="Registros" value={last.record_count} unit="reg." sub={`${last.capture_count} captura(s) · ${last.event_count} eventos`} style={{ flex: 1 }} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: space[3] }}>
              <TextButton icon="chevron-right" onPress={() => router.push({ pathname: "/historial/sesion/[id]", params: { id: last.id } })}>Ver detalle</TextButton>
              <Icon name="chevron-right" size={20} color={colors.accent} />
            </View>
          </Card>
        </View>
      ) : (
        <View style={{ alignItems: "center", paddingVertical: space[12], paddingHorizontal: space[8], gap: space[3] }}>
          <Icon name="foot" size={32} />
          <Text variant="heading">Todavía no hay sesiones</Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: "center" }}>
            El simulador está listo. Tocá Nueva sesión para grabar la primera.
          </Text>
        </View>
      )}
      {sessions && sessions.length > 1 ? (
        <TextButton icon="chevron-right" style={{ marginTop: space[3] }} onPress={() => router.navigate("/historial")}>
          {`Ver las ${formatNumber(sessions.length)} sesiones en Historial`}
        </TextButton>
      ) : null}
    </Screen>
  );
}
