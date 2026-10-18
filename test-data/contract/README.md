# Fixtures del contrato v1.0

Registros ilustrativos, todos de procedencia **simulada**. Los valores no expresan frecuencia, desfase ni lecturas medidas en hardware.

| Archivo | Caso | Uso |
|---|---|---|
| `registro_valido.json` | C01 | Seis canales correctos, `sequence` 0 |
| `registro_con_cero.json` | C02 | `raw_value` 0 con estado `ok` |
| `registro_con_read_error.json` | C03 | Una muestra `read_error` con `raw_value` null |
| `registro_valor_limite.json` | — | Valor en el máximo del rango (advertencia, no error) |
