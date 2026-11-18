import { db } from "~/db";
import {
  getInstructorAnalytics as computeAnalytics,
  type AnalyticsViewer,
  type Db,
} from "./lib/analytics.server";

export type {
  AnalyticsViewer,
  CourseCountryRevenue,
  CourseFunnel,
  CourseProgressSummary,
  FunnelLesson,
  InstructorAnalytics,
  QuizPassRate,
  RefundExposure,
  RevenueSeries,
} from "./lib/analytics.server";

/** Load the complete page; tests can supply an isolated database and clock. */
export function getInstructorAnalytics(
  viewer: AnalyticsViewer,
  params: URLSearchParams,
  now: Date,
  database: Db = db
) {
  return computeAnalytics(database, viewer, params, now);
}
