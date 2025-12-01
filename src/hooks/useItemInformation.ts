// hooks/useItemInformation.ts
import { useState, useEffect, useCallback } from 'react';
import { useMarketplaceClient } from '../utils/hooks/useMarketplaceClient';

import { 
  getItemsFromAuthoring, 
  getItemsFromLive, 
  resolveLocalDatasourcePaths 
} from '../utils/graphqlQueries';
import { 
  extractItemIdsWithLocalPaths,
  processItemData, 
  createItemInformationResponse
} from '../utils/dataProcessing';
import type { 
  ItemInformationResponse, 
  ProcessedItemInfo
} from '../types/itemInformation';

export interface UseItemInformationResult {
  /** The processed item information response */
  data: ItemInformationResponse | null;
  /** Individual processed items for direct access */
  items: ProcessedItemInfo[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Function to manually refetch data */
  refetch: () => Promise<void>;
  /** Function to refetch only a specific set of items */
  refetchItems: (itemIds: string[]) => Promise<void>;
  /** Function to force refresh (clears cache and refetches) */
  forceRefresh: () => void;
}

export const useItemInformation = (): UseItemInformationResult => {

  const { client, error: clientError, isInitialized } = useMarketplaceClient();
  const [data, setData] = useState<ItemInformationResponse | null>(null);
  const [items, setItems] = useState<ProcessedItemInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItemInformation = useCallback(async (specificItemIds?: string[]) => {
    if (!client || !isInitialized) {
      setError('Marketplace client not initialized');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let itemIds: string[] = [];
      let currentItemId: string | undefined;
      let pageContext: unknown = null;
      let localPathsToResolve: string[] = [];
      let currentPagePath = '';
      let language = 'en'; // Default fallback

      if (specificItemIds && specificItemIds.length > 0) {
        itemIds = specificItemIds;
        // For specific items, assume the first one is current (could be improved)
        currentItemId = specificItemIds[0];
      } else {
        // Get current context to identify items
        const { data: contextData } = await client.query('pages.context');
        pageContext = contextData;
        
        // Extract ALL items from context (current + editable items)
        const extractionResult = extractItemIdsWithLocalPaths(pageContext);
        itemIds = extractionResult.itemIds;
        localPathsToResolve = extractionResult.localPathsToResolve;
        currentPagePath = extractionResult.currentPagePath;
        language = extractionResult.language;
        
        if (itemIds.length === 0) {
          throw new Error('No item IDs found in current context');
        }
        
        // The first item should be the current page item (extractItemIds puts it first)
        currentItemId = itemIds[0];
      }


      // Get application context to extract sitecoreContextId (official approach)
      let sitecoreContextId: string | undefined;
      try {
        const { data: appContext } = await client.query('application.context');
        
        // Extract sitecoreContextId according to official documentation
        sitecoreContextId = appContext?.resourceAccess?.[0]?.context?.preview;
        
        if (!sitecoreContextId) {
          // Try alternative locations as fallback
          sitecoreContextId = appContext?.resourceAccess?.[0]?.context?.live ||
                              (appContext as Record<string, unknown>)?.sitecoreContextId as string ||
                              (appContext as Record<string, unknown>)?.contextId as string;
        }
        
        // If still not found, try to extract from any resourceAccess context
        if (!sitecoreContextId && appContext?.resourceAccess) {
          for (const resource of appContext.resourceAccess as Array<Record<string, unknown>>) {
            if (resource?.context) {
              const context = resource.context as Record<string, unknown>;
              sitecoreContextId = context.preview as string || 
                                 context.live as string || 
                                 context.master as string;
              if (sitecoreContextId) break;
            }
          }
        }
        
      } catch (error) {
        console.error('Failed to get application context:', error);
      }

      // Resolve local datasource paths to item IDs if needed
      if (localPathsToResolve.length > 0 && sitecoreContextId) {
        try {
          const resolvedPaths = await resolveLocalDatasourcePaths(
            client, 
            localPathsToResolve, 
            currentPagePath, 
            sitecoreContextId,
            language
          );
          
          // Add resolved item IDs to the list
          Object.values(resolvedPaths).forEach(resolvedId => {
            if (resolvedId && !itemIds.includes(resolvedId)) {
              itemIds.push(resolvedId);
            }
          });
        } catch (error) {
          console.error('Error resolving local datasource paths:', error);
        }
      }

      // Query all items (from context) for both authoring and live data
      const [authoringResult, liveResult] = await Promise.all([
        getItemsFromAuthoring(client, itemIds, sitecoreContextId, language),
        getItemsFromLive(client, itemIds, sitecoreContextId, language)
      ]);

      // STEP 2: Extract nested references from datasource fields (like FAQ items in multilists)
      const nestedItemIds: string[] = [];
      const excludedPaths = ['/sitecore/system/', '/sitecore/templates/', '/sitecore/layout/'];
      // Track which parent items reference which nested items
      const referencedByMap = new Map<string, Array<{ id: string; name: string; path: string }>>();
      
      if (authoringResult?.data?.data) {
        const authoringData = authoringResult.data.data as Record<string, any>;
        Object.values(authoringData).forEach((item: any) => {
          if (item?.fields?.nodes) {
            // Find displayName field if it exists
            const displayNameField = item.fields.nodes.find((f: any) => f.name === '__Display name' || f.name === 'Display Name');
            
            const parentInfo = {
              id: item.itemId?.replace(/[{}]/g, '').toUpperCase() || '',
              name: item.name || 'Unknown',
              displayName: displayNameField?.value || undefined,
              path: item.path || ''
            };
            
            
            // Extract GUIDs from field values, but only from content-related fields
            item.fields.nodes.forEach((field: any) => {
              if (field.value && typeof field.value === 'string') {
                // Skip common system/settings fields
                const systemFields = ['__Created', '__Updated', '__Owner', '__Lock', '__Revision', '__Workflow', '__Standard Values', '__Sortorder'];
                if (systemFields.some(sf => field.name.includes(sf))) {
                  return; // Skip system fields
                }
                
                const guidRegex = /\{?[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}?/g;
                const matches = field.value.match(guidRegex);
                
                if (matches) {
                  matches.forEach((match: string) => {
                    const cleanGuid = match.replace(/[{}]/g, '').toUpperCase();
                    
                    // Track the parent relationship for ALL referenced items (not just new ones)
                    if (!referencedByMap.has(cleanGuid)) {
                      referencedByMap.set(cleanGuid, []);
                    }
                    const existingRefs = referencedByMap.get(cleanGuid)!;
                    // Avoid duplicates
                    if (!existingRefs.some(ref => ref.id === parentInfo.id)) {
                      existingRefs.push(parentInfo);
                    }
                    
                    // Only add to nested items list if not already in our main list
                    if (!itemIds.includes(cleanGuid) && !nestedItemIds.includes(cleanGuid)) {
                      nestedItemIds.push(cleanGuid);
                    }
                  });
                }
              }
            });
          }
        });
      }
      
      // Now query the nested items to check their paths and filter out system items
      if (nestedItemIds.length > 0) {
        const [nestedAuthoringResult] = await Promise.all([
          getItemsFromAuthoring(client, nestedItemIds, sitecoreContextId, language)
        ]);
        
        // Filter out system items based on their paths
        const validNestedIds: string[] = [];
        if (nestedAuthoringResult?.data?.data) {
          const nestedAuthoringData = nestedAuthoringResult.data.data as Record<string, any>;
          Object.entries(nestedAuthoringData).forEach(([, nestedItem]: [string, any]) => {
            const itemPath = nestedItem?.path || '';
            const itemId = nestedItem?.itemId || '';
            
            // Check if item path starts with any excluded path
            const isSystemItem = excludedPaths.some(excludedPath => itemPath.startsWith(excludedPath));
            
            if (!isSystemItem && itemPath) {
              const cleanId = itemId.replace(/[{}]/g, '').toUpperCase();
              validNestedIds.push(cleanId);
            }
          });
        }
        
        // Only proceed if we have valid items
        if (validNestedIds.length === 0) {
          console.log('⚠️ No valid nested content items found');
        }
        
        nestedItemIds.length = 0;
        nestedItemIds.push(...validNestedIds);
      }

      // Query validated nested items for live data and merge results
      if (nestedItemIds.length > 0) {
        const [nestedLiveResult] = await Promise.all([
          getItemsFromLive(client, nestedItemIds, sitecoreContextId, language)
        ]);

        // We already have authoring data from validation, now get it properly with all fields
        const [nestedAuthoringFullResult] = await Promise.all([
          getItemsFromAuthoring(client, nestedItemIds, sitecoreContextId, language)
        ]);

        // Merge nested results with original results
        if (nestedAuthoringFullResult?.data?.data && authoringResult?.data?.data) {
          const authoringData = authoringResult.data.data as Record<string, any>;
          const nestedAuthoringData = nestedAuthoringFullResult.data.data as Record<string, any>;
          const startIndex = Object.keys(authoringData).length;
          
          Object.entries(nestedAuthoringData).forEach(([, value], index) => {
            authoringData[`item${startIndex + index}`] = value;
          });
        }

        if (nestedLiveResult?.data?.data && liveResult?.data?.data) {
          const liveData = liveResult.data.data as Record<string, any>;
          const nestedLiveData = nestedLiveResult.data.data as Record<string, any>;
          const startIndex = Object.keys(liveData).length;
          
          Object.entries(nestedLiveData).forEach(([, value], index) => {
            liveData[`item${startIndex + index}`] = value;
          });
        }

        // Add nested IDs to our itemIds array
        itemIds.push(...nestedItemIds);
      }

      // Process the data
      const processedItems = processItemData(
        authoringResult,
        liveResult,
        itemIds,
        currentItemId,
        referencedByMap
      );

      // Create the complete response
      const itemInformationResponse = createItemInformationResponse(processedItems);

      setData(itemInformationResponse);
      setItems(processedItems);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Error fetching item information:', err);
      setError(errorMessage);
      setData(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [client, isInitialized]);

  const refetchItems = useCallback(async (itemIds: string[]) => {
    await fetchItemInformation(itemIds);
  }, [fetchItemInformation]);

  const refetch = useCallback(async () => {
    await fetchItemInformation();
  }, [fetchItemInformation]);

  const forceRefresh = useCallback(() => {
    setData(null);
    setItems([]);
    setError(null);
    fetchItemInformation();
  }, [fetchItemInformation]);

  // Initial load
  useEffect(() => {
    if (isInitialized && !clientError) {
      fetchItemInformation();
    } else if (clientError) {
      setError(clientError.message || 'Client initialization error');
    }
  }, [isInitialized, clientError, fetchItemInformation]);

  return {
    data,
    items,
    loading,
    error,
    refetch,
    refetchItems,
    forceRefresh
  };
};

/**
 * Hook for getting information about a specific set of items
 */
export const useSpecificItemsInformation = (itemIds: string[]): UseItemInformationResult => {
  const { client, error: clientError, isInitialized } = useMarketplaceClient();
  const [data, setData] = useState<ItemInformationResponse | null>(null);
  const [items, setItems] = useState<ProcessedItemInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSpecificItems = useCallback(async () => {
    if (!client || !isInitialized || itemIds.length === 0) {
      setError(itemIds.length === 0 ? 'No item IDs provided' : 'Marketplace client not initialized');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [authoringResult, liveResult] = await Promise.all([
        getItemsFromAuthoring(client, itemIds, undefined, 'en'),
        getItemsFromLive(client, itemIds, undefined, 'en')
      ]);

      const processedItems = processItemData(
        authoringResult,
        liveResult,
        itemIds,
        itemIds[0]
      );

      const itemInformationResponse = createItemInformationResponse(processedItems);

      setData(itemInformationResponse);
      setItems(processedItems);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Error fetching specific items:', err);
      setError(errorMessage);
      setData(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [client, isInitialized, itemIds]);

  const refetch = useCallback(async () => {
    await fetchSpecificItems();
  }, [fetchSpecificItems]);

  const refetchItems = useCallback(async () => {
    await fetchSpecificItems();
  }, [fetchSpecificItems]);

  const forceRefresh = useCallback(async () => {
    await fetchSpecificItems();
  }, [fetchSpecificItems]);

  useEffect(() => {
    if (isInitialized && !clientError && itemIds.length > 0) {
      fetchSpecificItems();
    } else if (clientError) {
      setError(clientError.message || 'Client initialization error');
    }
  }, [isInitialized, clientError, fetchSpecificItems, itemIds.length]);

  return {
    data,
    items,
    loading,
    error,
    refetch,
    refetchItems,
    forceRefresh
  };
};