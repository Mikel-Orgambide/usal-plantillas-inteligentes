import { useCallback, useEffect, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import { SIMULATED_CONFIGURATION } from "@plantillas/contract";
import { SessionCoordinator, type SessionSnapshot } from "@plantillas/session";
import { SCENARIOS, SimulatedDataSource, type ScenarioName } from "@plantillas/simulator";
import type { SessionSummary } from "@plantillas/storage";
import { getDatabase } from "../infrastructure/sqlite/database";

/**
 * Caso de uso de la pantalla de verificación: arma un `SessionCoordinator`
 * con la fuente simulada y expone su instantánea y el historial.
 */

/** Intervalo de emisión de la pantalla de verificación, más lento que el del generador para poder observar las fallas. */
const VERIFICATION_INTERVAL_MS = 200;
/** Ventana en la que se aceptan registros después de pedir la detención. */
const LATE_DATA_WINDOW_MS = 300;

export function useSimulatedCapture(scenario: ScenarioName, seed: number) {
  const coordinatorRef = useRef<SessionCoordinator | null>(null);
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [dbInfo, setDbInfo] = useState<string>("abriendo base…");
  const [error, setError] = useState<string | undefined>();

  const refreshHistory = useCallback(async () => {
    const { repository } = await getDatabase();
    setHistory(await repository.listSessions());
  }, []);

  useEffect(() => {
    getDatabase()
      .then(async ({ migration, recoveredSessions }) => {
        const recovered = recoveredSessions.length ? ` · ${recoveredSessions.length} sesión(es) recuperada(s) como incompleta(s)` : "";
        setDbInfo(`SQLite v${migration.to}${migration.applied.length ? ` (migrado desde ${migration.from})` : ""}${recovered}`);
        await refreshHistory();
      })
      .catch((e: unknown) => setDbInfo(`error al abrir la base: ${e instanceof Error ? e.message : String(e)}`));
  }, [refreshHistory]);

  const running = snapshot !== null && (snapshot.state === "recording" || snapshot.state === "interrupted" || snapshot.state === "finalizing");

  const start = useCallback(async () => {
    if (coordinatorRef.current) return;
    setError(undefined);
    try {
      const { repository } = await getDatabase();
      const source = new SimulatedDataSource({ seed, scenario: SCENARIOS[scenario], emit_interval_ms: VERIFICATION_INTERVAL_MS });
      const coordinator = new SessionCoordinator({
        repository, source, configuration: SIMULATED_CONFIGURATION, userId: "local",
        activity: `simulación ${scenario}`, context: `semilla ${seed}`, sessionId: Crypto.randomUUID(),
        lateDataWindowMs: LATE_DATA_WINDOW_MS,
      });
      coordinatorRef.current = coordinator;
      coordinator.subscribe(setSnapshot);
      await coordinator.start();
      await refreshHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      coordinatorRef.current = null;
    }
  }, [scenario, seed, refreshHistory]);

  const stop = useCallback(async () => {
    const coordinator = coordinatorRef.current;
    if (!coordinator) return;
    try {
      const result = await coordinator.stop();
      if (result.reason) setError(result.reason);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      coordinatorRef.current = null;
      await refreshHistory().catch(() => undefined);
    }
  }, [refreshHistory]);

  useEffect(() => () => { void coordinatorRef.current?.stop(); }, []);

  return { running, snapshot, history, dbInfo, error, start, stop };
}
