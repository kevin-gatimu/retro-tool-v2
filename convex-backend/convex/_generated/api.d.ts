/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_limits from "../lib/limits.js";
import type * as liveEstimates from "../liveEstimates.js";
import type * as liveIcebreakers from "../liveIcebreakers.js";
import type * as liveNotifications from "../liveNotifications.js";
import type * as livePolls from "../livePolls.js";
import type * as liveRetros from "../liveRetros.js";
import type * as liveStandups from "../liveStandups.js";
import type * as liveSurveys from "../liveSurveys.js";
import type * as liveTeamMembers from "../liveTeamMembers.js";
import type * as rateLimits from "../rateLimits.js";
import type * as server from "../server.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  "lib/authz": typeof lib_authz;
  "lib/limits": typeof lib_limits;
  liveEstimates: typeof liveEstimates;
  liveIcebreakers: typeof liveIcebreakers;
  liveNotifications: typeof liveNotifications;
  livePolls: typeof livePolls;
  liveRetros: typeof liveRetros;
  liveStandups: typeof liveStandups;
  liveSurveys: typeof liveSurveys;
  liveTeamMembers: typeof liveTeamMembers;
  rateLimits: typeof rateLimits;
  server: typeof server;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
