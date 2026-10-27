import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type { ChannelCode } from "@plantillas/contract";
import { Button, Card, Chip, Icon, ListRow, MeterRow, Ring, Screen, Sheet, StatusBanner, Text, TextButton, ValueCard } from "../../presentation/components";
import { colors, formatDuration, formatNumber, radius, size, space } from "../../presentation/theme/tokens";
import { useSessionList } from "../../application/useSessions";
import { useActiveSession, ACTIVITY_LABEL, type Activity } from "../../application/sessionStore";
import { useActiveSource } from "../../application/activeSource";
import { useAuth } from "../../application/authStore";
import { availableDays, dayLabel, describeDistribution, todayKey, useDaySummary, type DaySummary } from "../../application/daySummary";

/**
 * Inicio («Hoy»): un día navegable con tres indicadores del día (reparto
 * izquierda/derecha, antepié/retropié y calidad de los datos), el resumen del
 * día, sus sesiones y la acción de grabar. Los indicadores son proporciones
 * entre medias de la señal en cuentas ADC (`dist-1.0`): describen el reparto
 * de la lectura, no fuerza, presión, rendimiento ni un puntaje.
 */

type Panel = "balance" | "zones" | "quality";

const POSITION_LABEL: Record<ChannelCode, string> = {
  L_HEEL: "Talón izq.", L_MEDIAL: "Medial izq.", L_LATERAL: "Lateral izq.", R_HEEL: "Talón der.", R_MEDIAL: "Medial der.", R_LATERAL: "Lateral der.",
};
const POSITION_ORDER: ChannelCode[] = ["L_HEEL", "R_HEEL", "L_MEDIAL", "R_MEDIAL", "L_LATERAL", "R_LATERAL"];

const pct = (f: number | null): string => (f === null ? "—" : `${Math.round(f * 100)} %`);
const timeOf = (iso: string): string => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

export default function HomeScreen() {
  const router = useRouter();
  const { sessions, error, reload } = useSessionList();
  const active = useActiveSession();
  const source = useActiveSource();
  const auth = useAuth();
  const [day, setDay] = useState(todayKey());
  const [panel, setPanel] = useState<Panel | null>(null);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  const { summary, error: dayError } = useDaySummary(day, sessions);

  const days = availableDays(sessions ?? []);
  const index = days.indexOf(day);
  const newer = index > 0 ? days[index - 1] : undefined;
  const older = index >= 0 && index < days.length - 1 ? days[index + 1] : undefined;
  const recording = active && !active.result;
  const d = summary?.distribution;
  const ready = summary !== undefined && summary.day === day;

  return (
    <>
    <Screen
      tabbed
      footer={
        recording ? (
          <Button variant="primary" icon="play" onPress={() => router.push("/grabacion")}>Volver a la sesión en curso</Button>
        ) : (
          <Button variant="primary" icon="plus" disabled={source.kind === "none"} onPress={() => router.push("/preparacion")}>Nueva sesión</Button>
        )
      }
    >
      {/* Cabecera: día navegable + estado de la fuente + Ajustes. */}
      <View style={styles.headerRow}>
        <Pressable onPress={older ? () => setDay(older) : undefined} disabled={!older} hitSlop={8} accessibilityRole="button" accessibilityLabel="Día anterior" style={[styles.navBtn, !older && { opacity: 0.3 }]}>
          <Icon name="chevron-left" color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text variant="title">{dayLabel(day)}</Text>
          <View style={styles.contextRow}>
            <View style={[styles.dot, { backgroundColor: source.kind === "none" ? colors.stale : colors.accent }]} />
            <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>{source.title}{auth.status === "signed_in" && auth.email ? ` · ${auth.email}` : ""}</Text>
          </View>
        </View>
        <Pressable onPress={newer ? () => setDay(newer) : undefined} disabled={!newer} hitSlop={8} accessibilityRole="button" accessibilityLabel="Día siguiente" style={[styles.navBtn, !newer && { opacity: 0.3 }]}>
          <Icon name="chevron-right" color={colors.textPrimary} />
        </Pressable>
        <Pressable onPress={() => router.push("/ajustes")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Ajustes" style={styles.navBtn}>
          <Icon name="settings" color={colors.textSecondary} />
        </Pressable>
      </View>
      {day !== todayKey() ? <TextButton style={{ alignSelf: "center", marginTop: space[1] }} onPress={() => setDay(todayKey())}>Volver a hoy</TextButton> : null}

      {/* Tres indicadores del día. */}
      <View style={styles.rings}>
        <Ring value={ready ? d?.left_share ?? null : null} text={ready ? pct(d?.left_share ?? null) : "…"} inner="izquierdo" label="Izq / der" secondColor={colors.accentSoft} onPress={() => setPanel("balance")} />
        <Ring value={ready ? d?.forefoot_share ?? null : null} text={ready ? pct(d?.forefoot_share ?? null) : "…"} inner="antepié" label="Antepié / talón" secondColor={colors.accentSoft} onPress={() => setPanel("zones")} />
        <Ring value={ready ? summary.quality : null} text={ready ? pct(summary.quality) : "…"} inner="recibido" label="Calidad" color={summary?.quality !== null && summary !== undefined && summary.quality < 0.98 ? colors.alert : colors.accent} onPress={() => setPanel("quality")} />
      </View>
      <Text variant="caption" color={colors.textSecondary} style={{ textAlign: "center", marginTop: space[2] }}>
        Reparto de la lectura entre posiciones, en cuentas ADC · tocá un indicador para ver el desglose
      </Text>

      {error ? (
        <View style={{ marginTop: space[6] }}>
          <StatusBanner tone="alert" icon="alert" detail={error} actionLabel="Reintentar" onAction={() => void reload()}>No se pudo leer el historial</StatusBanner>
        </View>
      ) : null}
      {dayError ? <Text variant="caption" color={colors.alert} style={{ marginTop: space[3] }}>No se pudo resumir el día: {dayError}</Text> : null}

      {/* Resumen del día. */}
      <Text variant="label" color={colors.textSecondary} style={{ marginTop: space[6], marginBottom: space[2] }}>Resumen del día</Text>
      <View style={styles.grid}>
        <ValueCard label="Sesiones" value={ready ? summary.sessions.length : "…"} sub={ready ? `${summary.physical} físicas · ${summary.simulated} simuladas` : ""} style={styles.half} />
        <ValueCard label="Tiempo grabado" value={ready ? formatDuration(summary.durationMs) : "…"} unit="min" sub={ready ? `${formatNumber(summary.records)} registros` : ""} style={styles.half} />
        <ValueCard label="Carga acumulada" value={ready ? (summary.load === null ? null : formatLoad(summary.load)) : "…"} unit={ready && summary.load !== null ? "cuentas·s" : undefined} sub="aproximada · sin calibración" style={styles.half} />
        <ValueCard label="Huecos y fallas" value={ready ? `${summary.gaps} · ${summary.readErrors}` : "…"} sub="huecos · lecturas fallidas" style={styles.half} />
      </View>

      {/* Sesiones del día. */}
      <Text variant="label" color={colors.textSecondary} style={{ marginTop: space[6], marginBottom: space[2] }}>Sesiones del día</Text>
      {sessions === null ? (
        <Text variant="caption" color={colors.textSecondary}>Cargando…</Text>
      ) : !ready || summary.sessions.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="foot" size={28} />
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: "center" }}>
            {day === todayKey() ? `Sin sesiones todavía. ${source.kind === "physical" ? "Las plantillas están conectadas." : source.kind === "simulated" ? "El simulador está listo." : "Conectá las plantillas."} Tocá Nueva sesión para grabar.` : "Sin sesiones este día."}
          </Text>
        </View>
      ) : (
        summary.sessions.map((s) => (
          <ListRow
            key={s.id}
            title={`${timeOf(s.started_at)} · ${ACTIVITY_LABEL[s.activity as Activity] ?? s.activity}`}
            subtitle={`${formatDuration(s.duration_ms ?? 0)} min · ${formatNumber(s.record_count)} registros${s.gap_count ? ` · ${s.gap_count} hueco(s)` : ""}`}
            chip={s.state === "incomplete" ? <Chip variant="alert">Incompleta</Chip> : s.source === "simulated" ? <Chip variant="sim" icon="settings">Simulada</Chip> : <Chip icon="bluetooth">Física</Chip>}
            onPress={() => router.push({ pathname: "/historial/sesion/[id]", params: { id: s.id } })}
          />
        ))
      )}
      {sessions && sessions.length > 0 ? (
        <TextButton icon="chevron-right" style={{ marginTop: space[3] }} onPress={() => router.navigate("/historial")}>
          {`Ver las ${formatNumber(sessions.length)} sesiones en Historial`}
        </TextButton>
      ) : null}
    </Screen>

    {/* Desglose del indicador elegido. */}
    <Sheet visible={panel !== null} onDismiss={() => setPanel(null)}>
      {panel && ready ? <Breakdown panel={panel} summary={summary} /> : null}
      <View style={{ marginTop: space[3] }}><Button onPress={() => setPanel(null)}>Cerrar</Button></View>
    </Sheet>
    </>
  );
}

function formatLoad(load: number): string {
  if (load >= 1_000_000) return `${formatNumber(load / 1_000_000, 2)} M`;
  if (load >= 10_000) return `${formatNumber(load / 1000, 1)} k`;
  return formatNumber(load);
}

function Breakdown({ panel, summary }: { panel: Panel; summary: DaySummary }) {
  const d = summary.distribution;
  const ch = summary.channels;
  const note = (text: string) => <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[2] }}>{text}</Text>;

  if (panel === "quality") {
    return (
      <>
        <Text variant="heading">Calidad de los datos</Text>
        <Text variant="body" color={colors.textSecondary}>Cuánto de lo que las plantillas emitieron llegó y se guardó. No describe al usuario: describe la captura.</Text>
        <MeterRow label="Registros recibidos" fraction={summary.quality} value={pct(summary.quality)} />
        <MeterRow label="Esperados" fraction={null} value={formatNumber(summary.expected)} />
        <MeterRow label="Huecos de secuencia" fraction={summary.expected ? Math.min(1, (summary.expected - summary.records) / summary.expected) : null} value={formatNumber(summary.gaps)} color={colors.alert} />
        <MeterRow label="Lecturas fallidas" fraction={summary.records ? Math.min(1, summary.readErrors / (summary.records * 6)) : null} value={formatNumber(summary.readErrors)} color={colors.alert} />
        {note(`${summary.measured} sesión(es) con capturas aportan a este día. Un registro trae seis lecturas; una lectura fallida (read_error) se guarda como tal y no se interpola.`)}
      </>
    );
  }

  if (!d || !ch || d.left_share === null) {
    return (
      <>
        <Text variant="heading">{panel === "balance" ? "Izquierda / derecha" : "Antepié / talón"}</Text>
        <Text variant="body" color={colors.textSecondary}>{d ? describeDistribution(d) : "Sin sesiones con capturas en este día."}</Text>
      </>
    );
  }

  if (panel === "balance") {
    return (
      <>
        <Text variant="heading">Izquierda / derecha</Text>
        <Text variant="body" color={colors.textSecondary}>{describeDistribution(d)}</Text>
        <MeterRow label="Pie izquierdo" fraction={d.left_share} value={pct(d.left_share)} />
        <MeterRow label="Pie derecho" fraction={d.right_share} value={pct(d.right_share)} />
        <Text variant="label" color={colors.textSecondary} style={{ marginTop: space[3] }}>Diferencia por zona (izq − der)</Text>
        <MeterRow label="Talón" fraction={d.asymmetry.heel} value={signedPct(d.asymmetry.heel)} centered />
        <MeterRow label="Medial" fraction={d.asymmetry.medial} value={signedPct(d.asymmetry.medial)} centered />
        <MeterRow label="Lateral" fraction={d.asymmetry.lateral} value={signedPct(d.asymmetry.lateral)} centered />
        {note(`Proporción entre las medias de las posiciones de cada pie (${formatNumber(d.total_mean)} cuentas en total). Positivo = más lectura a la izquierda. Es un descriptor de la lectura en cuentas ADC; sin calibración no equivale a fuerza ni a peso.`)}
      </>
    );
  }

  return (
    <>
      <Text variant="heading">Antepié / talón</Text>
      <Text variant="body" color={colors.textSecondary}>{describeDistribution(d)}</Text>
      <MeterRow label="Antepié (medial + lateral)" fraction={d.forefoot_share} value={pct(d.forefoot_share)} />
      <MeterRow label="Talón" fraction={d.rearfoot_share} value={pct(d.rearfoot_share)} />
      <Text variant="label" color={colors.textSecondary} style={{ marginTop: space[3] }}>Media por posición (cuentas ADC)</Text>
      {POSITION_ORDER.map((code) => (
        <MeterRow key={code} label={POSITION_LABEL[code]} fraction={ch[code].sample_mean === null || d.total_mean === null ? null : ch[code].sample_mean / d.total_mean} value={ch[code].sample_mean === null ? "—" : formatNumber(ch[code].sample_mean)} />
      ))}
      <MeterRow label="Variabilidad (σ / media)" fraction={d.variability} value={d.variability === null ? "—" : formatNumber(d.variability, 2)} />
      {note("Medias ponderadas por lecturas válidas de todas las capturas del día. La variabilidad indica cuánto cambian las lecturas alrededor de su media; no se interpreta como estabilidad del usuario sin evidencia experimental.")}
    </>
  );
}

const signedPct = (f: number | null): string => (f === null ? "—" : `${f > 0 ? "+" : f < 0 ? "−" : ""}${Math.round(Math.abs(f) * 100)} %`);

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: space[1], marginBottom: space[2] },
  navBtn: { width: size.controlHeight, height: size.controlHeight, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  contextRow: { flexDirection: "row", alignItems: "center", gap: space[2], marginTop: 2, maxWidth: "100%" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rings: { flexDirection: "row", justifyContent: "space-between", gap: space[2], marginTop: space[4] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space[3] },
  half: { flexBasis: "47%", flexGrow: 1 },
  empty: { alignItems: "center", paddingVertical: space[6], paddingHorizontal: space[6], gap: space[3], backgroundColor: colors.surface, borderRadius: radius.md },
});
