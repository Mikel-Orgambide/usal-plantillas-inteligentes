import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Button, Chip, Header, Icon, ListRow, Screen, StatusBanner, Text } from "../../../presentation/components";
import { colors, formatDate, formatDuration, formatNumber, space } from "../../../presentation/theme/tokens";
import { useSessionList } from "../../../application/useSessions";
import { ACTIVITY_LABEL, type Activity } from "../../../application/sessionStore";

type Filter = "all" | Activity | "simulated";

/** Historial: lista de sesiones, filtros y selección de dos para comparar. */
export default function HistoryScreen() {
  const router = useRouter();
  const { sessions, error, reload } = useSessionList();
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string[]>([]);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const toggle = (id: string) => {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 2 ? [...cur, id] : [cur[1]!, id]));
  };

  const list = (sessions ?? []).filter((s) => filter === "all" ? true : filter === "simulated" ? s.source === "simulated" : s.activity === filter);
  const physical = (sessions ?? []).filter((s) => s.source === "physical").length;
  const simulated = (sessions ?? []).filter((s) => s.source === "simulated").length;

  const stateChip = (s: { state: string; source: string }) =>
    s.state === "incomplete" ? <Chip variant="alert">Incompleta</Chip> : s.source === "simulated" ? <Chip variant="sim" icon="settings">Simulada</Chip> : undefined;

  return (
    <Screen
      tabbed
      footer={
        selected.length === 2 ? (
          <Button variant="primary" icon="compare" onPress={() => router.push({ pathname: "/historial/comparar", params: { a: selected[0]!, b: selected[1]! } })}>Comparar las 2 elegidas</Button>
        ) : undefined
      }
    >
      <Header title="Historial" context={sessions ? `${sessions.length} sesiones · ${physical} físicas · ${simulated} simuladas` : "Cargando…"} />

      <View style={styles.chips}>
        <Chip variant={filter === "all" ? "selected" : "neutral"} icon={filter === "all" ? "check" : undefined} onPress={() => setFilter("all")}>Todas</Chip>
        {(Object.keys(ACTIVITY_LABEL) as Activity[]).map((a) => (
          <Chip key={a} variant={filter === a ? "selected" : "neutral"} onPress={() => setFilter(a)}>{ACTIVITY_LABEL[a]}</Chip>
        ))}
        <Chip variant={filter === "simulated" ? "selected" : "sim"} icon="settings" onPress={() => setFilter("simulated")}>Simuladas</Chip>
      </View>

      {error ? (
        <View style={{ marginTop: space[4] }}>
          <StatusBanner tone="alert" icon="alert" detail={error} actionLabel="Reintentar" onAction={() => void reload()}>No se pudo leer el historial</StatusBanner>
        </View>
      ) : sessions === null ? (
        <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[4] }}>Cargando sesiones…</Text>
      ) : list.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="history" size={32} />
          <Text variant="heading">{sessions.length === 0 ? "Todavía no hay sesiones" : "Nada con este filtro"}</Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: "center" }}>
            {sessions.length === 0 ? "Grabá la primera desde Inicio." : "Probá con otro filtro."}
          </Text>
        </View>
      ) : (
        <>
          <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[4] }}>
            Tocá una sesión para abrirla · marcá dos con el círculo para comparar ({selected.length} de 2)
          </Text>
          <View style={{ marginTop: space[1] }}>
            {list.map((s) => (
              <ListRow
                key={s.id}
                title={formatDate(s.started_at)}
                subtitle={`${ACTIVITY_LABEL[s.activity as Activity] ?? s.activity} · ${formatDuration(s.duration_ms ?? 0)} · ${formatNumber(s.record_count)} registros${s.state === "completed" ? " · completa" : ""}`}
                chip={stateChip(s)}
                selected={selected.includes(s.id)}
                onSelect={() => toggle(s.id)}
                onPress={() => router.push({ pathname: "/historial/sesion/[id]", params: { id: s.id } })}
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  empty: { alignItems: "center", paddingVertical: space[12], paddingHorizontal: space[8], gap: space[3] },
});
