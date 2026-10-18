export {
  CHANNEL_CODES,
  CHANNEL_POSITIONS,
  RAW_UNIT,
  SIMULATED_CONFIGURATION,
  isChannelCode,
  validateConfiguration,
} from "./channels";
export type {
  AcquisitionConfiguration,
  ChannelCode,
  ChannelDefinition,
  ChannelPosition,
  DataSourceKind,
  Foot,
  RawUnit,
  RawValueRange,
  SensorModel,
  Zone,
} from "./channels";

export { FORMAT_VERSION, SUPPORTED_FORMAT_VERSIONS, recordKeyOf } from "./types";
export type { NormalizedRecord, RecordContext, RecordKey, Sample, SampleStatus, SourceRecord } from "./types";

export { validateSourceRecord } from "./validate";
export type { ValidationCode, ValidationIssue, ValidationResult, ValidationWarning, WarningCode } from "./validate";

export { normalizeRecord } from "./normalize";

export { classifySequence } from "./sequence";
export type { SequenceRelation } from "./sequence";
