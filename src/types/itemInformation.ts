// types/itemInformation.ts

export type ItemType = 'current' | 'datasource' | 'link' | 'reference';

export interface ProcessedItemInfo {
  id: string;
  name: string;
  path: string;
  latestVersion: number;
  publishedVersion: number | null;
  isPublished: boolean;
  isOutdated: boolean;
  versionDifference: number;
  itemType: ItemType;
  template?: string;
  language?: string;
  referencedBy?: Array<{
    id: string;
    name: string;
    displayName?: string;
    path: string;
  }>;
}

export interface ItemInformationSummary {
  totalItems: number;
  publishedItems: number;
  unpublishedItems: number;
  outdatedItems: number;
}

export interface ItemInformationResponse {
  currentItem: ProcessedItemInfo;
  referencedItems: ProcessedItemInfo[];
  summary: ItemInformationSummary;
}

export interface AuthoringItemResponse {
  itemId: string;
  name: string;
  path: string;
  version: number;
  template?: {
    name: string;
  };
  language?: {
    name: string;
  };
  fields?: {
    nodes: Array<{
      name: string;
      value: string;
    }>;
  };
}

export interface LiveItemResponse {
  id: string;
  name: string;
  version: number;
  language?: {
    name: string;
  };
}

export interface GraphQLAuthoringResponse {
  data?: Record<string, AuthoringItemResponse>;
  errors?: Array<{
    message: string;
    locations?: Array<{
      line: number;
      column: number;
    }>;
    path?: string[];
  }>;
}

export interface GraphQLLiveResponse {
  data?: Record<string, LiveItemResponse>;
  errors?: Array<{
    message: string;
    locations?: Array<{
      line: number;
      column: number;
    }>;
    path?: string[];
  }>;
}

export interface ItemQueryResult {
  data?: {
    data?: Record<string, unknown>;
    errors?: unknown[];
  };
  error?: unknown;
}