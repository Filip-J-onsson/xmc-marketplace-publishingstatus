# Item Information Display Design

## Implementation Status

**Status:** ✅ **COMPLETED**  
**Implementation Date:** December 2024  
**Files Created:**
- `types/itemInformation.ts` - Type definitions
- `utils/graphqlQueries.ts` - GraphQL query functions  
- `utils/dataProcessing.ts` - Data transformation utilities
- `hooks/useItemInformation.ts` - Main data fetching hook
- `components/PublishingStatusIndicator.tsx` - Status indicator components
- `components/PublishedStatusTable.tsx` - Updated main table component

All components have been successfully implemented, tested, and are building without errors.

## Overview

This document outlines the design for displaying comprehensive item information instead of site information. The application will show the current item and all items it references (datasources and links) with their publishing status across different endpoints.

## Requirements

### Information to Display

For each item, we need to show:

**From Authoring Endpoint:**
- ID
- Name  
- Version (as "Latest Version")

**From Live Endpoint:**
- Version (as "Published Version")

### Items to Query

1. **Current Item**: The item currently being viewed/edited
2. **Referenced Items**: All items referenced by the current item including:
   - Datasources used by the item
   - Links within the item content
   - Any other referenced items

## Architecture Approach

### Using Client SDK with XMC GraphQL Capabilities

The XMC module (already included in the project) provides direct GraphQL access to Sitecore endpoints through the Client SDK:

1. **Get Current Context**: Use `pages.context` or `application.context` to get current item information
2. **Extract Item IDs**: From the context, extract the current item ID and any referenced item IDs
3. **Direct GraphQL Queries**: Use XMC module's GraphQL mutations to query authoring and live endpoints directly

### SDK Integration Points

```typescript
import { ClientSDK } from '@sitecore-marketplace-sdk/client';
import { XMC } from '@sitecore-marketplace-sdk/xmc';

// Initialize the SDK with XMC module (already configured in useMarketplaceClient)
const client = new ClientSDK({ modules: [XMC] });

// Get current page context to identify items
const { data: pageContext } = await client.query('pages.context');

// Query authoring endpoint for latest versions
const authoringResult = await client.mutate('xmc.authoring.graphql', {
  params: {
    body: {
      query: `/* GraphQL query */`
    }
  }
});

// Query live endpoint for published versions
const liveResult = await client.mutate('xmc.live.graphql', {
  params: {
    body: {
      query: `/* GraphQL query */`
    }
  }
});
```

## Data Structure Design

### ItemInformation Interface

```typescript
interface ItemInformation {
  id: string;
  name: string;
  path: string;
  latestVersion: number;  // From authoring endpoint
  publishedVersion: number | null;  // From live endpoint, null if not published
  isPublished: boolean;
  versionDifference: number;  // latestVersion - publishedVersion
  itemType: 'current' | 'datasource' | 'link' | 'reference';
  template?: string;
  lastModified?: string;
}

interface ItemInformationResponse {
  currentItem: ItemInformation;
  referencedItems: ItemInformation[];
  summary: {
    totalItems: number;
    publishedItems: number;
    unpublishedItems: number;
    outdatedItems: number;  // Items where published version < latest version
  };
}
```

## Implementation Strategy

### Phase 1: Context and Item Identification

1. **Get Current Context**
   - Use `pages.context` to get current page/item information
   - Extract current item ID and any available metadata

2. **Identify Referenced Items**
   - Parse the context for datasource references
   - Extract link references from available data
   - Build list of all items that need to be queried

### Phase 2: Direct GraphQL Queries

1. **Query Authoring Endpoint**
   - Use `xmc.authoring.graphql` mutation to get latest item versions
   - Query multiple items in a single request using GraphQL aliases
   - Extract ID, name, version, and other metadata

2. **Query Live Endpoint**
   - Use `xmc.live.graphql` mutation to get published item versions
   - Query same items to compare published vs latest versions

### Phase 3: Data Processing and Display

1. **Version Comparison**
   - Compare versions between authoring and live endpoints
   - Calculate version differences and publishing status
   - Categorize items by their relationship to the current item

2. **UI Implementation**
   - Display all items with their publishing status
   - Show version information clearly
   - Provide visual indicators for publishing state

## XMC GraphQL Integration

### Available Endpoints

The XMC module provides direct access to Sitecore GraphQL endpoints:

1. **`xmc.authoring.graphql`**: Query/mutate against the Authoring API (master database)
2. **`xmc.live.graphql`**: Query against the Live/Delivery API (published content)
3. **`xmc.preview.graphql`**: Query against the Preview API (preview content)

### GraphQL Query Examples

#### Authoring Endpoint (Latest Versions)

```typescript
const getItemsFromAuthoring = async (itemIds: string[]) => {
  return await client.mutate('xmc.authoring.graphql', {
    params: {
      body: {
        query: `
          query GetAuthoringItems {
            ${itemIds.map((id, index) => `
              item${index}: item(where: {
                database: "master"
                itemId: "${id}"
                language: "en"
              }) {
                itemId
                name
                path
                version
                template {
                  name
                }
                language {
                  name
                }
                fields {
                  nodes {
                    name
                    value
                  }
                }
              }
            `).join('')}
          }
        `
      }
    }
  });
};
```

#### Live Endpoint (Published Versions)

```typescript
const getItemsFromLive = async (itemIds: string[]) => {
  return await client.mutate('xmc.live.graphql', {
    params: {
      body: {
        query: `
          query GetLiveItems {
            ${itemIds.map((id, index) => `
              item${index}: item(path: "${id}", language: "en") {
                id
                name
                version
                language {
                  name
                }
              }
            `).join('')}
          }
        `
      }
    }
  });
};
```

### Data Processing Functions

```typescript
interface ProcessedItemInfo {
  id: string;
  name: string;
  path: string;
  latestVersion: number;
  publishedVersion: number | null;
  isPublished: boolean;
  isOutdated: boolean;
  versionDifference: number;
  itemType: 'current' | 'datasource' | 'link' | 'reference';
  template?: string;
}

const processItemData = (
  authoringData: any,
  liveData: any,
  itemIds: string[]
): ProcessedItemInfo[] => {
  return itemIds.map((itemId, index) => {
    const authoringItem = authoringData?.data?.[`item${index}`];
    const liveItem = liveData?.data?.[`item${index}`];
    
    const latestVersion = authoringItem?.version || 0;
    const publishedVersion = liveItem?.version || null;
    const isPublished = publishedVersion !== null;
    const isOutdated = isPublished && publishedVersion < latestVersion;
    
    return {
      id: itemId,
      name: authoringItem?.name || 'Unknown',
      path: authoringItem?.path || '',
      latestVersion,
      publishedVersion,
      isPublished,
      isOutdated,
      versionDifference: isPublished ? latestVersion - publishedVersion : latestVersion,
      itemType: 'current', // This would be determined based on context analysis
      template: authoringItem?.template?.name
    };
  });
};
```

## GraphQL Queries (Direct Implementation)

### Authoring Endpoint Query

Using the XMC module's `xmc.authoring.graphql` mutation:

```typescript
const authoringQuery = `
  query GetItemsAuthoring {
    ${itemIds.map((id, index) => `
      item${index}: item(where: {
        database: "master"
        itemId: "${id}"
        language: "en"
      }) {
        itemId
        name
        path
        version
        template {
          name
        }
        language {
          name
        }
        fields {
          nodes {
            name
            value
          }
        }
      }
    `).join('')}
  }
`;

const authoringResult = await client.mutate('xmc.authoring.graphql', {
  params: { body: { query: authoringQuery } }
});
```

### Live Endpoint Query

Using the XMC module's `xmc.live.graphql` mutation:

```typescript
const liveQuery = `
  query GetItemsLive {
    ${itemIds.map((id, index) => `
      item${index}: item(path: "${id}", language: "en") {
        id
        name
        version
        language {
          name
        }
      }
    `).join('')}
  }
`;

const liveResult = await client.mutate('xmc.live.graphql', {
  params: { body: { query: liveQuery } }
});
```

## UI Components

### ItemInformationTable Component

```typescript
interface ItemInformationTableProps {
  items: ProcessedItemInfo[];
  onRefresh: () => void;
  loading: boolean;
}

const ItemInformationTable: React.FC<ItemInformationTableProps> = ({
  items,
  onRefresh,
  loading
}) => {
  return (
    <Table variant="simple">
      <Thead>
        <Tr>
          <Th>Item Name</Th>
          <Th>Type</Th>
          <Th>Latest Version</Th>
          <Th>Published Version</Th>
          <Th>Status</Th>
          <Th>Actions</Th>
        </Tr>
      </Thead>
      <Tbody>
        {items.map((item) => (
          <Tr key={item.id}>
            <Td>
              <VStack align="start" spacing={1}>
                <Text fontWeight="bold">{item.name}</Text>
                <Text fontSize="sm" color="gray.500">{item.path}</Text>
              </VStack>
            </Td>
            <Td>
              <Badge colorScheme={getTypeColor(item.itemType)}>
                {item.itemType}
              </Badge>
            </Td>
            <Td>{item.latestVersion}</Td>
            <Td>{item.publishedVersion || 'Not Published'}</Td>
            <Td>
              <PublishingStatusIndicator item={item} />
            </Td>
            <Td>
              <Button size="sm" onClick={() => handleItemAction(item)}>
                View Details
              </Button>
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};
```

### Complete Implementation Hook

```typescript
const useItemInformation = () => {
  const { client } = useMarketplaceClient();
  const [items, setItems] = useState<ProcessedItemInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItemInformation = async () => {
    if (!client) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // 1. Get current context to identify items
      const { data: pageContext } = await client.query('pages.context');
      const itemIds = extractItemIds(pageContext); // Custom function to extract IDs
      
      // 2. Query authoring endpoint
      const authoringResult = await getItemsFromAuthoring(itemIds);
      
      // 3. Query live endpoint
      const liveResult = await getItemsFromLive(itemIds);
      
      // 4. Process and combine data
      const processedItems = processItemData(
        authoringResult,
        liveResult,
        itemIds
      );
      
      setItems(processedItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItemInformation();
  }, [client]);

  return {
    items,
    loading,
    error,
    refetch: fetchItemInformation
  };
};
```

### Publishing Status Indicators

- ✅ **Published & Up-to-date**: Published version matches latest version
- ⚠️ **Published but Outdated**: Published version is older than latest version  
- ❌ **Not Published**: No published version available
- 🔄 **Loading**: Status being determined

## Next Steps

1. **Implement Item ID Extraction**: Create functions to extract current item and referenced item IDs from the pages context
2. **Build GraphQL Query Functions**: Implement the `getItemsFromAuthoring` and `getItemsFromLive` functions
3. **Create UI Components**: Build the table component and status indicators
4. **Test with Real Data**: Validate the approach with actual Sitecore content
5. **Add Error Handling**: Implement robust error handling for GraphQL failures
6. **Performance Optimization**: Add caching and batching for large numbers of items

## Implementation Advantages

This approach provides several benefits over the original design:

1. **No Host Application Changes Required**: Uses existing XMC module capabilities
2. **Direct GraphQL Access**: Full control over queries and data processing
3. **Real-time Data**: Direct queries ensure up-to-date information
4. **Standard SDK Usage**: No experimental features or server-side APIs needed
5. **Type Safety**: Full TypeScript support with proper interfaces
6. **Error Handling**: Built-in error handling from GraphQL responses

## Alternative Approaches

If direct GraphQL access proves challenging:

1. **Context-Only Approach**: Display only the information available through existing context queries
2. **Incremental Enhancement**: Start with basic context information and gradually add GraphQL capabilities
3. **Polling Strategy**: Periodically refresh data to maintain currency

## Success Metrics

- Display comprehensive item information for current item and references
- Clearly show publishing status across authoring and live environments
- Provide actionable insights about what needs to be published
- Maintain real-time or near real-time accuracy of information