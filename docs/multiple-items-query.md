# Sitecore GraphQL: Multiple Items Query (Preview, Live & Authoring Endpoints)

This document describes how to query multiple items from Sitecore using GraphQL for Preview, Live, and Authoring endpoints, focusing on the schema, query structure, and sample results.

---

## 1. GraphQL Schema Overview

### Preview Endpoint
- The schema includes many types, but for item queries, the relevant type is usually `item`.
- Example type names: `item`, `ItemSearchPredicateInput`, `ItemSearchOperator`, etc.

### Live Endpoint
- The schema contains over 1000 types, with key types for item queries:
  - `item`: Query for content items
  - `layout`: Query for presentation/layout data
  - `search`: Query for items by criteria
- Item-related types: 52
- Layout-related types: 18
- Sitecore-specific types: 3

### Authoring Endpoint
- The schema contains 314 types, with key types for authoring operations:
  - `item`: Query for content items
  - `search`: Query for items by criteria
  - `site`: Query for site information
- Item-related types: 84
- Template-related types: 27
- Search-related types: 12
- Media-related types: 5
- **Mutation Type**: Available (for create, update, delete operations)

---

## 2. Query Structure for Multiple Items

### Preview & Live Endpoints
To fetch multiple items by ID, use aliases for each item in a single GraphQL query.

```graphql
query GetMultipleItems {
  item0: item(path: "{ITEM_ID_1}", language: "en") {
    id
    name
    version
    language {
      name
    }
  }
  item1: item(path: "{ITEM_ID_2}", language: "en") {
    id
    name
    version
    language {
      name
    }
  }
  // ...add more items as needed
}
```

### Authoring Endpoint
The Authoring API uses a different syntax structure with the `where` clause:

```graphql
query GetMultipleAuthoringItems {
  item0: item(where: {
    database: "master"
    itemId: "{ITEM_ID_1}"
    language: "en"
  }) {
    itemId
    name
    path
    template {
      name
    }
    language {
      name
    }
    version
    fields {
      nodes {
        name
        value
      }
    }
  }
  item1: item(where: {
    database: "master"
    itemId: "{ITEM_ID_2}"
    language: "en"
  }) {
    itemId
    name
    path
    template {
      name
    }
    language {
      name
    }
    version
    fields {
      nodes {
        name
        value
      }
    }
  }
  // ...add more items as needed
}
```

---

## 3. Sample Results

### Preview Endpoint

```json
{
  "data": {
    "item0": {
      "id": "5ED521788F0649BE9D4CF191E650189E",
      "name": "About",
      "version": 6,
      "language": { "name": "en" }
    },
    "item1": {
      "id": "9C8262E464564946B04ED5873874615E",
      "name": "Text 1",
      "version": 5,
      "language": { "name": "en" }
    }
  }
}
```

### Live Endpoint

```json
{
  "data": {
    "item0": {
      "id": "5ED521788F0649BE9D4CF191E650189E",
      "name": "About",
      "version": 6,
      "language": { "name": "en" }
    },
    "item1": {
      "id": "9C8262E464564946B04ED5873874615E",
      "name": "Text 1",
      "version": 5,
      "language": { "name": "en" }
    }
  }
}
```

### Authoring Endpoint

```json
{
  "data": {
    "item0": {
      "itemId": "5ed521788f0649be9d4cf191e650189e",
      "name": "About",
      "path": "/sitecore/content/nextjs-article_starter/solterra/Home/About",
      "template": { "name": "Landing Page" },
      "language": { "name": "en" },
      "version": 6,
      "fields": {
        "nodes": [
          { "name": "Title", "value": "About Us" },
          { "name": "Content", "value": "<p>Welcome to our site</p>" }
        ]
      }
    },
    "item1": {
      "itemId": "9c8262e464564946b04ed5873874615e",
      "name": "Text 1",
      "path": "/sitecore/content/nextjs-article_starter/solterra/Home/About/Data/Text 1",
      "template": { "name": "Text" },
      "language": { "name": "en" },
      "version": 5,
      "fields": {
        "nodes": [
          { "name": "Text", "value": "Sample content text" }
        ]
      }
    }
  }
}
```

---

## 4. Key Differences Between Endpoints

| Feature | Preview/Live | Authoring |
|---------|-------------|-----------|
| **Endpoint Path** | `/sitecore/api/graph/edge` | `/sitecore/api/authoring/graphql/v1` |
| **Query Syntax** | `item(path: "{ID}", language: "en")` | `item(where: { database: "master", itemId: "{ID}", language: "en" })` |
| **Item ID Field** | `id` | `itemId` |
| **Database Parameter** | Not required | Required (`"master"`) |
| **Field Structure** | Simple fields array | `fields { nodes { name, value } }` |
| **Mutations** | Not available | Available for CRUD operations |
| **Template Info** | `template { name, id }` | `template { name }` (no itemId) |

---

## 5. How to Recreate the Queries

### For Preview/Live Endpoints:
1. Use the schema's `item` query type
2. For each item ID, create an alias and request the desired fields
3. Use `path: "{ITEM_ID}"` syntax
4. Send the query to the appropriate endpoint

### For Authoring Endpoint:
1. Use the schema's `item` query type with `where` clause
2. Include `database: "master"` in the where clause
3. Use `itemId: "{ITEM_ID}"` syntax
4. Access field data via `fields { nodes { name, value } }`
5. Send the query to the authoring GraphQL endpoint

---

This guide provides all the information needed to construct and interpret multiple item queries for all three Sitecore GraphQL endpoints.
