export {
  CHANNEL_CODES,
  CHANNEL_POSITIONS,
  RAW_UNIT,
  LEFT_MODULE_CONFIGURATION,
  SIMULATED_CONFIGURATION,
  configuredChannels,
  footAvailability,
  isChannelCode,
  validateConfiguration,
} from "./channels";
export type {
  AcquisitionConfiguration,
  FootAvailability,
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

export type { DataSource, SourceEvent, SourceListener } from "./datasource";
