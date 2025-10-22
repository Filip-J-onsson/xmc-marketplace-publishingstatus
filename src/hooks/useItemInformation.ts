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

      console.log('Fetching information for initial items:', itemIds);
      console.log('Current item ID identified as:', currentItemId);

      // Get application context to extract sitecoreContextId (official approach)
      let sitecoreContextId: string | undefined;
      try {
        const { data: appContext } = await client.query('application.context');
        console.log('Application context retrieved:', appContext);
        
        // Extract sitecoreContextId according to official documentation
        sitecoreContextId = appContext?.resourceAccess?.[0]?.context?.preview;
        
        if (!sitecoreContextId) {
          console.log('Sitecore Context ID not found in preview context, trying other locations...');
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
        
        console.log('Extracted sitecore context ID:', sitecoreContextId);
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

      // Process the data
      const processedItems = processItemData(
        authoringResult,
        liveResult,
        itemIds,
        currentItemId
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