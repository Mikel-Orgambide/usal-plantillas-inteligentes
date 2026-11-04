import { useState } from "react";
import { StyleSheet, Switch, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Chip, Header, Screen, StatusBanner, Text } from "../../presentation/components";
import { colors, fonts, radius, size, space } from "../../presentation/theme/tokens";
import { loadSettings, saveSettings, type Settings } from "../../infrastructure/settings/settings";
import { describeAssistantError, testAssistant } from "../../application/assistantStore";
import { useAuth } from "../../application/authStore";

/**
 * Ajustes del asistente explicativo (ADR 0012). Dos modos: «Nube» (función
 * gestionada del proyecto; usa la cuenta iniciada y no pide nada más: la
 * clave del proveedor vive en el backend) y «Servidor propio» (LM Studio u
 * otro servidor compatible con OpenAI en la red local). Prueba de conexión
 * en ambos y el interruptor del botón flotante.
 */
export default function AssistantSettingsScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [url, setUrl] = useState(settings.assistantUrl);
  const [model, setModel] = useState(settings.assistantModel);
  const [probe, setProbe] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const update = (patch: Partial<Settings>) => { setSettings(saveSettings(patch)); setProbe(null); };
  const persist = () => update({ assistantUrl: url.trim(), assistantModel: model.trim() });
  const local = settings.assistantMode === "local";

  const test = async () => {
    persist();
    const current = loadSettings();
    setBusy(true);
    setProbe(null);
    try {
      const models = await testAssistant(current);
      setProbe({ ok: true, text: `${local ? "Servidor en línea" : "Servicio en línea"} · modelo: ${models.join(", ")}` });
    } catch (e) {
      setProbe({ ok: false, text: describeAssistantError(e, current) });
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

      <Text variant="label" color={colors.textSecondary} style={styles.sectionLabel}>Modo</Text>
      <View style={styles.chips}>
        <Chip variant={local ? "neutral" : "selected"} icon="cloud" onPress={() => update({ assistantMode: "cloud" })}>Nube · recomendado</Chip>
        <Chip variant={local ? "selected" : "neutral"} icon="settings" onPress={() => update({ assistantMode: "local" })}>Servidor propio</Chip>
      </View>
      {local ? (
        <>
          <Text variant="caption" color={colors.textSecondary}>Servidor compatible con OpenAI en tu red (LM Studio: Model Server activo con «Serve on Local Network», puerto 1234). El teléfono y la PC deben estar en la misma red.</Text>
          <TextInput value={url} onChangeText={setUrl} onBlur={persist} placeholder="http://192.168.0.140:1234" placeholderTextColor={colors.textSecondary} style={styles.input} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <TextInput value={model} onChangeText={setModel} onBlur={persist} placeholder="Modelo (opcional, p. ej. qwen3-14b)" placeholderTextColor={colors.textSecondary} style={styles.input} autoCapitalize="none" autoCorrect={false} />
        </>
      ) : (
        <Text variant="caption" color={colors.textSecondary}>
          {auth.status === "signed_in"
            ? "Usa tu cuenta; no hay nada que configurar. Las preguntas pasan por el servicio del proyecto, que guarda la clave del proveedor de modelos."
            : "Requiere iniciar sesión con tu cuenta (Ajustes → Cuenta). Las preguntas pasan por el servicio del proyecto, que guarda la clave del proveedor de modelos."}
        </Text>
      )}
      <View style={{ marginTop: space[3] }}>
        <Button icon="cloud" disabled={busy} onPress={() => void test()}>{busy ? "Probando…" : "Probar conexión"}</Button>
      </View>
      {probe ? (
        <View style={{ marginTop: space[3] }}>
          <StatusBanner tone={probe.ok ? "neutral" : "alert"} icon={probe.ok ? "check" : "alert"}>{probe.text}</StatusBanner>
        </View>
      ) : null}

      <Text variant="label" color={colors.textSecondary} style={styles.sectionLabel}>Qué hace y qué no</Text>
      <Text variant="body" color={colors.textSecondary}>Responde sobre tus sesiones, indicadores, calidad del registro y comparaciones, con los números que la app ya calculó. Las preguntas clínicas (diagnóstico, dolor, lesiones, tratamientos) se rechazan sin consultar al modelo. Cada respuesta se marca «Generado por IA · revisar» y queda registrada en el teléfono.</Text>
      <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[3] }}>
        {local
          ? "Privacidad: con cada pregunta se envía al servidor que configurás un resumen de tus sesiones (fechas, duración, indicadores), nunca el correo ni los registros crudos."
          : "Privacidad: con cada pregunta se envía al servicio del proyecto, y de ahí al proveedor de modelos, un resumen de tus sesiones (fechas, duración, indicadores), nunca el correo ni los registros crudos. El servicio registra sólo fecha, cuenta, modelo y tamaños."}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: size.rowHeight, paddingVertical: space[3], borderBottomWidth: size.hairline, borderBottomColor: colors.line },
  sectionLabel: { marginTop: space[6], marginBottom: space[2] },
  chips: { flexDirection: "row", gap: space[2], marginBottom: space[3] },
  input: { height: size.controlHeight, borderRadius: radius.md, borderWidth: size.hairline, borderColor: colors.line, backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: space[4], fontFamily: fonts.regular, fontSize: 16, marginVertical: space[2] },
});
