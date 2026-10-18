# Fixtures del simulador

- `semilla-0001-normal-20.json`: primeras 20 salidas del generador con semilla 1, modo `normal`, período 20 000 µs y desfase 400 µs. Es el fixture dorado de `packages/simulator/test/golden.test.ts`: si cambia el algoritmo de señal, el test falla y el fixture debe regenerarse a propósito (`GOLDEN_WRITE=1 npm test -w @plantillas/simulator`) registrando el motivo.

Todos los valores son sintéticos y simulados. No representan lecturas de hardware.
