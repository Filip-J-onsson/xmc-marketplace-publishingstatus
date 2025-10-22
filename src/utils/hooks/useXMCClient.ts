// utils/hooks/useXMCClient.ts
import { experimental_createXMCClient, experimental_XMC } from "@sitecore-marketplace-sdk/xmc";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useMarketplaceClient } from "./useMarketplaceClient";

export interface XMCClientState {
  client: experimental_XMC | null;
  error: Error | null;
  isLoading: boolean;
  isInitialized: boolean;
}

export interface UseXMCClientOptions {
  /**
   * Number of retry attempts when initialization fails
   * @default 3
   */
  retryAttempts?: number;
  /**
   * Delay between retry attempts in milliseconds
   * @default 1000
   */
  retryDelay?: number;
  /**
   * Whether to automatically initialize the client
   * @default true
   */
  autoInit?: boolean;
}

const DEFAULT_OPTIONS: Required<UseXMCClientOptions> = {
  retryAttempts: 3,
  retryDelay: 1000,
  autoInit: true,
};

let xmcClient: experimental_XMC | undefined = undefined;

async function getXMCClient(): Promise<experimental_XMC> {
  if (xmcClient) {
    return xmcClient;
  }

  // Get access token - for now, return empty string
  // This will need to be updated based on actual authentication mechanism
  const getAccessToken = async () => {
    return '';
  };

  const config = {
    getAccessToken,
  };

  xmcClient = await experimental_createXMCClient(config);
  return xmcClient;
}

export function useXMCClient(options: UseXMCClientOptions = {}) {
  const { client: marketplaceClient } = useMarketplaceClient();

  // Memoize the options to prevent unnecessary re-renders
  const opts = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [
    options,
  ]);

  const [state, setState] = useState<XMCClientState>({
    client: null,
    error: null,
    isLoading: false,
    isInitialized: false,
  });

  // Use ref to track if we're currently initializing to prevent race conditions
  const isInitializingRef = useRef(false);

  const initializeClient = useCallback(
    async (attempt = 1): Promise<void> => {
      // Check if we're in a Sitecore environment first
      const isInSitecore = window !== window.parent;
      
      if (!isInSitecore) {
        setState({
          client: null,
          error: new Error('Not in Sitecore environment - running in standalone mode'),
          isLoading: false,
          isInitialized: false,
        });
        return;
      }

      if (!marketplaceClient) return;

      // Use functional state update to check current state without dependencies
      let shouldProceed = false;
      setState((prev) => {
        if (prev.isLoading || prev.isInitialized || isInitializingRef.current) {
          return prev;
        }
        shouldProceed = true;
        isInitializingRef.current = true;
        return { ...prev, isLoading: true, error: null };
      });

      if (!shouldProceed) return;

      try {
        const client = await getXMCClient();
        setState({
          client,
          error: null,
          isLoading: false,
          isInitialized: true,
        });
      } catch (error) {
        if (attempt < opts.retryAttempts) {
          await new Promise((resolve) => setTimeout(resolve, opts.retryDelay));
          return initializeClient(attempt + 1);
        }
        setState({
          client: null,
          error: error instanceof Error ? error : new Error('Failed to initialize XMC Client'),
          isLoading: false,
          isInitialized: false,
        });
      } finally {
        isInitializingRef.current = false;
      }
    },
    [opts.retryAttempts, opts.retryDelay, marketplaceClient]
  );

  // Removed state dependencies
  useEffect(() => {
    if (opts.autoInit && marketplaceClient) {
      initializeClient();
    }
    return () => {
      isInitializingRef.current = false;
      setState({
        client: null,
        error: null,
        isLoading: false,
        isInitialized: false,
      });
    };
  }, [opts.autoInit, initializeClient, marketplaceClient]);

  // Memoize the return value to prevent object recreation on every render
  return useMemo(() => ({
    ...state,
    initialize: initializeClient,
  }), [state, initializeClient]);
}
