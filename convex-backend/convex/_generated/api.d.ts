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
import type * as liveEstimates from "../liveEstimates.js";
import type * as liveIcebreakers from "../liveIcebreakers.js";
import type * as liveNotifications from "../liveNotifications.js";
import type * as liveReports from "../liveReports.js";
import type * as liveRetros from "../liveRetros.js";
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
  liveEstimates: typeof liveEstimates;
  liveIcebreakers: typeof liveIcebreakers;
  liveNotifications: typeof liveNotifications;
  liveReports: typeof liveReports;
  liveRetros: typeof liveRetros;
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
  retrosCompletedByTeam: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"retrosCompletedByTeam">;
  cardsByTeamUser: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"cardsByTeamUser">;
  votesByTeamUser: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"votesByTeamUser">;
  actionItemsByTeamStatus: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"actionItemsByTeamStatus">;
  estimateSessionsByTeam: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"estimateSessionsByTeam">;
  systemRetros: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"systemRetros">;
  systemUsers: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"systemUsers">;
};
