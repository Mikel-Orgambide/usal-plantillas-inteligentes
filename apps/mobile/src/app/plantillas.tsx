import { useEffect } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card, Chip, Header, ListRow, Screen, StatusBanner, Text, ValueCard } from "../presentation/components";
import { colors, formatNumber, space } from "../presentation/theme/tokens";
import { connect, connectLast, disconnect, scan, useDevice, type ConnectedDevice } from "../infrastructure/ble/deviceStore";
import { loadSettings } from "../infrastructure/settings/settings";
import { useActiveSession } from "../application/sessionStore";

const FOOT_LABEL: Record<string, string> = { left: "Pie izquierdo", right: "Pie derecho", both: "Ambos pies" };

/** Fila de un pie: el módulo conectado para ese pie, o el hueco para conectar uno. */
function FootRow({ foot, module, lost, busy }: { foot: "left" | "right"; module: ConnectedDevice | undefined; lost: boolean; busy: boolean }) {
  if (!module) {
    return <ListRow title={FOOT_LABEL[foot]!} subtitle="Sin módulo · buscá y elegí la placa de este pie" chevron={false} chip={<Chip variant="neutral">n/d</Chip>} />;
  }
  return (
    <ListRow
      title={`${FOOT_LABEL[foot]} · ${module.info.device_id}`}
      subtitle={`${module.info.configuration_id} · firmware ${module.info.firmware} · ${module.configuration.channels.length} posiciones`}
      chevron={false}
      chip={<Chip variant={lost ? "neutral" : "selected"} icon={lost ? "bluetooth-off" : "bluetooth"}>{lost ? "Reconectando" : "Conectado"}</Chip>}
      onPress={busy ? undefined : () => void disconnect(module.id)}
    />
  );
}

/** Plantillas: buscar, conectar hasta dos módulos (uno por pie) y ver la configuración que publica cada placa. */
export default function DeviceScreen() {
  const router = useRouter();
  const device = useDevice();
  const session = useActiveSession();
  const recording = !!session && !session.result && session.sourceKind === "physical";
  const settings = loadSettings();
  const remembered = settings.lastDevices ?? (settings.lastDevice ? [settings.lastDevice] : []);
  const c = device.connected;
  const modules = device.modules;
  const byFoot = (f: "left" | "right") => modules.find((m) => m.foot === f || m.foot === null);
  const canAddMore = modules.length === 1 && modules[0]!.foot !== null;

  // Al abrir la pantalla, reconectar con las últimas placas usadas (sin buscar de nuevo).
  useEffect(() => { void connectLast(); }, []);

  const status = c ? (device.linkLost ? "searching" : "connected") : device.connecting || device.scanning ? "searching" : "off";
  const context = c
    ? `${device.linkLost ? "Reconectando" : "Conectadas"} · ${modules.map((m) => m.info.device_id).join(" + ")}${modules.length === 2 ? " · ambos pies" : c.foot ? ` · sólo ${c.foot === "left" ? "izquierdo" : "derecho"}` : ""}`
    : device.connecting ? "Conectando…" : device.scanning ? "Buscando…" : "Sin plantillas conectadas";

  const footer = c ? (
    <View style={{ gap: space[3] }}>
      {canAddMore ? (
        <Button variant="primary" icon="search" disabled={device.scanning || !!device.connecting || recording} onPress={() => void scan()}>{device.scanning ? "Buscando…" : `Buscar el módulo del pie ${c.foot === "left" ? "derecho" : "izquierdo"}`}</Button>
      ) : null}
      <Button icon="bluetooth-off" disabled={recording} onPress={() => void disconnect()}>{recording ? "Hay una sesión grabando" : modules.length === 2 ? "Desconectar ambos" : "Desconectar"}</Button>
    </View>
  ) : (
    <Button variant="primary" icon="search" disabled={device.scanning || !!device.connecting} onPress={() => void scan()}>{device.scanning ? "Buscando…" : "Buscar plantillas"}</Button>
  );

  return (
    <Screen footer={footer}>
      <Header title="Plantillas" status={status} context={context} onBack={() => router.back()} />

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
          <Card title="Módulos">
            {c.foot === null ? (
              <FootRow foot="left" module={c} lost={c.linkLost} busy={recording} />
            ) : (
              <>
                <FootRow foot="left" module={byFoot("left")} lost={byFoot("left")?.linkLost ?? false} busy={recording} />
                <FootRow foot="right" module={byFoot("right")} lost={byFoot("right")?.linkLost ?? false} busy={recording} />
              </>
            )}
          </Card>
          {canAddMore && device.found.filter((d) => !modules.some((m) => m.id === d.id)).length > 0 ? (
            <View style={{ marginTop: space[4] }}>
              <Text variant="label" color={colors.textSecondary} style={{ marginBottom: space[1] }}>Encontradas</Text>
              {device.found.filter((d) => !modules.some((m) => m.id === d.id)).map((d) => (
                <ListRow key={d.id} title={d.name} subtitle={`${d.id} · señal ${d.rssi} dBm${device.connecting === d.id ? " · conectando…" : ""}`} onPress={device.connecting ? undefined : () => void connect(d)} />
              ))}
            </View>
          ) : null}
          <View style={{ flexDirection: "row", gap: space[3], marginTop: space[4] }}>
            <ValueCard label="Dispositivo" value={c.info.device_id} sub={c.name} style={{ flex: 1 }} />
            <ValueCard label="MTU" value={c.mtu} unit="bytes" sub={`registro de ${9 + 6 * c.configuration.channels.length} bytes`} style={{ flex: 1 }} />
          </View>
          {modules.map((m) => (
            <View key={m.id} style={{ marginTop: space[4] }}>
              <Card title={modules.length > 1 ? `Configuración · ${m.foot === "left" ? "izquierdo" : m.foot === "right" ? "derecho" : "ambos"}` : "Configuración publicada"}>
                <ListRow title={m.info.configuration_id} subtitle={`firmware ${m.info.firmware} · cuentas ADC 0–${formatNumber(m.info.raw_max)} · período ${formatNumber(m.info.period_us / 1000)} ms`} chevron={false} />
                {m.configuration.channels.map((ch) => (
                  <ListRow key={ch.code} title={ch.code} subtitle={`${ch.installation_id} · ${ch.model === "synthetic" ? "sin sensor (lectura sintética)" : ch.model}`} chevron={false} />
                ))}
              </Card>
            </View>
          ))}
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
              {remembered.map((last) => <ListRow key={last.id} title={last.name} subtitle={`Última conectada · ${last.id}`} onPress={device.connecting ? undefined : () => void connect(last)} />)}
              <Card title="Para conectar">
                <View style={{ gap: space[2] }}>
                  {["Encendé la placa (USB o batería) y acercala al teléfono.", "Tocá Buscar plantillas y elegí la que aparezca.", "La app lee la configuración de la placa y reconoce qué pie instrumenta (tres posiciones).", "Para medir ambos pies, buscá y conectá después la placa del otro pie: la sesión usa los dos módulos.", "Mientras estén conectadas, las sesiones nuevas usan las plantillas en lugar del simulador."].map((t, i) => (
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
