// Browser-safe entry point: server-only queries live behind ./index.server.
export {
  ANALYTICS_RANGES,
  DEFAULT_ANALYTICS_RANGE,
  PLATFORM_FEE_PERCENT,
  PLATFORM_FEE_RATE,
  formatBucket,
  formatMoney,
  parseAnalyticsRange,
  rangeStart,
  splitRevenue,
  type AnalyticsRange,
} from "./lib/analytics";
