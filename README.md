![Notion API Worker](https://user-images.githubusercontent.com/1440854/79893752-cc448680-8404-11ea-8d19-e0308eb32028.png)
![API Version](https://badgen.net/badge/API%20Version/v1/green)

A **serverless wrapper** for the private Notion API. It provides fast and easy access to your Notion content.
Ideal to make Notion your CMS.

We provide a hosted version of this project on [`https://notion-api.splitbee.io`](https://notion-api.splitbee.io/). You can also [host it yourself](https://workers.cloudflare.com/). Cloudflare offers a generous free plan with up to 100,000 request per day.

_Use with caution. This is based on the private Notion API. We can not gurantee it will stay stable._

## Features

🍭 **Easy to use** – Receive Notion data with a single GET request

🗄 **Table Access** – Get structured data from tables & databases

✨ **Blazing Fast** – Built-in [SWR](https://www.google.com/search?q=stale+while+revalidate) caching for instant results

🛫 **CORS Friendly** – Access your data where you need it

## Use Cases

- Use it as data-source for blogs and documentation. Create a table with pages and additional metadata. Query the `/table` endpoints everytime you want to render a list of all pages.

- Get data of specific pages, which can be rendered with [`react-notion`](https://github.com/splitbee/react-notion)

## Endpoints

### Load page data

`/v1/page/<PAGE_ID>`

Example ([Source Notion Page](https://www.notion.so/react-notion-example-2e22de6b770e4166be301490f6ffd420))

[`https://notion-api.splitbee.io/v1/page/2e22de6b770e4166be301490f6ffd420`](https://notion-api.splitbee.io/v1/page/2e22de6b770e4166be301490f6ffd420)

Returns all block data for a given page.
For example, you can render this data with [`react-notion`](https://github.com/splitbee/react-notion).

### Load data from table

`/v1/table/<PAGE_ID>`

Example ([Source Notion Page](https://www.notion.so/splitbee/20720198ca7a4e1b92af0a007d3b45a4?v=4206debfc84541d7b4503ebc838fdf1e))

[`https://notion-api.splitbee.io/v1/table/20720198ca7a4e1b92af0a007d3b45a4`](https://notion-api.splitbee.io/v1/table/20720198ca7a4e1b92af0a007d3b45a4)

## Authentication for private pages

All public pages can be accessed without authorization. If you want to fetch private pages there are two options.

- The recommended way is to host your own worker with the `NOTION_TOKEN` environment variable set. You can find more information in the [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/reference/apis/environment-variables/).
- Alternatively you can set the `Authorization: Bearer <NOTION_TOKEN>` header to authorize your requests.

### Receiving the token

To obtain your token, login to Notion and open your DevTools and find your cookies. There should be a cookie called `token_v2`, which is used for the authorization.

## Configuration Options

### Enabling/Disabling Routes

You can control which API endpoints are available by configuring the `wrangler.toml` file. This allows you to disable specific routes that you don't need or want to expose.

```toml
[vars]
# Set to true to enable, false to disable
PAGE_ENABLED = true    # Controls /v1/page/:pageId endpoint
TABLE_ENABLED = true   # Controls /v1/table/:pageId endpoint
SEARCH_ENABLED = true  # Controls /v1/search endpoint
USER_ENABLED = true    # Controls /v1/user/:userId endpoint
```

This way, you can expose only the specific endpoints you need for your application.

### Organization/Workspace Restrictions

You can restrict access to only allow pages from your organization/workspace. This is useful for preventing access to pages outside your organization, even if a user has valid authentication.

```toml
[vars]
# For a single space/organization ID:
ALLOWED_SPACE_ID = "your-space-id"

# For multiple space IDs (comma-separated):
ALLOWED_SPACE_IDS = "space-id-1,space-id-2,space-id-3"
```

To find your workspace/space ID:
1. Use the browser dev tools with a page from your workspace loaded
2. Look for requests to the Notion API that contain a `space_id` field
3. Alternatively, inspect the response from `/v1/page/<PAGE_ID>` and look for the `space_id` property in the block data

### Environment-specific Configuration

You can define different configurations for different environments:

```toml
# Default environment
[vars]
PAGE_ENABLED = true
TABLE_ENABLED = true
SEARCH_ENABLED = true
USER_ENABLED = true

# Production environment
[env.production]
# Example: Only enable page and table routes in production
PAGE_ENABLED = true
TABLE_ENABLED = true
SEARCH_ENABLED = false
USER_ENABLED = false
ALLOWED_SPACE_ID = "your-production-space-id"
```

## Credits

- [Timo Lins](https://twitter.com/timolins) – Idea, Documentation
- [Tobias Lins](https://twitter.com/linstobias) – Code
- [Travis Fischer](https://twitter.com/transitive_bs) – Code
