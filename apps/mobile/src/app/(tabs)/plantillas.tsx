import { useEffect } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card, Header, ListRow, Screen, StatusBanner, Text, ValueCard } from "../../presentation/components";
import { colors, formatNumber, space } from "../../presentation/theme/tokens";
import { connect, connectLast, disconnect, scan, useDevice } from "../../infrastructure/ble/deviceStore";
import { loadSettings } from "../../infrastructure/settings/settings";
import { useActiveSession } from "../../application/sessionStore";

/** Plantillas: buscar, conectar y ver la configuración que publica la placa. */
export default function DeviceScreen() {
  const router = useRouter();
  const device = useDevice();
  const session = useActiveSession();
  const recording = !!session && !session.result && session.sourceKind === "physical";
  const last = loadSettings().lastDevice;
  const c = device.connected;

  // Al abrir la pestaña, reconectar con la última placa usada (sin buscar de nuevo).
  useEffect(() => { void connectLast(); }, []);

  const status = c ? (device.linkLost ? "searching" : "connected") : device.connecting || device.scanning ? "searching" : "off";
  const context = c
    ? `${device.linkLost ? "Reconectando" : "Conectadas"} · ${c.info.device_id}`
    : device.connecting ? "Conectando…" : device.scanning ? "Buscando…" : "Sin plantillas conectadas";

  const footer = c ? (
    <Button icon="bluetooth-off" disabled={recording} onPress={() => void disconnect()}>{recording ? "Hay una sesión grabando" : "Desconectar"}</Button>
  ) : (
    <Button variant="primary" icon="search" disabled={device.scanning || !!device.connecting} onPress={() => void scan()}>{device.scanning ? "Buscando…" : "Buscar plantillas"}</Button>
  );

  return (
    <Screen tabbed footer={footer}>
      <Header title="Plantillas" status={status} context={context} action="settings" actionLabel="Ajustes" onAction={() => router.push("/ajustes")} />

      {device.error ? (
        <View style={{ marginBottom: space[4] }}>
          <StatusBanner tone="alert" icon="alert" detail={device.error}>No se pudo completar</StatusBanner>
        </View>
      ) : null}
      {device.bluetooth === "off" ? (
        <View style={{ marginBottom: space[4] }}>
          <StatusBanner tone="alert" icon="bluetooth-off" detail="Activalo para buscar las plantillas.">Bluetooth apagado</StatusBanner>
        </View>
      ) : null}

      {c ? (
        <>
          {device.linkLost ? (
            <View style={{ marginBottom: space[4] }}>
              <StatusBanner tone="alert" icon="bluetooth-off" detail="Si hay una sesión grabando, intenta reconectar sola; lo que no llegue queda como hueco.">Conexión interrumpida</StatusBanner>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", gap: space[3] }}>
            <ValueCard label="Dispositivo" value={c.info.device_id} sub={c.name} style={{ flex: 1 }} />
            <ValueCard label="MTU" value={c.mtu} unit="bytes" sub="registro de 45 bytes" style={{ flex: 1 }} />
          </View>
          <View style={{ marginTop: space[4] }}>
            <Card title="Configuración publicada">
              <ListRow title={c.info.configuration_id} subtitle={`firmware ${c.info.firmware} · cuentas ADC 0–${formatNumber(c.info.raw_max)} · período ${formatNumber(c.info.period_us / 1000)} ms`} chevron={false} />
              {c.configuration.channels.map((ch) => (
                <ListRow key={ch.code} title={ch.code} subtitle={`${ch.installation_id} · ${ch.model === "synthetic" ? "sin sensor (lectura sintética)" : ch.model}`} chevron={false} />
              ))}
            </Card>
          </View>
          {c.configuration.channels.every((ch) => ch.model === "synthetic") ? (
            <Text variant="caption" color={colors.textSecondary} style={{ marginTop: space[3] }}>
              Esta placa todavía no tiene sensores: genera lecturas sintéticas para probar el transporte. Las sesiones se guardan como físicas con la configuración {c.info.configuration_id}, que lo deja identificado.
            </Text>
          ) : null}
        </>
      ) : (
        <>
          {device.found.length > 0 ? (
            <>
              <Text variant="label" color={colors.textSecondary} style={{ marginBottom: space[1] }}>Encontradas</Text>
              {device.found.map((d) => (
                <ListRow
                  key={d.id}
                  title={d.name}
                  subtitle={`${d.id} · señal ${d.rssi} dBm${device.connecting === d.id ? " · conectando…" : ""}`}
                  onPress={device.connecting ? undefined : () => void connect(d)}
                />
              ))}
            </>
          ) : device.scanning ? (
            <Text variant="body" color={colors.textSecondary}>Buscando plantillas cercanas con el servicio de la plataforma…</Text>
          ) : (
            <View style={{ gap: space[4] }}>
              {last ? <ListRow title={last.name} subtitle={`Última conectada · ${last.id}`} onPress={device.connecting ? undefined : () => void connect(last)} /> : null}
              <Card title="Para conectar">
                <View style={{ gap: space[2] }}>
                  {["Encendé la placa (USB o batería) y acercala al teléfono.", "Tocá Buscar plantillas y elegí la que aparezca.", "La app lee la configuración de la placa y reconoce las seis posiciones.", "Mientras estén conectadas, las sesiones nuevas usan las plantillas en lugar del simulador."].map((t, i) => (
                    <View key={i} style={{ flexDirection: "row", gap: space[3] }}>
                      <Text variant="body">{i + 1}</Text>
                      <Text variant="body" color={colors.textSecondary} style={{ flex: 1 }}>{t}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
