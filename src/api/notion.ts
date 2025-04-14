import {
  JSONData,
  NotionUserType,
  LoadPageChunkData,
  CollectionData,
  NotionSearchParamsType,
  NotionSearchResultsType,
} from "./types";

const NOTION_API = "https://www.notion.so/api/v3";

interface INotionParams {
  resource: string;
  body: JSONData;
  notionToken?: string;
}

const loadPageChunkBody = {
  limit: 100,
  cursor: { stack: [] },
  chunkNumber: 0,
  verticalColumns: false,
};

const fetchNotionData = async <T extends any>({
  resource,
  body,
  notionToken,
}: INotionParams): Promise<T> => {
  const res = await fetch(`${NOTION_API}/${resource}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(notionToken && { cookie: `token_v2=${notionToken}` }),
    },
    body: JSON.stringify(body),
  });

  return res.json();
};

export const fetchPageById = async (pageId: string, notionToken?: string) => {
  const res = await fetchNotionData<LoadPageChunkData>({
    resource: "loadPageChunk",
    body: {
      pageId,
      ...loadPageChunkBody,
    },
    notionToken,
  });

  return res;
};

const queryCollectionBody = {
  loader: {
    type: "reducer",
    reducers: {
      collection_group_results: {
        type: "results",
        limit: 999,
        loadContentCover: true,
      },
      "table:uncategorized:title:count": {
        type: "aggregation",
        aggregation: {
          property: "title",
          aggregator: "count",
        },
      },
    },
    searchQuery: "",
    userTimeZone: "Europe/Vienna",
  },
};

export const fetchTableData = async (
  collectionId: string,
  collectionViewId: string,
  notionToken?: string
) => {
  const table = await fetchNotionData<CollectionData>({
    resource: "queryCollection",
    body: {
      collection: {
        id: collectionId,
      },
      collectionView: {
        id: collectionViewId,
      },
      ...queryCollectionBody,
    },
    notionToken,
  });

  return table;
};

export const fetchNotionUsers = async (
  userIds: string[],
  notionToken?: string
) => {
  const users = await fetchNotionData<{ results: NotionUserType[] }>({
    resource: "getRecordValues",
    body: {
      requests: userIds.map((id) => ({ id, table: "notion_user" })),
    },
    notionToken,
  });
  if (users && users.results) {
    return users.results.map((u) => {
      const user = {
        id: u.value.id,
        firstName: u.value.given_name,
        lastLame: u.value.family_name,
        fullName: u.value.given_name + " " + u.value.family_name,
        profilePhoto: u.value.profile_photo,
      };
      return user;
    });
  }
  return [];
};

export const fetchBlocks = async (
  blockList: string[],
  notionToken?: string
) => {
  return await fetchNotionData<LoadPageChunkData>({
    resource: "syncRecordValues",
    body: {
      requests: blockList.map((id) => ({
        id,
        table: "block",
        version: -1,
      })),
    },
    notionToken,
  });
};

export const fetchNotionSearch = async (
  params: NotionSearchParamsType,
  notionToken?: string
) => {
  // TODO: support other types of searches
  return fetchNotionData<{ results: NotionSearchResultsType }>({
    resource: "search",
    body: {
      type: "BlocksInAncestor",
      source: "quick_find_public",
      ancestorId: params.ancestorId,
      filters: {
        isDeletedOnly: false,
        excludeTemplates: true,
        isNavigableOnly: true,
        requireEditPermissions: false,
        ancestors: [],
        createdBy: [],
        editedBy: [],
        lastEditedTime: {},
        createdTime: {},
        ...params.filters,
      },
      sort: "Relevance",
      limit: params.limit || 20,
      query: params.query,
    },
    notionToken,
  });
};

// Get space/organization information for a page
export const getPageSpaceInfo = async (
  pageId: string,
  notionToken?: string
) => {
  // First fetch the page to get any block
  const pageData = await fetchPageById(pageId, notionToken);

  // Log the page data structure for debugging
  console.log(JSON.stringify(pageData, null, 2));

  if (
    !pageData.recordMap.block ||
    Object.keys(pageData.recordMap.block).length === 0
  ) {
    return null;
  }

  // Get the first block
  const blockId = Object.keys(pageData.recordMap.block)[0];
  const block = pageData.recordMap.block[blockId];

  // Use getSpaces API to get information about all spaces the user has access to
  const spacesData = await fetchNotionData({
    resource: "getSpaces",
    body: {},
    notionToken,
  });

  // Return the spaces data and the block info which contains space_id
  return {
    block,
    spaces: spacesData,
  };
};

// Check if a page belongs to a specific space/org
export const isPageInSpace = async (
  pageId: string,
  spaceId: string,
  notionToken?: string
) => {
  const spaceInfo = await getPageSpaceInfo(pageId, notionToken);

  if (!spaceInfo || !spaceInfo.block || !spaceInfo.block.value) {
    return false;
  }

  // Check if the block has space_id property
  if (spaceInfo.block.value.space_id === spaceId) {
    return true;
  }

  // If the API response format doesn't have space_id directly on the block,
  // we may need to infer it from the space membership data
  if (spaceInfo.spaces) {
    // Implementation depends on the exact structure of the getSpaces response
    // This is a placeholder for the logic to check if the page belongs to the specified space
    return false;
  }

  return false;
};
