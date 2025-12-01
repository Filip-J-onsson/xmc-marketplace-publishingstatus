// utils/dataProcessing.ts
import type { 
  ProcessedItemInfo, 
  ItemInformationResponse,
  ItemInformationSummary,
  AuthoringItemResponse,
  LiveItemResponse,
  ItemType,
  ItemQueryResult
} from '../types/itemInformation';

/**
 * Normalize item ID to uppercase without braces or hyphens (for internal use)
 */
const normalizeItemId = (itemId: string): string => {
  return itemId.replace(/[{}-]/g, '').toUpperCase();
};

/**
 * Format GUID with hyphens for display purposes (standard GUID format)
 */
export const formatGuidWithHyphens = (guid: string): string => {
  const clean = guid.replace(/[{}-]/g, '').toUpperCase();
  if (clean.length !== 32) return guid; // Return original if not a valid GUID
  
  return `${clean.substring(0, 8)}-${clean.substring(8, 12)}-${clean.substring(12, 16)}-${clean.substring(16, 20)}-${clean.substring(20, 32)}`;
};

/**
 * Format GUID without hyphens (compact format)
 */
export const formatGuidWithoutHyphens = (guid: string): string => {
  return guid.replace(/[{}-]/g, '').toUpperCase();
};

/**
 * Check if a string is a valid GUID format
 */
const isValidGuid = (str: string): boolean => {
  const guidRegex = /^[{]?[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}[}]?$/;
  return guidRegex.test(str);
};

/**
 * Parse datasource value and extract item IDs and local paths
 * Returns object with directIds (GUIDs) and localPaths (need resolution)
 */
const parseDatasourceValue = (datasource: string): { directIds: string[], localPaths: string[] } => {
  const directIds: string[] = [];
  const localPaths: string[] = [];
  
  if (!datasource || typeof datasource !== 'string') {
    return { directIds, localPaths };
  }
  
  // Handle multiple datasources separated by pipes
  const datasources = datasource.split('|').map(ds => ds.trim()).filter(ds => ds.length > 0);
  
  for (const ds of datasources) {
    if (isValidGuid(ds)) {
      // Direct GUID reference
      const cleanId = normalizeItemId(ds);
      directIds.push(cleanId);
    } else if (ds.startsWith('local:/')) {
      // Local datasource path - needs to be resolved via GraphQL
      const localPath = ds.substring(7); // Remove 'local:/'
      localPaths.push(localPath);
    } else if (ds.startsWith('/sitecore/')) {
      // Sitecore content path - needs to be resolved via GraphQL
      localPaths.push(ds); // Store full path for resolution
    }
  }
  
  return { directIds, localPaths };
};

/**
 * Extract all datasource item IDs from presentation details structure
 * Returns both direct GUID references and local paths that need resolution
 */
const extractDatasourcesFromPresentationDetails = (presentationDetails: unknown): { directIds: string[], localPaths: string[] } => {
  const directIds: string[] = [];
  const localPaths: string[] = [];
  
  if (!presentationDetails) {
    return { directIds, localPaths };
  }
  
  try {
    // Parse the presentation details (could be string or object)
    let details: Record<string, unknown>;
    if (typeof presentationDetails === 'string') {
      details = JSON.parse(presentationDetails) as Record<string, unknown>;
    } else {
      details = presentationDetails as Record<string, unknown>;
    }
    
    // Navigate the presentation structure to find renderings and their datasources
    if (details.devices && Array.isArray(details.devices)) {
      for (const device of details.devices) {
        if (device.renderings && Array.isArray(device.renderings)) {
          for (const rendering of device.renderings) {
            if (rendering.dataSource || rendering.datasource) {
              const datasourceValue = rendering.dataSource || rendering.datasource;
              const { directIds: renderingDirectIds, localPaths: renderingLocalPaths } = parseDatasourceValue(datasourceValue);
              
              // Collect direct IDs
              renderingDirectIds.forEach(id => {
                if (!directIds.includes(id)) {
                  directIds.push(id);
                }
              });
              
              // Collect local paths
              renderingLocalPaths.forEach(path => {
                if (!localPaths.includes(path)) {
                  localPaths.push(path);
                }
              });
            }
          }
        }
        
        // Also check placeholders for nested datasources
        if (device.placeholders && Array.isArray(device.placeholders)) {
          for (const placeholder of device.placeholders) {
            // Recursively process placeholder renderings
            if (placeholder.renderings && Array.isArray(placeholder.renderings)) {
              for (const rendering of placeholder.renderings) {
                if (rendering.dataSource || rendering.datasource) {
                  const datasourceValue = rendering.dataSource || rendering.datasource;
                  console.log(`📄 Found placeholder rendering datasource: "${datasourceValue}"`);
                  
                  const { directIds: placeholderDirectIds, localPaths: placeholderLocalPaths } = parseDatasourceValue(datasourceValue);
                  
                  // Collect direct IDs
                  placeholderDirectIds.forEach(id => {
                    if (!directIds.includes(id)) {
                      directIds.push(id);
                    }
                  });
                  
                  // Collect local paths
                  placeholderLocalPaths.forEach(path => {
                    if (!localPaths.includes(path)) {
                      localPaths.push(path);
                    }
                  });
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('Error parsing presentation details:', error);
  }
  
  return { directIds, localPaths };
};

/**
 * Interface for enhanced item extraction results
 */
export interface ExtractedItemInfo {
  itemIds: string[];
  localPathsToResolve: string[];
  currentPagePath: string;
  language: string;
}

/**
 * Extract item IDs from pages context including datasources from presentation details
 */
export const extractItemIds = (pageContext: unknown): string[] => {
  const result = extractItemIdsWithLocalPaths(pageContext);
  return result.itemIds;
}

/**
 * Enhanced version that returns more detailed information for local path resolution
 */
export const extractItemIdsWithLocalPaths = (pageContext: unknown): ExtractedItemInfo => {
  if (!pageContext || typeof pageContext !== 'object') {
    return { itemIds: [], localPathsToResolve: [], currentPagePath: '', language: 'en' };
  }

  const context = pageContext as Record<string, unknown>;
  const itemIds: string[] = [];
  let currentItemId: string | null = null;
  let currentPagePath = '';
  let language = 'en'; // Default fallback

  // Check pageInfo for current item
  if (context.pageInfo && typeof context.pageInfo === 'object') {
    const pageInfo = context.pageInfo as Record<string, unknown>;
    
    // Extract current page path
    currentPagePath = (pageInfo.path as string) || '';
    
    // Extract language from page context - try multiple possible locations
    language = (pageInfo.language as string) || 
               (pageInfo.lang as string) ||
               (context.language as string) ||
               (context.lang as string) ||
               ((context.siteInfo as Record<string, unknown>)?.language as string) ||
               'en';
    
    // Common locations for current item ID
    currentItemId = pageInfo.itemId as string || 
                   pageInfo.id as string ||
                   pageInfo.pageId as string;
    
    // Extract datasources from presentation details
    if (pageInfo.presentationDetails) {
      const { directIds, localPaths } = extractDatasourcesFromPresentationDetails(pageInfo.presentationDetails);
      
      // Add direct GUID datasources
      directIds.forEach(id => {
        if (!itemIds.includes(id)) {
          itemIds.push(id);
        }
      });
      
      // Return info about local paths that need resolution
      if (localPaths.length > 0) {
        // Add main item first
        if (currentItemId && typeof currentItemId === 'string') {
          const cleanCurrentId = normalizeItemId(currentItemId);
          if (!itemIds.includes(cleanCurrentId)) {
            itemIds.unshift(cleanCurrentId);
          }
        }
        
        return { 
          itemIds, 
          localPathsToResolve: localPaths, 
          currentPagePath,
          language
        };
      }
    }
  }

  // Check siteInfo for current item (fallback)
  if (!currentItemId && context.siteInfo && typeof context.siteInfo === 'object') {
    const siteInfo = context.siteInfo as Record<string, unknown>;
    currentItemId = siteInfo.itemId as string || siteInfo.id as string;
    
    // Try to get language from siteInfo if not found yet
    if (language === 'en') {
      language = (siteInfo.language as string) || (siteInfo.defaultLanguage as string) || language;
    }
  }

  // Check root level for item ID (fallback)
  if (!currentItemId) {
    currentItemId = context.itemId as string || 
                   context.id as string ||
                   context.pageId as string;
  }

  // Add current item ID if found (ensure it's first in the list)
  if (currentItemId && typeof currentItemId === 'string') {
    const cleanCurrentId = normalizeItemId(currentItemId);
    if (!itemIds.includes(cleanCurrentId)) {
      itemIds.unshift(cleanCurrentId); // Add at beginning
    }
  } else {
    return { itemIds: [], localPathsToResolve: [], currentPagePath: '', language: 'en' };
  }

  return { itemIds, localPathsToResolve: [], currentPagePath, language };
};

/**
 * Determine item type based on context and relationships
 */
export const determineItemType = (itemId: string, currentItemId?: string): ItemType => {
  if (itemId === currentItemId) {
    return 'current';
  }
  
  // TODO: Implement logic to determine if item is datasource, link, or reference
  // This would require analyzing the item's relationship to the current item
  
  // Placeholder logic
  return 'reference';
};

/**
 * Process raw GraphQL responses into ProcessedItemInfo objects
 */
export const processItemData = (
  authoringResult: ItemQueryResult,
  liveResult: ItemQueryResult,
  itemIds: string[],
  currentItemId?: string,
  referencedByMap?: Map<string, Array<{ id: string; name: string; path: string }>>
): ProcessedItemInfo[] => {
  const processedItems: ProcessedItemInfo[] = [];

  // Validate both responses
  const authoringValidation = validateResponse(authoringResult);
  const liveValidation = validateResponse(liveResult);

  itemIds.forEach((itemId, index) => {
    const authoringItem = authoringValidation.data?.[`item${index}`] as AuthoringItemResponse | undefined;
    const liveItem = liveValidation.data?.[`item${index}`] as LiveItemResponse | undefined;

    const latestVersion = authoringItem?.version || 0;
    const publishedVersion = liveItem?.version || null;
    const isPublished = publishedVersion !== null;
    const isOutdated = isPublished && publishedVersion < latestVersion;

    // Try to find referenced by info - try both with and without hyphens
    const referencedBy = referencedByMap?.get(itemId) || 
                        referencedByMap?.get(formatGuidWithHyphens(itemId));
    

    processedItems.push({
      id: itemId,
      name: authoringItem?.name || liveItem?.name || 'Unknown Item',
      path: authoringItem?.path || '',
      latestVersion,
      publishedVersion,
      isPublished,
      isOutdated,
      versionDifference: isPublished ? latestVersion - publishedVersion : latestVersion,
      itemType: determineItemType(itemId, currentItemId),
      template: authoringItem?.template?.name,
      language: authoringItem?.language?.name || liveItem?.language?.name || 'en',
      referencedBy
    });
  });

  return processedItems;
};

/**
 * Generate summary statistics from processed item data
 */
export const generateSummary = (items: ProcessedItemInfo[]): ItemInformationSummary => {
  return {
    totalItems: items.length,
    publishedItems: items.filter(item => item.isPublished).length,
    unpublishedItems: items.filter(item => !item.isPublished).length,
    outdatedItems: items.filter(item => item.isOutdated).length
  };
};

/**
 * Create complete ItemInformationResponse from processed items
 */
export const createItemInformationResponse = (
  items: ProcessedItemInfo[]
): ItemInformationResponse => {
  const currentItem = items.find(item => item.itemType === 'current');
  const referencedItems = items.filter(item => item.itemType !== 'current');

  // If no current item is explicitly marked, use the first item
  const finalCurrentItem = currentItem || items[0];
  const finalReferencedItems = currentItem ? referencedItems : items.slice(1);

  return {
    currentItem: finalCurrentItem || {
      id: 'unknown',
      name: 'No Current Item',
      path: '',
      latestVersion: 0,
      publishedVersion: null,
      isPublished: false,
      isOutdated: false,
      versionDifference: 0,
      itemType: 'current'
    },
    referencedItems: finalReferencedItems,
    summary: generateSummary(items)
  };
};

/**
 * Helper function to validate GraphQL response structure
 */
const validateResponse = (response: ItemQueryResult): {
  isValid: boolean;
  errors: string[];
  data: Record<string, unknown> | null;
} => {
  const errors: string[] = [];

  if (response.error) {
    errors.push(`Response error: ${String(response.error)}`);
    return { isValid: false, errors, data: null };
  }

  if (!response.data?.data) {
    errors.push('No data in response');
    return { isValid: false, errors, data: null };
  }

  if (response.data.errors && response.data.errors.length > 0) {
    response.data.errors.forEach((error: unknown) => {
      if (typeof error === 'object' && error !== null && 'message' in error) {
        errors.push(`GraphQL error: ${String((error as { message: unknown }).message)}`);
      } else {
        errors.push(`GraphQL error: ${String(error)}`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: response.data.data as Record<string, unknown>
  };
};

/**
 * Extract datasource references from item fields
 * This would analyze the item's fields to find references to other items
 */
export const extractDatasourceReferences = (item: AuthoringItemResponse): string[] => {
  const references: string[] = [];
  
  if (!item.fields?.nodes) {
    return references;
  }

  // Look for fields that might contain item references
  item.fields.nodes.forEach(field => {
    // Check for GUID patterns in field values (Sitecore item IDs)
    const guidRegex = /\{?[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}?/g;
    const matches = field.value.match(guidRegex);
    
    if (matches) {
      matches.forEach(match => {
        const cleanGuid = match.replace(/[{}]/g, '').toUpperCase();
        if (!references.includes(cleanGuid)) {
          references.push(cleanGuid);
        }
      });
    }
  });

  return references;
};

/**
 * Extract all related item IDs from the current item's data
 */
export const extractAllRelatedItems = (
  pageContext: unknown,
  authoringItem?: AuthoringItemResponse
): string[] => {
  const itemIds = new Set<string>();

  // Add current item ID from context
  const contextIds = extractItemIds(pageContext);
  contextIds.forEach(id => itemIds.add(id));

  // Add datasource references if we have authoring item data
  if (authoringItem) {
    const datasourceRefs = extractDatasourceReferences(authoringItem);
    datasourceRefs.forEach(id => itemIds.add(id));
  }

  return Array.from(itemIds);
};