import { useState } from "react";
import { StyleSheet, Switch, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Header, Screen, StatusBanner, Text } from "../../presentation/components";
import { colors, fonts, radius, size, space } from "../../presentation/theme/tokens";
import { loadSettings, saveSettings, type Settings } from "../../infrastructure/settings/settings";
import { testAssistantServer } from "../../application/assistantStore";

/**
 * Ajustes del asistente explicativo (ADR 0012): servidor compatible con
 * OpenAI (LM Studio en la PC del autor), modelo opcional, prueba de conexión
 * y el interruptor del botón flotante.
 */
export default function AssistantSettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [url, setUrl] = useState(settings.assistantUrl);
  const [model, setModel] = useState(settings.assistantModel);
  const [probe, setProbe] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const update = (patch: Partial<Settings>) => setSettings(saveSettings(patch));
  const persist = () => update({ assistantUrl: url.trim(), assistantModel: model.trim() });

  const test = async () => {
    persist();
    setBusy(true);
    setProbe(null);
    try {
      const models = await testAssistantServer(url.trim());
      setProbe({ ok: true, text: `Servidor en línea · modelo(s): ${models.join(", ")}` });
    } catch (e) {
      setProbe({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title="Asistente" context="Explica lo ya calculado · no diagnostica" onBack={() => router.back()} />
      <View style={styles.toggleRow}>
        <View style={{ flex: 1, gap: space[1] }}>
          <Text variant="body">Botón flotante</Text>
          <Text variant="caption" color={colors.textSecondary}>Muestra el asistente en Hoy, Historial y el detalle de una sesión.</Text>
        </View>
        <Switch value={settings.assistantEnabled} onValueChange={(v) => update({ assistantEnabled: v })} trackColor={{ true: colors.accentSoft, false: colors.line }} thumbColor={settings.assistantEnabled ? colors.accent : colors.textSecondary} />
      </View>

      <Text variant="label" color={colors.textSecondary} style={styles.sectionLabel}>Servidor</Text>
      <Text variant="caption" color={colors.textSecondary}>Dirección del servidor compatible con OpenAI (LM Studio: pestaña Developer, servidor activo con «Serve on Local Network», puerto 1234). El teléfono y la PC deben estar en la misma red.</Text>
      <TextInput value={url} onChangeText={setUrl} onBlur={persist} placeholder="http://192.168.0.140:1234" placeholderTextColor={colors.textSecondary} style={styles.input} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      <TextInput value={model} onChangeText={setModel} onBlur={persist} placeholder="Modelo (opcional, p. ej. qwen3-14b)" placeholderTextColor={colors.textSecondary} style={styles.input} autoCapitalize="none" autoCorrect={false} />
      <Button icon="cloud" disabled={busy} onPress={() => void test()}>{busy ? "Probando…" : "Probar conexión"}</Button>
      {probe ? (
        <View style={{ marginTop: space[3] }}>
          <StatusBanner tone={probe.ok ? "neutral" : "alert"} icon={probe.ok ? "check" : "alert"} detail={probe.ok ? undefined : "Revisá la dirección, que el servidor esté activo y que ambos estén en la misma red Wi-Fi."}>{probe.text}</StatusBanner>
        </View>
      ) : null}

      <Text variant="label" color={colors.textSecondary} style={styles.sectionLabel}>Qué hace y qué no</Text>
      <Text variant="body" color={colors.textSecondary}>Responde sobre tus sesiones, indicadores, calidad del registro y comparaciones, con los números que la app ya calculó. Las preguntas clínicas (diagnóstico, dolor, lesiones, tratamientos) se rechazan sin consultar al modelo. Cada respuesta se marca «Generado por IA · revisar» y queda registrada en el teléfono.</Text>
      <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[3] }}>Privacidad: con cada pregunta se envía al servidor un resumen de tus sesiones (fechas, duración, indicadores), nunca el correo ni los registros crudos. El servidor es el que vos configurás.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: size.rowHeight, paddingVertical: space[3], borderBottomWidth: size.hairline, borderBottomColor: colors.line },
  sectionLabel: { marginTop: space[6], marginBottom: space[2] },
  input: { height: size.controlHeight, borderRadius: radius.md, borderWidth: size.hairline, borderColor: colors.line, backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: space[4], fontFamily: fonts.regular, fontSize: 16, marginVertical: space[2] },
});
