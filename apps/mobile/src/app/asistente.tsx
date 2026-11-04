import { useEffect, useRef, useState } from "react";
import { Animated, Keyboard, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { followUpSuggestions } from "@plantillas/assistant";
import { askAssistant, clearAssistantChat, retryLastQuestion, sessionChipLabel, useAssistantChat, type ChatMessage } from "../application/assistantStore";
import { loadSettings } from "../infrastructure/settings/settings";
import { Chip, Icon, Text } from "../presentation/components";
import { colors, fonts, radius, size, space } from "../presentation/theme/tokens";

/**
 * Chat del asistente explicativo (ADR 0012), a pantalla completa y como modal
 * por encima de la barra inferior. Cabecera con el contexto (la sesión desde
 * la que se abrió o «Todas tus sesiones») y el modo (nube o servidor propio);
 * mensajes con desplazamiento automático; preguntas sugeridas cuando está
 * vacío y preguntas de seguimiento (deterministas) después de cada respuesta;
 * indicador de escritura; errores con «Reintentar»; «Nueva conversación» en
 * la cabecera. La conversación vive en memoria y se vacía al cerrar.
 */
export default function AssistantScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const chat = useAssistantChat();
  const [text, setText] = useState("");
  const [contextLabel, setContextLabel] = useState(sessionId ? "Sesión seleccionada" : "Todas tus sesiones");
  const scroll = useRef<ScrollView>(null);
  const mode = loadSettings().assistantMode === "local" ? "Servidor propio" : "Nube";
  const options = sessionId ? { selectedSessionId: sessionId } : {};

  useEffect(() => {
    if (sessionId) void sessionChipLabel(sessionId).then((l) => { if (l) setContextLabel(l); }).catch(() => undefined);
  }, [sessionId]);
  useEffect(() => () => clearAssistantChat(), []);
  // Con el teclado abierto la barra de texto queda pegada a él (sin el margen de la barra de navegación).
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const send = (q: string) => {
    if (!q.trim() || chat.busy) return;
    setText("");
    void askAssistant(q, options);
  };
  const suggestions = sessionId
    ? ["¿Cómo se repartió la carga?", "¿Hubo problemas en el registro?", "¿Qué cambió respecto de la anterior?", "¿Qué significa el desvío?"]
    : ["¿Cómo vienen mis últimas sesiones?", "¿Qué cambió entre las dos últimas?", "¿Qué significa el reparto antepié / talón?", "¿Cómo puedo comparar mejor mis sesiones?"];
  const last = chat.messages[chat.messages.length - 1];
  const lastIsError = last?.error === true;
  // Seguimiento: sólo después de una respuesta del asistente que no sea un error.
  const lastQuestion = [...chat.messages].reverse().find((m) => m.role === "user");
  const asked = chat.messages.filter((m) => m.role === "user").map((m) => m.text);
  const followUps = !chat.busy && last && last.role === "assistant" && !last.error && lastQuestion ? followUpSuggestions(lastQuestion.text, last.text, asked) : [];

  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <View style={[styles.header, { paddingTop: insets.top + space[3] }]}>
        <View style={styles.titleRow}>
          <View style={styles.titleIcon}><Icon name="spark" size={20} color={colors.accent} /></View>
          <Text variant="heading" style={{ flex: 1 }}>Asistente</Text>
          {chat.messages.length > 0 ? (
            <Pressable onPress={() => { if (!chat.busy) { clearAssistantChat(); setText(""); } }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Nueva conversación" style={[styles.close, chat.busy && { opacity: 0.4 }]}>
              <Icon name="history" size={20} color={colors.textSecondary} />
            </Pressable>
          ) : null}
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cerrar" style={styles.close}>
            <Icon name="close" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.chips}>
          <Chip variant="selected">{contextLabel}</Chip>
          <Chip icon={mode === "Nube" ? "cloud" : "settings"}>{mode}</Chip>
        </View>
      </View>

      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={styles.log}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {chat.messages.length === 0 ? (
          <View style={styles.empty}>
            <Text variant="body" color={colors.textSecondary}>
              Preguntá sobre {sessionId ? "esta sesión" : "tus sesiones"}: qué muestran los indicadores, qué cambió entre sesiones o cómo se leen. No diagnostica ni recomienda tratamientos.
            </Text>
            <View style={styles.suggestions}>
              {suggestions.map((s) => (
                <Pressable key={s} onPress={() => send(s)} accessibilityRole="button" style={({ pressed }) => [styles.suggestion, pressed && { opacity: 0.7 }]}>
                  <Text variant="label" color={colors.textPrimary} style={{ flex: 1 }}>{s}</Text>
                  <Icon name="chevron-right" size={16} color={colors.textSecondary} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : chat.messages.map((m) => <Bubble key={m.id} m={m} />)}
        {chat.busy ? <Typing /> : null}
        {followUps.length > 0 ? (
          <View style={styles.followUps} accessibilityLabel="Preguntas de seguimiento">
            {followUps.map((s) => (
              <Pressable key={s} onPress={() => send(s)} accessibilityRole="button" style={({ pressed }) => [styles.followUp, pressed && { opacity: 0.7 }]}>
                <Text variant="label" color={colors.accent}>{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {lastIsError && !chat.busy ? (
          <Pressable onPress={() => void retryLastQuestion(options)} accessibilityRole="button" style={({ pressed }) => [styles.retry, pressed && { opacity: 0.7 }]}>
            <Text variant="label" color={colors.accent}>Reintentar</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={[styles.inputBar, { paddingBottom: (keyboard ? 0 : insets.bottom) + space[3] }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Preguntá sobre tus sesiones"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          multiline
          maxLength={1000}
          editable={!chat.busy}
        />
        <Pressable onPress={() => send(text)} disabled={chat.busy || !text.trim()} accessibilityRole="button" accessibilityLabel="Enviar" style={({ pressed }) => [styles.send, (chat.busy || !text.trim()) && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}>
          <Icon name="send" color={colors.onAccent} size={20} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  const mine = m.role === "user";
  return (
    <View style={[styles.row, mine && { justifyContent: "flex-end" }]}>
      <View style={{ maxWidth: "86%", gap: space[1] }}>
        <View style={[styles.bubble, mine ? styles.mine : m.error ? styles.errorBubble : styles.theirs]}>
          <Text variant="body" color={mine ? colors.onAccent : m.error ? colors.alert : colors.textPrimary}>{m.text}</Text>
        </View>
        {m.generated ? (
          <View style={styles.tag}>
            <Icon name="spark" size={12} color={colors.textSecondary} />
            <Text variant="caption" color={colors.textSecondary}>Generado por IA · revisar</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Tres puntos que laten mientras el asistente responde. */
function Typing() {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    const anims = dots.map((v, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 160),
      Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.3, duration: 320, useNativeDriver: true }),
      Animated.delay((2 - i) * 160),
    ])));
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [dots]);
  return (
    <View style={styles.row} accessibilityLabel="El asistente está escribiendo">
      <View style={[styles.bubble, styles.theirs, styles.typing]}>
        {dots.map((v, i) => <Animated.View key={i} style={[styles.dot, { opacity: v }]} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: space[4], paddingBottom: space[3], gap: space[3], borderBottomWidth: size.hairline, borderBottomColor: colors.line, backgroundColor: colors.bg },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space[3] },
  titleIcon: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  close: { width: 36, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  log: { paddingHorizontal: space[4], paddingVertical: space[4], gap: space[3] },
  empty: { gap: space[4] },
  suggestions: { gap: space[2] },
  suggestion: { flexDirection: "row", alignItems: "center", gap: space[2], minHeight: size.controlHeight, paddingHorizontal: space[4], borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: size.hairline, borderColor: colors.line },
  row: { flexDirection: "row" },
  bubble: { borderRadius: radius.md, paddingHorizontal: space[3], paddingVertical: space[2] + 2 },
  mine: { backgroundColor: colors.accent, borderBottomRightRadius: radius.sm },
  theirs: { backgroundColor: colors.surfaceElevated, borderBottomLeftRadius: radius.sm },
  errorBubble: { backgroundColor: colors.alertSoft, borderBottomLeftRadius: radius.sm },
  tag: { flexDirection: "row", alignItems: "center", gap: space[1], paddingLeft: space[1] },
  typing: { flexDirection: "row", gap: 6, paddingVertical: space[3] },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textSecondary },
  followUps: { flexDirection: "row", flexWrap: "wrap", gap: space[2], paddingTop: space[1] },
  followUp: { paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.pill, backgroundColor: colors.accentSoft, borderWidth: size.hairline, borderColor: colors.line },
  retry: { alignSelf: "flex-start", paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: space[2], paddingHorizontal: space[4], paddingTop: space[3], borderTopWidth: size.hairline, borderTopColor: colors.line, backgroundColor: colors.bg },
  input: { flex: 1, minHeight: size.controlHeight, maxHeight: 120, borderRadius: radius.md, borderWidth: size.hairline, borderColor: colors.line, backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: space[4], paddingTop: 13, paddingBottom: 13, fontFamily: fonts.regular, fontSize: 16 },
  send: { width: size.controlHeight, height: size.controlHeight, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
});
