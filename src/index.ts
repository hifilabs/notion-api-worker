import {} from "@cloudflare/workers-types";
import { Router, Method } from "tiny-request-router";

import { pageRoute } from "./routes/page";
import { tableRoute } from "./routes/table";
import { userRoute } from "./routes/user";
import { searchRoute } from "./routes/search";
import { createResponse } from "./response";
import { getCacheKey } from "./get-cache-key";
import * as types from "./api/types";
import { parsePageId } from "./api/utils";
import { isPageInSpace } from "./api/notion";

// Declare global variables for Cloudflare Workers Environment
declare global {
  const SEARCH_ENABLED: boolean | undefined;
  const USER_ENABLED: boolean | undefined;
  const PAGE_ENABLED: boolean | undefined;
  const TABLE_ENABLED: boolean | undefined;
  // NOTION_TOKEN is already declared by Cloudflare Workers
  const ALLOWED_SPACE_ID: string | undefined;
  const ALLOWED_SPACE_IDS: string | undefined;
}

export type Handler = (
  req: types.HandlerRequest
) => Promise<Response> | Response;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
};

const router = new Router<Handler>();

router.options("*", () => new Response(null, { headers: corsHeaders }));

// Register routes based on environment variables
// Check if page route is enabled (default to true if not specified)
const ENABLE_PAGE = typeof PAGE_ENABLED !== "undefined" ? PAGE_ENABLED : true;
if (ENABLE_PAGE) {
  router.get("/v1/page/:pageId", pageRoute);
}

// Check if table route is enabled (default to true if not specified)
const ENABLE_TABLE =
  typeof TABLE_ENABLED !== "undefined" ? TABLE_ENABLED : true;
if (ENABLE_TABLE) {
  router.get("/v1/table/:pageId", tableRoute);
}

// Check if search is enabled (default to true if not specified)
const ENABLE_SEARCH =
  typeof SEARCH_ENABLED !== "undefined" ? SEARCH_ENABLED : true;
if (ENABLE_SEARCH) {
  router.get("/v1/search", searchRoute);
}

// Check if user route is enabled (default to true if not specified)
const ENABLE_USER = typeof USER_ENABLED !== "undefined" ? USER_ENABLED : true;
if (ENABLE_USER) {
  router.get("/v1/user/:userId", userRoute);
}

// Get available routes for the 404 response
const getAvailableRoutes = () => {
  const routes = [];
  if (ENABLE_PAGE) routes.push("/v1/page/:pageId");
  if (ENABLE_TABLE) routes.push("/v1/table/:pageId");
  if (ENABLE_SEARCH) routes.push("/v1/search");
  if (ENABLE_USER) routes.push("/v1/user/:userId");
  return routes;
};

router.get("*", async () =>
  createResponse(
    {
      error: `Route not found!`,
      routes: getAvailableRoutes(),
    },
    {},
    404
  )
);

const cache = (caches as any).default;
// NOTION_TOKEN is already defined in global scope by Cloudflare Workers
const NOTION_API_TOKEN =
  typeof NOTION_TOKEN !== "undefined" ? NOTION_TOKEN : undefined;

// Get allowed space IDs from environment variable
const ALLOWED_SPACE_IDS_LIST: string[] = (() => {
  // If ALLOWED_SPACE_ID is defined as a single string, use it
  if (typeof ALLOWED_SPACE_ID !== "undefined" && ALLOWED_SPACE_ID) {
    return [ALLOWED_SPACE_ID];
  }
  // If ALLOWED_SPACE_IDS is defined as a comma-separated list, parse it
  if (typeof ALLOWED_SPACE_IDS !== "undefined" && ALLOWED_SPACE_IDS) {
    return ALLOWED_SPACE_IDS.split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  }
  // Default to empty array if no env vars are set
  return [];
})();

const handleRequest = async (fetchEvent: FetchEvent): Promise<Response> => {
  const request = fetchEvent.request;
  const { pathname, searchParams } = new URL(request.url);
  const notionToken =
    NOTION_API_TOKEN ||
    (request.headers.get("Authorization") || "").split("Bearer ")[1] ||
    undefined;

  const match = router.match(request.method as Method, pathname);

  if (!match) {
    return new Response("Endpoint not found.", { status: 404 });
  }

  // Check if access control is enabled
  if (ALLOWED_SPACE_IDS_LIST.length > 0) {
    // Check if this is a page or table request that needs access control
    if (pathname.startsWith("/v1/page/") || pathname.startsWith("/v1/table/")) {
      const pathParts = pathname.split("/");
      const pageIdParam = pathParts[pathParts.length - 1];
      const pageId = parsePageId(pageIdParam);

      // Check if page belongs to any of the allowed spaces
      let pageAllowed = false;
      for (const spaceId of ALLOWED_SPACE_IDS_LIST) {
        try {
          if (await isPageInSpace(pageId!, spaceId, notionToken)) {
            pageAllowed = true;
            break;
          }
        } catch (error) {
          console.error("Error checking page space:", error);
        }
      }

      if (!pageAllowed) {
        return createResponse(
          {
            error:
              "Access denied. This page does not belong to an allowed workspace.",
          },
          {},
          403
        );
      }
    } else if (pathname.startsWith("/v1/search") && ENABLE_SEARCH) {
      // For search, check if the ancestor ID belongs to an allowed space
      const ancestorId = parsePageId(searchParams.get("ancestorId") || "");

      if (ancestorId) {
        let ancestorAllowed = false;
        for (const spaceId of ALLOWED_SPACE_IDS_LIST) {
          try {
            if (await isPageInSpace(ancestorId, spaceId, notionToken)) {
              ancestorAllowed = true;
              break;
            }
          } catch (error) {
            console.error("Error checking ancestor space:", error);
          }
        }

        if (!ancestorAllowed) {
          return createResponse(
            {
              error:
                "Access denied. The specified ancestor page does not belong to an allowed workspace.",
            },
            {},
            403
          );
        }
      }
    }
  }

  const cacheKey = getCacheKey(request);
  let response;

  if (cacheKey) {
    try {
      response = await cache.match(cacheKey);
    } catch (err) {}
  }

  const getResponseAndPersist = async () => {
    const res = await match.handler({
      request,
      searchParams,
      params: match.params,
      notionToken,
    });

    if (cacheKey) {
      await cache.put(cacheKey, res.clone());
    }

    return res;
  };

  if (response) {
    fetchEvent.waitUntil(getResponseAndPersist());
    return response;
  }

  return getResponseAndPersist();
};

self.addEventListener("fetch", async (event: Event) => {
  const fetchEvent = event as FetchEvent;
  fetchEvent.respondWith(handleRequest(fetchEvent));
});
