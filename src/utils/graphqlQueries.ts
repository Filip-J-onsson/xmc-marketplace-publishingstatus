// utils/graphqlQueries.ts
import { ClientSDK } from '@sitecore-marketplace-sdk/client';
import type { ItemQueryResult } from '../types/itemInformation';
import { formatGuidWithHyphens } from './dataProcessing';

// Configuration for direct live endpoint calls
const LIVE_ENDPOINT = import.meta.env.VITE_SITECORE_EDGE_ENDPOINT || 'https://edge.sitecorecloud.io/api/graphql/v1';
const LIVE_TOKEN = import.meta.env.VITE_SITECORE_EDGE_TOKEN || '';

// Validate required environment variables
if (!LIVE_TOKEN && import.meta.env.DEV) {
  console.warn('⚠️ VITE_SITECORE_EDGE_TOKEN not set in environment variables. Live endpoint queries will fail.');
  console.warn('   Please copy .env.example to .env and add your Sitecore Experience Edge API token.');
}

/**
 * Format GUID for live endpoint (needs hyphens)
 */
export const formatGuidForLive = (guid: string): string => {
  return formatGuidWithHyphens(guid);
};

/**
 * Query the authoring endpoint for multiple items to get latest versions
 */
export const getItemsFromAuthoring = async (
  client: ClientSDK,
  itemIds: string[],
  sitecoreContextId?: string,
  language: string = 'en'
): Promise<ItemQueryResult> => {
  if (!client || itemIds.length === 0) {
    return { data: { data: {} } };
  }

  if (!sitecoreContextId) {
    console.warn('sitecoreContextId not provided for authoring GraphQL queries');
  }

  const query = `
    query GetAuthoringItems {
      ${itemIds.map((id, index) => `
        item${index}: item(where: {
          database: "master"
          itemId: "${id}"
          language: "${language}"
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

  try {
    // Use official SDK approach with sitecoreContextId in query params (if available)
    const queryParams = sitecoreContextId ? { sitecoreContextId } : {};
    const result = await client.mutate('xmc.authoring.graphql', {
      params: {
        query: queryParams,
        body: {
          query: query.trim()
        }
      }
    });
    
    return result;
  } catch (error) {
    console.error('Error querying authoring endpoint:', error);
    return { error };
  }
};

/**
 * Query the live endpoint for multiple items to get published versions
 * Uses direct HTTP call to ensure we hit the correct Experience Edge endpoint
 */
export const getItemsFromLive = async (
  _client: ClientSDK, // Unused but kept for API compatibility
  itemIds: string[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _sitecoreContextId?: string, // Unused but kept for API compatibility
  language: string = 'en'
): Promise<ItemQueryResult> => {
  if (itemIds.length === 0) {
    return { data: { data: {} } };
  }

  const query = `
    query GetLiveItems {
      ${itemIds.map((id, index) => `
        item${index}: item(path: "{${formatGuidForLive(id)}}", language: "${language}") {
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

  try {
    // Check if token is available
    if (!LIVE_TOKEN) {
      throw new Error('VITE_SITECORE_EDGE_TOKEN environment variable is not set. Please configure your Experience Edge API token.');
    }

    // Make direct HTTP call to Experience Edge endpoint instead of using SDK
    const response = await fetch(LIVE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'sc_apikey': LIVE_TOKEN
      },
      body: JSON.stringify({
        query: query.trim()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    // Return in the same format as the SDK would
    return { data: result };
  } catch (error) {
    console.error('Error querying DIRECT live endpoint:', error);
    return { error };
  }
};

/**
 * Query the preview endpoint for multiple items
 */
export const getItemsFromPreview = async (
  client: ClientSDK,
  itemIds: string[],
  sitecoreContextId?: string,
  language: string = 'en'
): Promise<ItemQueryResult> => {
  if (!client || itemIds.length === 0) {
    return { data: { data: {} } };
  }

  if (!sitecoreContextId) {
    console.warn('sitecoreContextId not provided for preview GraphQL queries');
  }

  const query = `
    query GetPreviewItems {
      ${itemIds.map((id, index) => `
        item${index}: item(path: "${id}", language: "${language}") {
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

  try {
    // Use official SDK approach with sitecoreContextId in query params (if available)
    const queryParams = sitecoreContextId ? { sitecoreContextId } : {};
    const result = await client.mutate('xmc.preview.graphql', {
      params: {
        query: queryParams,
        body: {
          query: query.trim()
        }
      }
    });
    return result;
  } catch (error) {
    console.error('Error querying preview endpoint:', error);
    return { error };
  }
};

/**
 * Helper function to validate GraphQL response structure
 */
export const validateGraphQLResponse = (response: ItemQueryResult): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  if (!response) {
    errors.push('Response is null or undefined');
    return { isValid: false, errors };
  }

  if (response.error) {
    errors.push(`Response error: ${response.error}`);
  }

  if (!response.data) {
    errors.push('No data in response');
  } else if (!response.data.data) {
    errors.push('No nested data in response.data');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Resolve local datasource paths to item IDs using GraphQL
 * @param client - Marketplace SDK client
 * @param localPaths - Array of local paths like ['Data/Article Header', 'Data/Text 1']
 * @param basePath - Base path of the current page (e.g., '/sitecore/content/.../Article Page')
 * @param sitecoreContextId - Context ID for the query
 * @returns Object mapping local paths to resolved item IDs
 */
export const resolveLocalDatasourcePaths = async (
  client: ClientSDK,
  localPaths: string[],
  basePath: string,
  sitecoreContextId: string,
  language: string = 'en'
): Promise<Record<string, string | null>> => {
  if (!client || localPaths.length === 0) {
    return {};
  }

  // Try multiple path construction strategies for local datasources
  const pathStrategies = [
    // Strategy 1: Direct under current path
    (localPath: string, basePath: string) => `${basePath}/${localPath}`,
    // Strategy 2: Under Data folder
    (localPath: string, basePath: string) => `${basePath}/Data/${localPath}`,
    // Strategy 3: Remove "Page Components/" prefix
    (localPath: string, basePath: string) => `${basePath}/${localPath.replace('Page Components/', '')}`,
    // Strategy 4: Under Data with clean path
    (localPath: string, basePath: string) => {
      const cleanPath = localPath.replace('Page Components/', '');
      return `${basePath}/Data/${cleanPath}`;
    }
  ];

  let resolvedItems: Record<string, string | null> = {};
  
  // Try each strategy until we find the items
  for (let strategyIndex = 0; strategyIndex < pathStrategies.length; strategyIndex++) {
    const strategy = pathStrategies[strategyIndex];
    const fullPaths = localPaths.map(localPath => strategy(localPath, basePath));

    const query = `
      query ResolveLocalDatasources {
        ${localPaths.map((_, index) => `
          path${index}: item(where: {
            database: "master"
            path: "${fullPaths[index]}"
            language: "${language}"
          }) {
            itemId
            name
            path
          }
        `).join('')}
      }
    `;

    try {
      const queryParams = sitecoreContextId ? { sitecoreContextId } : {};
      const response = await client.mutate('xmc.authoring.graphql', {
        params: {
          query: queryParams,
          body: {
            query: query.trim()
          }
        }
      });

      const result: Record<string, string | null> = {};
      let foundItems = 0;
      
      if (response?.data?.data) {
        localPaths.forEach((localPath, index) => {
          const responseData = response.data?.data;
          if (responseData) {
            const item = responseData[`path${index}`] as { itemId?: string; name?: string } | null;
            if (item && item.itemId) {
              result[localPath] = item.itemId.replace(/[{}]/g, '').toUpperCase();
              foundItems++;
            } else {
              result[localPath] = null;
            }
          }
        });
      }

      // If we found all items, return this result
      if (foundItems === localPaths.length) {
        return result;
      }

      // If we found some items, keep track but continue trying
      if (foundItems > 0) {
        resolvedItems = { ...resolvedItems, ...result };
      }

    } catch (error) {
      console.error('Error in path resolution strategy:', error);
    }
  }

  // Return the best result we found (may have some nulls)
  return resolvedItems;
};