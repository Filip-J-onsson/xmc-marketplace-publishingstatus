// utils/itemTypeUtils.ts
import type { ProcessedItemInfo } from '../types/itemInformation';

/**
 * Get the color scheme for an item type badge
 */
export const getItemTypeColor = (itemType: ProcessedItemInfo['itemType']): string => {
  switch (itemType) {
    case 'current':
      return 'blue';
    case 'datasource':
      return 'purple';
    case 'link':
      return 'cyan';
    case 'reference':
      return 'gray';
    default:
      return 'gray';
  }
};

/**
 * Get a human-readable label for an item type
 */
export const getItemTypeLabel = (type: ProcessedItemInfo['itemType']): string => {
  switch (type) {
    case 'current':
      return 'Current Item';
    case 'datasource':
      return 'Datasource';
    case 'link':
      return 'Link';
    case 'reference':
      return 'Reference';
    default:
      return 'Unknown';
  }
};