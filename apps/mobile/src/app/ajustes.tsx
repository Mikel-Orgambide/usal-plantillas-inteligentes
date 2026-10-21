import { useEffect, useState } from "react";
import { StyleSheet, Switch, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useDevice } from "../infrastructure/ble/deviceStore";
import { resolveSource } from "../application/activeSource";
import Constants from "expo-constants";
import { SCENARIOS, type ScenarioName } from "@plantillas/simulator";
import { Button, Chip, Header, ListRow, Screen, Sheet, Text } from "../presentation/components";
import { colors, fonts, formatDate, formatNumber, radius, size, space } from "../presentation/theme/tokens";
import { loadSettings, saveSettings, type Settings } from "../infrastructure/settings/settings";
import { importSessionBundle, restoreDatabaseCopy, shareDatabaseCopy } from "../infrastructure/backup/backup";
import { signIn, signOut, signUp, useAuth } from "../application/authStore";
import { refreshPending, syncAll, useSync } from "../application/syncStore";

const SCENARIO_NAMES = Object.keys(SCENARIOS) as ScenarioName[];

function Toggle({ label, detail, value, onChange, disabled }: { label: string; detail: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, gap: space[1] }}>
        <Text variant="body">{label}</Text>
        <Text variant="caption" color={colors.textSecondary}>{detail}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.accentSoft, false: colors.line }} thumbColor={value ? colors.accent : colors.textSecondary} />
    </View>
  );
}

/** Ajustes: dispositivo, datos, demostración (simulador y escenario) y acerca de. */
export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const update = (patch: Partial<Settings>) => setSettings(saveSettings(patch));
  const version = Constants.expoConfig?.version ?? "—";
  const device = useDevice();
  const source = resolveSource(device, settings);
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [busy, setBusy] = useState(false);
  const auth = useAuth();
  const sync = useSync();
  const [account, setAccount] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountError, setAccountError] = useState<string | undefined>();
  useEffect(() => { void refreshPending(); }, [auth.status]);

  const credentials = async (action: "in" | "up") => {
    setAccountError(undefined);
    if (!email.trim() || !password) { setAccountError("Completá correo y contraseña."); return; }
    setBusy(true);
    try {
      const notice = action === "in" ? (await signIn(email, password), null) : await signUp(email, password);
      setAccount(false);
      setPassword("");
      if (notice) setNotice({ title: "Crear cuenta", body: notice });
    } catch (e) {
      setAccountError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const accountSubtitle = auth.status === "unconfigured" ? "Este paquete no tiene configurado el servicio remoto"
    : auth.status === "loading" ? "Comprobando la sesión guardada…"
    : auth.status === "signed_out" ? "Sin cuenta: las sesiones quedan sólo en este teléfono"
    : auth.email ?? auth.remoteId ?? "";
  const syncSubtitle = sync.running
    ? (sync.progress ? `Enviando ${sync.progress.recordsSent} de ${sync.progress.recordsTotal} registros…` : "Sincronizando…")
    : `${sync.pendingCount === 0 ? "Nada pendiente" : `${sync.pendingCount} sesión(es) pendiente(s)`}${sync.lastRun ? ` · última: ${formatDate(sync.lastRun.at)} (${sync.lastRun.report.confirmed} confirmada(s), ${sync.lastRun.report.pending + sync.lastRun.report.failed} sin confirmar)` : ""}`;

  const run = async (label: string, fn: () => Promise<string | null>) => {
    setBusy(true);
    try {
      const result = await fn();
      if (result !== null) setNotice({ title: label, body: result });
    } catch (e) {
      setNotice({ title: `${label}: no se pudo`, body: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <Screen>
      <Header title="Ajustes" context={`Plantillas Inteligentes · versión ${version}`} onBack={() => router.back()} />

      <Text variant="label" color={colors.textSecondary}>Dispositivo</Text>
      <ListRow title="Fuente de las sesiones nuevas" subtitle={`${source.title} · ${source.detail}`} chevron={false} />
      <ListRow title="Plantillas" subtitle="Estado del dispositivo y búsqueda Bluetooth" onPress={() => router.navigate("/plantillas")} />

      <Text variant="label" color={colors.textSecondary} style={{ marginTop: space[6] }}>Cuenta</Text>
      {auth.status === "signed_out" ? (
        <View style={styles.accountCard}>
          <View style={{ flex: 1, gap: space[1] }}>
            <Text variant="body" color={colors.accent}>Iniciar sesión o crear cuenta</Text>
            <Text variant="caption" color={colors.textSecondary}>{accountSubtitle}</Text>
          </View>
          <Button variant="primary" icon="user" style={{ alignSelf: "center" }} onPress={() => { setAccountError(undefined); setAccount(true); }}>Entrar</Button>
        </View>
      ) : (
        <ListRow title="Cuenta" subtitle={accountSubtitle} chevron={false} chip={auth.status === "signed_in" ? <Chip variant="selected" icon="user">Conectada</Chip> : undefined} />
      )}
      {auth.status === "signed_in" ? (
        <>
          <ListRow title="Sincronizar ahora" subtitle={syncSubtitle} chevron={false} onPress={busy || sync.running ? undefined : () => void run("Sincronizar", async () => {
            const r = await syncAll();
            const total = r.confirmed + r.pending + r.failed;
            if (total === 0) return "No había sesiones pendientes.";
            const detail = Object.values(r.outcomes).filter((o) => o.status !== "confirmed").map((o) => o.status === "skipped" ? o.reason : o.error).slice(0, 3);
            return `${r.confirmed} de ${total} sesión(es) confirmada(s) por el servidor.${detail.length ? `\n${detail.join("\n")}` : ""}`;
          })} />
          <ListRow title="Cerrar sesión" subtitle="Las sesiones siguen en el teléfono; lo pendiente se sincroniza al volver a entrar con esta cuenta." chevron={false} onPress={busy ? undefined : () => void run("Cerrar sesión", async () => { await signOut(); return null; })} />
        </>
      ) : null}
      <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[2] }}>La copia local es la fuente primaria. Una sesión se marca sincronizada sólo cuando el servidor confirma las mismas cantidades de registros, eventos y resultados.</Text>

      <Text variant="label" color={colors.textSecondary} style={{ marginTop: space[6] }}>Datos</Text>
      <ListRow title="Unidad" subtitle="cuentas ADC (0–4095) · sin calibración" value="cuentas" chevron={false} />
      <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[2] }}>Cuando exista una calibración por sensor, acá se podrá elegir N o kg. Hasta entonces los valores se muestran solo en cuentas.</Text>

      <Text variant="label" color={colors.textSecondary} style={{ marginTop: space[6] }}>Respaldo</Text>
      <ListRow title="Importar una sesión" subtitle="Archivo .plantillas.json exportado desde el detalle de una sesión. No modifica sesiones existentes." onPress={busy ? undefined : () => void run("Importar sesión", async () => {
        const r = await importSessionBundle();
        if (!r) return null;
        return r.session === "exists" ? "La sesión ya estaba en este teléfono; no se modificó nada." : `Sesión restaurada: ${r.captures} captura(s), ${r.records_inserted} registros, ${r.events} eventos, ${r.results} resultados.`;
      })} />
      <ListRow title="Copia completa de la base" subtitle="Comparte un archivo .db con todas las sesiones, para guardarlo fuera del teléfono." onPress={busy ? undefined : () => void run("Copia completa", async () => {
        const r = await shareDatabaseCopy();
        return `Copia de ${formatNumber(Math.round(r.bytes / 1024))} KB · ${r.counts["sessions"]} sesiones · ${formatNumber(r.counts["records"] ?? 0)} registros.`;
      })} />
      <ListRow title="Restaurar una copia completa" subtitle="Reemplaza todo lo que hay en este teléfono por el archivo .db elegido." onPress={busy ? undefined : () => setConfirmRestore(true)} />

      <Text variant="label" color={colors.textSecondary} style={{ marginTop: space[6] }}>Demostración</Text>
      <Toggle label="Simulador sin plantillas" detail="Si no hay plantillas conectadas, las sesiones usan el simulador y se marcan «Simulada». Con plantillas conectadas se usan siempre las plantillas." value={settings.simulatorMode} onChange={(v) => update({ simulatorMode: v })} />
      <Toggle label="Pantalla encendida al grabar" detail="Evita que Android pause la captura." value={settings.keepAwake} onChange={(v) => update({ keepAwake: v })} />
      <View style={{ marginTop: space[4], gap: space[2] }}>
        <Text variant="body">Escenario del simulador</Text>
        <Text variant="caption" color={colors.textSecondary}>Para verificación: cada escenario introduce una falla conocida en los primeros registros.</Text>
        <View style={styles.chips}>
          {SCENARIO_NAMES.map((name) => (
            <Chip key={name} variant={settings.scenario === name ? "selected" : "neutral"} onPress={() => update({ scenario: name })}>{name}</Chip>
          ))}
        </View>
      </View>

      <Text variant="label" color={colors.textSecondary} style={{ marginTop: space[6] }}>Acerca de</Text>
      <ListRow title="Proyecto final de tesis" subtitle="Plantillas instrumentadas · ESP32 · datos locales en el teléfono" chevron={false} />
    </Screen>
    <Sheet visible={confirmRestore} onDismiss={() => setConfirmRestore(false)}>
      <Text variant="heading">Restaurar una copia completa</Text>
      <Text variant="body" color={colors.textSecondary}>
        Se reemplazan todas las sesiones de este teléfono por las del archivo. Antes de reemplazar se guarda la base actual en la caché de la app. La copia se comprueba aparte antes de tocar nada.
      </Text>
      <View style={{ gap: space[3], marginTop: space[3] }}>
        <Button variant="danger" icon="import" onPress={() => { setConfirmRestore(false); void run("Restaurar copia", async () => {
          const r = await restoreDatabaseCopy();
          return r ? `Base restaurada: ${r.counts["sessions"]} sesiones · ${formatNumber(r.counts["records"] ?? 0)} registros. La anterior quedó guardada en la caché.` : null;
        }); }}>Reemplazar todo</Button>
        <Button onPress={() => setConfirmRestore(false)}>Cancelar</Button>
      </View>
    </Sheet>
    <Sheet visible={account} onDismiss={() => setAccount(false)}>
      <Text variant="heading">Cuenta</Text>
      <Text variant="body" color={colors.textSecondary}>Con una cuenta, las sesiones cerradas se guardan también en el servicio remoto y sólo esa cuenta puede verlas.</Text>
      <TextInput value={email} onChangeText={setEmail} placeholder="Correo" placeholderTextColor={colors.textSecondary} style={styles.input} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <TextInput value={password} onChangeText={setPassword} placeholder="Contraseña (mínimo 6 caracteres)" placeholderTextColor={colors.textSecondary} style={styles.input} secureTextEntry autoCapitalize="none" autoComplete="password" textContentType="password" />
      {accountError ? <Text variant="caption" color={colors.alert}>{accountError}</Text> : null}
      <View style={{ gap: space[3], marginTop: space[3] }}>
        <Button variant="primary" icon="user" disabled={busy} onPress={() => void credentials("in")}>Iniciar sesión</Button>
        <Button disabled={busy} onPress={() => void credentials("up")}>Crear cuenta</Button>
        <Button disabled={busy} onPress={() => setAccount(false)}>Cancelar</Button>
      </View>
    </Sheet>
    <Sheet visible={!!notice} onDismiss={() => setNotice(null)}>
      <Text variant="heading">{notice?.title ?? ""}</Text>
      <Text variant="body" color={colors.textSecondary}>{notice?.body ?? ""}</Text>
      <View style={{ marginTop: space[3] }}><Button onPress={() => setNotice(null)}>Entendido</Button></View>
    </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: size.rowHeight, paddingVertical: space[3], borderBottomWidth: size.hairline, borderBottomColor: colors.line },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  accountCard: { flexDirection: "row", alignItems: "center", gap: space[3], padding: space[4], borderRadius: radius.md, backgroundColor: colors.accentSoft, borderWidth: size.hairline, borderColor: colors.accent },
  input: { height: size.controlHeight, borderRadius: radius.md, borderWidth: size.hairline, borderColor: colors.line, backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: space[4], fontFamily: fonts.regular, fontSize: 16 },
});
