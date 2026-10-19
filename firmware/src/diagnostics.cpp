#include "diagnostics.h"
namespace diag {
static Counters c;
Counters& counters() { return c; }
void reset_capture_counters() { c = Counters{}; }
}
