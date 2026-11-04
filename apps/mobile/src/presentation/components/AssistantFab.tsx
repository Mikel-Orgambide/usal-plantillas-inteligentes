import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { askAssistant, clearAssistantChat, useAssistantChat, useAssistantEnabled, type ChatMessage } from "../../application/assistantStore";
import { colors, fonts, radius, size, space } from "../theme/tokens";
import { Chip } from "./Chip";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { Text } from "./Text";

/**
 * Botón flotante del asistente explicativo (ADR 0012) y su hoja de chat.
 * Se renderiza como hermano de `Screen` (fuera del ScrollView) y sólo cuando
 * el asistente está activado en Ajustes. La conversación vive en memoria y
 * se vacía al cerrar. Cada respuesta del modelo lleva el chip
 * «Generado por IA · revisar»; las respuestas fijas (fuera de alcance) no.
 */
export function AssistantFab({ sessionId, bottomOffset = 0 }: { /** Sesión que el usuario está mirando; su detalle entra en el contexto. */ sessionId?: string; /** Aire extra sobre la barra inferior o el pie de la pantalla. */ bottomOffset?: number }) {
  const enabled = useAssistantEnabled();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  if (!enabled) return null;
  return (
    <>
      {!open ? (
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Abrir el asistente" style={({ pressed }) => [styles.fab, { bottom: insets.bottom + bottomOffset + space[4] }, pressed && { opacity: 0.8 }]}>
          <Icon name="spark" color={colors.onAccent} />
        </Pressable>
      ) : null}
      <AssistantSheet visible={open} sessionId={sessionId} onDismiss={() => { setOpen(false); clearAssistantChat(); }} />
    </>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  const mine = m.role === "user";
  return (
    <View style={[styles.bubbleRow, mine && { justifyContent: "flex-end" }]}>
      <View style={[styles.bubble, mine ? styles.mine : m.error ? styles.errorBubble : styles.theirs]}>
        <Text variant="body" color={mine ? colors.onAccent : m.error ? colors.alert : colors.textPrimary}>{m.text}</Text>
        {m.generated ? (
          <View style={styles.tag}><Chip variant="selected" icon="spark">Generado por IA · revisar</Chip></View>
        ) : null}
      </View>
    </View>
  );
}

const SUGGESTIONS = ["¿Qué pasó en mi última sesión?", "¿Qué significa el reparto antepié / talón?", "¿Por qué el pie derecho dice n/d?"];

export function AssistantSheet({ visible, sessionId, onDismiss }: { visible: boolean; sessionId?: string; onDismiss: () => void }) {
  const chat = useAssistantChat();
  const [text, setText] = useState("");
  const scroll = useRef<ScrollView>(null);
  useEffect(() => { scroll.current?.scrollToEnd({ animated: true }); }, [chat.messages.length, chat.busy]);
  const send = (q: string) => {
    if (!q.trim() || chat.busy) return;
    setText("");
    void askAssistant(q, sessionId ? { selectedSessionId: sessionId } : {});
  };
  return (
    <Sheet visible={visible} onDismiss={onDismiss} floating title="Asistente">
      <Text variant="caption" color={colors.textSecondary}>Explica lo que la app ya calculó{sessionId ? ", incluida la sesión que estás viendo" : ""}. No diagnostica ni recomienda: esa lectura corresponde a un profesional. Las respuestas se generan con un modelo en tu servidor y pueden tener errores.</Text>
      <View style={styles.log}>
        {chat.messages.length === 0 ? (
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s) => <Chip key={s} variant="neutral" onPress={() => send(s)}>{s}</Chip>)}
          </View>
        ) : chat.messages.map((m) => <Bubble key={m.id} m={m} />)}
        {chat.busy ? (
          <View style={styles.bubbleRow}><View style={[styles.bubble, styles.theirs, styles.thinking]}><ActivityIndicator color={colors.accent} /><Text variant="caption" color={colors.textSecondary}>Consultando…</Text></View></View>
        ) : null}
      </View>
      <View style={styles.inputRow}>
        <TextInput value={text} onChangeText={setText} placeholder="Preguntá sobre tus sesiones" placeholderTextColor={colors.textSecondary} style={styles.input} multiline={false} returnKeyType="send" onSubmitEditing={() => send(text)} editable={!chat.busy} />
        <Pressable onPress={() => send(text)} disabled={chat.busy || !text.trim()} accessibilityRole="button" accessibilityLabel="Enviar" style={({ pressed }) => [styles.send, (chat.busy || !text.trim()) && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}>
          <Icon name="send" color={colors.onAccent} size={20} />
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fab: { position: "absolute", right: space[4], width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", elevation: 4 },
  log: { gap: space[2], minHeight: 120 },
  suggestions: { gap: space[2], flexDirection: "row", flexWrap: "wrap" },
  bubbleRow: { flexDirection: "row" },
  bubble: { maxWidth: "88%", borderRadius: radius.md, paddingHorizontal: space[3], paddingVertical: space[2], gap: space[2] },
  mine: { backgroundColor: colors.accent, borderBottomRightRadius: radius.sm },
  theirs: { backgroundColor: colors.surface, borderBottomLeftRadius: radius.sm },
  errorBubble: { backgroundColor: colors.alertSoft, borderBottomLeftRadius: radius.sm },
  thinking: { flexDirection: "row", alignItems: "center", gap: space[2] },
  tag: { flexDirection: "row" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: space[2], marginTop: space[2] },
  input: { flex: 1, height: size.controlHeight, borderRadius: radius.md, borderWidth: size.hairline, borderColor: colors.line, backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: space[4], fontFamily: fonts.regular, fontSize: 16 },
  send: { width: size.controlHeight, height: size.controlHeight, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
});
