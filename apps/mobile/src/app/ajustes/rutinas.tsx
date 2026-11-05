import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { describeTarget, ROUTINE_CATEGORY_LABEL } from "@plantillas/training";
import { Button, Card, Chip, Header, Icon, ListRow, Screen, Text, TextButton } from "../../presentation/components";
import { colors, space } from "../../presentation/theme/tokens";
import { archiveRoutine, duplicateRoutine, listRoutines, useTrainingVersion, type RoutineWithItems } from "../../application/trainingStore";

/**
 * Rutinas (ADR 0013): lista de rutinas propias o indicadas por un profesional,
 * con sus ejercicios objetivo. Se crean, editan, duplican y archivan acá; el
 * entrenamiento del día se inicia desde Hoy. La app no propone rutinas.
 */
export default function RoutinesScreen() {
  const router = useRouter();
  const version = useTrainingVersion();
  const [routines, setRoutines] = useState<RoutineWithItems[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const reload = useCallback(() => {
    listRoutines(showArchived).then(setRoutines).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [showArchived]);
  useFocusEffect(useCallback(() => { reload(); }, [reload, version]));

  return (
    <Screen footer={<Button variant="primary" icon="plus" onPress={() => router.push("/ajustes/rutina")}>Nueva rutina</Button>}>
      <Header title="Rutinas" context="Lo que indicó tu profesional o armaste vos" onBack={() => router.back()} />
      {error ? <Text variant="caption" color={colors.alert}>{error}</Text> : null}
      {routines === null ? (
        <Text variant="caption" color={colors.textSecondary}>Cargando…</Text>
      ) : routines.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="play" size={28} />
          <Text variant="heading">Todavía no hay rutinas</Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: "center" }}>
            Cargá los ejercicios que te indicaron (series, repeticiones, peso o tiempo) y después registrá lo que hacés en cada entrenamiento desde Hoy.
          </Text>
        </View>
      ) : (
        routines.map(({ routine, items }) => (
          <Card key={routine.id} style={{ marginBottom: space[3] }}>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text variant="heading" color={routine.archived ? colors.textSecondary : colors.textPrimary}>{routine.name}</Text>
                {routine.category || routine.goal ? <Text variant="caption" color={colors.textSecondary}>{[routine.category ? ROUTINE_CATEGORY_LABEL[routine.category] : null, routine.goal].filter(Boolean).join(" · ")}</Text> : null}
              </View>
              <Chip variant={routine.origin === "professional" ? "selected" : "neutral"} icon={routine.origin === "professional" ? "user" : undefined}>{routine.origin === "professional" ? "Profesional" : "Propia"}</Chip>
            </View>
            {items.map((i, idx) => (
              <ListRow key={i.id} title={i.name} subtitle={describeTarget(i)} chevron={false} last={idx === items.length - 1} />
            ))}
            <View style={styles.actions}>
              <TextButton onPress={() => router.push({ pathname: "/ajustes/rutina", params: { id: routine.id } })}>Editar</TextButton>
              <TextButton onPress={() => void duplicateRoutine(routine.id)}>Duplicar</TextButton>
              <TextButton onPress={() => void archiveRoutine(routine.id, !routine.archived)}>{routine.archived ? "Restaurar" : "Archivar"}</TextButton>
            </View>
          </Card>
        ))
      )}
      <TextButton icon="chevron-right" style={{ marginTop: space[2] }} onPress={() => setShowArchived((v) => !v)}>{showArchived ? "Ocultar archivadas" : "Ver archivadas"}</TextButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", gap: space[3], paddingVertical: space[8] },
  head: { flexDirection: "row", alignItems: "center", gap: space[3], marginBottom: space[2] },
  actions: { flexDirection: "row", gap: space[4], marginTop: space[3], flexWrap: "wrap" },
});
