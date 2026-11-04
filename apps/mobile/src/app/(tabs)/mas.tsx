import { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useDevice } from "../../infrastructure/ble/deviceStore";
import { resolveSource } from "../../application/activeSource";
import { Brand, Button, Chip, Icon, ListRow, Screen, Sheet, Text } from "../../presentation/components";
import { colors, fonts, formatDate, radius, size, space } from "../../presentation/theme/tokens";
import { loadSettings } from "../../infrastructure/settings/settings";
import { signIn, signOut, signUp, useAuth } from "../../application/authStore";
import { refreshPending, syncAll, useSync } from "../../application/syncStore";

/**
 * «Más»: cuenta y accesos a las demás pantallas (plantillas, respaldo,
 * demostración), con el mismo criterio que la sección More de los wearables:
 * un perfil arriba y listas agrupadas debajo.
 */
export default function MoreScreen() {
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? "—";
  const device = useDevice();
  const source = resolveSource(device, loadSettings());
  const auth = useAuth();
  const sync = useSync();
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountError, setAccountError] = useState<string | undefined>();
  useEffect(() => { void refreshPending(); }, [auth.status]);

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

  const credentials = async (action: "in" | "up") => {
    setAccountError(undefined);
    if (!email.trim() || !password) { setAccountError("Completá correo y contraseña."); return; }
    setBusy(true);
    try {
      const msg = action === "in" ? (await signIn(email, password), null) : await signUp(email, password);
      setAccount(false);
      setPassword("");
      if (msg) setNotice({ title: "Crear cuenta", body: msg });
    } catch (e) {
      setAccountError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const initial = (auth.email ?? "?").trim().charAt(0).toUpperCase();
  const syncSubtitle = sync.running
    ? (sync.progress ? `Enviando ${sync.progress.recordsSent} de ${sync.progress.recordsTotal} registros…` : "Sincronizando…")
    : sync.pendingCount === 0
      ? `Nada pendiente${sync.lastRun ? ` · última: ${formatDate(sync.lastRun.at)}` : ""}`
      : `${sync.pendingCount} sesión(es) pendiente(s)`;

  return (
    <>
    <Screen tabbed>
      <Text variant="title" style={{ marginBottom: space[4] }}>Ajustes</Text>

      {/* Perfil / cuenta. */}
      <View style={styles.profile}>
        <View style={[styles.avatar, auth.status === "signed_in" && { backgroundColor: colors.accent }]}>
          {auth.status === "signed_in" ? <Text variant="heading" color={colors.onAccent}>{initial}</Text> : <Icon name="user" color={colors.textSecondary} />}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyMedium" numberOfLines={1}>{auth.status === "signed_in" ? auth.email ?? "Cuenta" : auth.status === "unconfigured" ? "Sin servicio remoto" : auth.status === "loading" ? "Comprobando la cuenta…" : "Sin cuenta"}</Text>
          <Text variant="caption" color={colors.textSecondary} numberOfLines={2}>
            {auth.status === "signed_in" ? syncSubtitle : auth.status === "unconfigured" ? "Este paquete no tiene configurado el servicio remoto" : "Las sesiones quedan sólo en este teléfono"}
          </Text>
        </View>
        {auth.status === "signed_out" ? (
          <Button variant="primary" style={{ alignSelf: "center" }} onPress={() => { setAccountError(undefined); setAccount(true); }}>Entrar</Button>
        ) : auth.status === "signed_in" ? (
          <Chip variant="selected" icon="cloud">Conectada</Chip>
        ) : null}
      </View>
      {auth.status === "signed_in" ? (
        <View style={styles.group}>
          <ListRow title="Sincronizar ahora" subtitle="Sube las sesiones cerradas que todavía no confirmó el servidor" onPress={busy || sync.running ? undefined : () => void run("Sincronizar", async () => {
            const r = await syncAll();
            const total = r.confirmed + r.pending + r.failed;
            if (total === 0) return "No había sesiones pendientes.";
            const detail = Object.values(r.outcomes).filter((o) => o.status !== "confirmed").map((o) => o.status === "skipped" ? o.reason : o.error).slice(0, 3);
            return `${r.confirmed} de ${total} sesión(es) confirmada(s) por el servidor.${detail.length ? `\n${detail.join("\n")}` : ""}`;
          })} />
          <ListRow title="Cerrar sesión" subtitle="El Historial vuelve a mostrar las sesiones sin cuenta de este teléfono" chevron={false} onPress={busy ? undefined : () => void run("Cerrar sesión", async () => { await signOut(); return null; })} />
        </View>
      ) : null}

      <Text variant="label" color={colors.textSecondary} style={styles.sectionLabel}>Dispositivo</Text>
      <View style={styles.group}>
        <ListRow title="Plantillas" subtitle={`${source.title} · ${source.detail}`} chip={device.connected ? <Chip variant="selected" icon="bluetooth">{device.modules.length === 2 ? "Ambos pies" : "Conectadas"}</Chip> : undefined} onPress={() => router.push("/plantillas")} />
      </View>

      <Text variant="label" color={colors.textSecondary} style={styles.sectionLabel}>Datos</Text>
      <View style={styles.group}>
        <ListRow title="Respaldo" subtitle="Exportar e importar sesiones · copia completa de la base" onPress={() => router.push("/ajustes/respaldo")} />
        <ListRow title="Unidad" subtitle="cuentas ADC (0–4095) · sin calibración" value="cuentas" chevron={false} />
      </View>

      <Text variant="label" color={colors.textSecondary} style={styles.sectionLabel}>Aplicación</Text>
      <View style={styles.group}>
        <ListRow title="Demostración" subtitle="Simulador, escenarios de falla y pantalla encendida" onPress={() => router.push("/ajustes/demostracion")} />
      </View>

      <Text variant="label" color={colors.textSecondary} style={styles.sectionLabel}>Acerca de</Text>
      <View style={[styles.group, styles.about]}>
        <Brand size={40} />
        <Text variant="bodyMedium">NSL · Plantillas inteligentes</Text>
        <Text variant="caption" color={colors.textSecondary}>Versión {version}</Text>
        <Text variant="caption" color={colors.textSecondary}>Proyecto Final · Ingeniería en Informática · USAL</Text>
      </View>
      <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[3] }}>La copia local es la fuente primaria. Una sesión se marca sincronizada sólo cuando el servidor confirma las mismas cantidades de registros, eventos y resultados.</Text>
    </Screen>

    <Sheet visible={account} onDismiss={() => setAccount(false)}>
      <Brand size={32} />
      <Text variant="body" color={colors.textSecondary}>Con una cuenta, el Historial muestra sólo sus sesiones y las cerradas se guardan también en el servicio remoto, donde sólo esa cuenta puede verlas. Las sesiones de otras cuentas quedan guardadas en el teléfono.</Text>
      <TextInput value={email} onChangeText={setEmail} placeholder="Correo" placeholderTextColor={colors.textSecondary} style={styles.input} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <TextInput value={password} onChangeText={setPassword} placeholder="Contraseña (mínimo 6 caracteres)" placeholderTextColor={colors.textSecondary} style={styles.input} secureTextEntry autoCapitalize="none" autoComplete="password" textContentType="password" />
      {accountError ? <Text variant="caption" color={colors.alert}>{accountError}</Text> : null}
      <View style={{ gap: space[3], marginTop: space[3] }}>
        <Button variant="primary" icon="user" disabled={busy} onPress={() => void credentials("in")}>Iniciar sesión</Button>
        <Button disabled={busy} onPress={() => void credentials("up")}>Crear cuenta</Button>
        <Button disabled={busy} onPress={() => setAccount(false)}>Cancelar</Button>
      </View>
    </Sheet>
    <Sheet visible={!!notice} onDismiss={() => setNotice(null)} floating title={notice?.title ?? ""}>
      <Text variant="body" color={colors.textSecondary}>{notice?.body ?? ""}</Text>
    </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: space[3], padding: space[4], borderRadius: radius.md, backgroundColor: colors.surface },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  group: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: space[4], marginTop: space[3] },
  sectionLabel: { marginTop: space[6] },
  about: { paddingVertical: space[4], gap: space[2] },
  input: { height: size.controlHeight, borderRadius: radius.md, borderWidth: size.hairline, borderColor: colors.line, backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: space[4], fontFamily: fonts.regular, fontSize: 16 },
});
