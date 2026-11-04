import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { AssistantFab, Button, Chip, DayCard, Halo, Header, Icon, ListRow, Screen, StatusBanner, Text, TextButton } from "../../../presentation/components";
import { colors, formatDuration, formatNumber, space } from "../../../presentation/theme/tokens";
import { useSessionList } from "../../../application/useSessions";
import { useAuth } from "../../../application/authStore";
import { ACTIVITY_LABEL, type Activity } from "../../../application/sessionStore";
import { dayShort, groupByDay } from "../../../application/daySummary";

type Filter = "all" | Activity | "simulated";

/** Días que se muestran de entrada; el resto detrás de «Ver sesiones anteriores». */
const RECENT_DAYS = 7;

const timeOf = (iso: string): string => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

/** Duración total como «4:12 h» o «36 min». */
function totalDuration(ms: number): { value: string; unit: string } {
  const minutes = Math.round(ms / 60000);
  if (minutes >= 60) return { value: `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`, unit: "h" };
  return { value: String(minutes), unit: "min" };
}

/**
 * Historial (Figma «Historial · propuesta B»): resumen, filtros y sesiones
 * agrupadas por día en tarjetas; selección de dos para comparar.
 */
export default function HistoryScreen() {
  const router = useRouter();
  const { sessions, hiddenCount, error, reload } = useSessionList();
  const auth = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const { select } = useLocalSearchParams<{ select?: string }>();
  // «Comparar con…» desde el detalle llega con la sesión ya marcada.
  useEffect(() => { if (select) setSelected([select]); }, [select]);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const toggle = (id: string) => {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 2 ? [...cur, id] : [cur[1]!, id]));
  };

  const list = (sessions ?? []).filter((s) => filter === "all" ? true : filter === "simulated" ? s.source === "simulated" : s.activity === filter);
  const physical = (sessions ?? []).filter((s) => s.source === "physical").length;
  const simulated = (sessions ?? []).filter((s) => s.source === "simulated").length;
  const total = totalDuration((sessions ?? []).reduce((n, s) => n + (s.duration_ms ?? 0), 0));
  const groups = useMemo(() => groupByDay(list), [list]);
  const visible = showAll ? groups : groups.slice(0, RECENT_DAYS);
  const hiddenDays = groups.length - visible.length;

  const sourceChip = (s: { state: string; source: string }) =>
    s.state === "incomplete" ? <Chip variant="alert">Incompleta</Chip> : s.source === "simulated" ? <Chip variant="sim" icon="foot">Simulada</Chip> : <Chip>Física</Chip>;

  return (
    <>
    <Screen
      tabbed
      footer={
        selected.length === 2 ? (
          <Button variant="primary" icon="compare" onPress={() => router.push({ pathname: "/historial/comparar", params: { a: selected[0]!, b: selected[1]! } })}>Comparar las 2 elegidas</Button>
        ) : undefined
      }
    >
      <Halo />
      <Header title="Historial" context={sessions ? `${sessions.length} sesiones · ${physical} físicas · ${simulated} simuladas` : "Cargando…"} />
      {auth.status === "signed_in" || hiddenCount > 0 ? (
        <Text variant="caption" color={colors.textSecondary} style={{ marginBottom: space[3] }}>
          {auth.status === "signed_in" ? `Sesiones de ${auth.email ?? "la cuenta activa"}` : "Sesiones de este teléfono, sin cuenta"}
          {hiddenCount > 0 ? ` · ${hiddenCount} de otra(s) cuenta(s) no se muestran` : ""}
        </Text>
      ) : null}

      {/* Resumen. */}
      <DayCard style={styles.summary}>
        <View style={styles.stat}>
          <Text variant="numMd" color={colors.accent}>{sessions ? formatNumber(sessions.length) : "…"}</Text>
          <Text variant="caption" color={colors.textSecondary}>sesiones</Text>
        </View>
        <View style={styles.stat}>
          <View style={styles.valueRow}>
            <Text variant="numMd">{sessions ? total.value : "…"}</Text>
            <Text variant="caption" color={colors.textSecondary}>{total.unit}</Text>
          </View>
          <Text variant="caption" color={colors.textSecondary}>grabadas</Text>
        </View>
        <View style={styles.stat}>
          <Text variant="numMd">{sessions ? `${physical} · ${simulated}` : "…"}</Text>
          <Text variant="caption" color={colors.textSecondary}>físicas · simuladas</Text>
        </View>
      </DayCard>

      {/* Filtros. */}
      <View style={styles.chips}>
        <Chip variant={filter === "all" ? "selected" : "neutral"} onPress={() => setFilter("all")}>Todas</Chip>
        {(Object.keys(ACTIVITY_LABEL) as Activity[]).map((a) => (
          <Chip key={a} variant={filter === a ? "selected" : "neutral"} onPress={() => setFilter(a)}>{ACTIVITY_LABEL[a]}</Chip>
        ))}
        <Chip variant={filter === "simulated" ? "selected" : "sim"} icon="foot" onPress={() => setFilter("simulated")}>Simuladas</Chip>
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
            {sessions.length === 0 ? (hiddenCount > 0 ? "Esta cuenta todavía no tiene sesiones en este teléfono. Grabá la primera desde Inicio." : "Grabá la primera desde Inicio.") : "Probá con otro filtro."}
          </Text>
        </View>
      ) : (
        <>
          <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[3] }}>
            Tocá una sesión para abrirla · marcá dos con el círculo para comparar ({selected.length} de 2)
          </Text>
          <View style={{ marginTop: space[4], gap: space[3] }}>
            {visible.map((g) => (
              <DayCard key={g.day} padded={false} title={dayShort(g.day)} aside={`${g.sessions.length} ${g.sessions.length === 1 ? "sesión" : "sesiones"} · ${formatDuration(g.durationMs)} min`}>
                {g.sessions.map((s, i) => (
                  <ListRow
                    key={s.id}
                    inset
                    last={i === g.sessions.length - 1}
                    lead={timeOf(s.started_at)}
                    title={ACTIVITY_LABEL[s.activity as Activity] ?? s.activity}
                    subtitle={`${formatDuration(s.duration_ms ?? 0)} · ${formatNumber(s.record_count)} reg.${s.read_error_count ? ` · ${s.read_error_count} fallidas` : ""}${s.gap_count ? ` · ${s.gap_count} hueco(s)` : ""}${s.capture_count > 1 ? ` · ${s.capture_count} capturas` : ""}`}
                    chip={sourceChip(s)}
                    selected={selected.includes(s.id)}
                    onSelect={() => toggle(s.id)}
                    onPress={() => router.push({ pathname: "/historial/sesion/[id]", params: { id: s.id } })}
                  />
                ))}
              </DayCard>
            ))}
          </View>
          {hiddenDays > 0 ? (
            <TextButton icon="chevron-down" style={{ marginTop: space[3] }} onPress={() => setShowAll(true)}>{`Ver sesiones anteriores (${hiddenDays} ${hiddenDays === 1 ? "día" : "días"} más)`}</TextButton>
          ) : showAll && groups.length > RECENT_DAYS ? (
            <TextButton style={{ marginTop: space[3] }} onPress={() => setShowAll(false)}>Mostrar solo los últimos días</TextButton>
          ) : null}
        </>
      )}
    </Screen>
    <AssistantFab bottomOffset={selected.length === 2 ? 96 : 16} />
    </>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: space[6] },
  stat: { gap: 2 },
  valueRow: { flexDirection: "row", alignItems: "baseline", gap: space[1] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  empty: { alignItems: "center", paddingVertical: space[12], paddingHorizontal: space[8], gap: space[3] },
});
