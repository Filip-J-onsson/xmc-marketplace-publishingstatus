// components/PublishingStatusIndicator.tsx
import React from 'react';
import {
  Badge,
  HStack,
  Icon,
  Tooltip,
  Text,
  VStack
} from '@chakra-ui/react';
import type { ProcessedItemInfo } from '../types/itemInformation';
import { getItemTypeColor, getItemTypeLabel } from '../utils/itemTypeUtils';

// Define our own icons with proper typing
interface IconProps {
  boxSize?: number | string;
  color?: string;
  [key: string]: unknown;
}

const CheckCircleIcon = (props: IconProps) => (
  <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const WarningIcon = (props: IconProps) => (
  <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

const XCircleIcon = (props: IconProps) => (
  <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
  </svg>
);

const TimeIcon = (props: IconProps) => (
  <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
  </svg>
);

interface PublishingStatusIndicatorProps {
  item: ProcessedItemInfo;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const PublishingStatusIndicator: React.FC<PublishingStatusIndicatorProps> = ({
  item,
  showDetails = false,
  size = 'md'
}) => {
  const getStatusConfig = () => {
    if (!item.isPublished) {
      return {
        status: 'Not Published',
        colorScheme: 'red',
        icon: XCircleIcon,
        description: 'This item has not been published to the live environment'
      };
    }

    if (item.isOutdated) {
      return {
        status: 'Outdated',
        colorScheme: 'orange',
        icon: WarningIcon,
        description: `Published version (${item.publishedVersion}) is behind latest version (${item.latestVersion})`
      };
    }

    return {
      status: 'Up-to-date',
      colorScheme: 'green',
      icon: CheckCircleIcon,
      description: `Published version (${item.publishedVersion}) matches latest version (${item.latestVersion})`
    };
  };

  const statusConfig = getStatusConfig();

  const StatusBadge = (
    <Badge
      colorScheme={statusConfig.colorScheme}
      size={size}
      display="flex"
      alignItems="center"
      gap={1}
    >
      <Icon as={statusConfig.icon} boxSize={3} />
      {statusConfig.status}
    </Badge>
  );

  if (!showDetails) {
    return (
      <Tooltip label={statusConfig.description} placement="top">
        {StatusBadge}
      </Tooltip>
    );
  }

  return (
    <VStack align="start" spacing={1}>
      {StatusBadge}
      {showDetails && (
        <HStack spacing={3} fontSize="sm" color="gray.600">
          <HStack spacing={1}>
            <Icon as={TimeIcon} boxSize={3} />
            <Text>Latest: v{item.latestVersion}</Text>
          </HStack>
          {item.isPublished && (
            <HStack spacing={1}>
              <Icon as={CheckCircleIcon} boxSize={3} color="green.500" />
              <Text>Published: v{item.publishedVersion}</Text>
            </HStack>
          )}
          {item.versionDifference > 0 && (
            <HStack spacing={1}>
              <Icon as={WarningIcon} boxSize={3} color="orange.500" />
              <Text>{item.versionDifference} version{item.versionDifference > 1 ? 's' : ''} behind</Text>
            </HStack>
          )}
        </HStack>
      )}
    </VStack>
  );
};

// Component for showing a summary of multiple items' publishing status
interface PublishingStatusSummaryProps {
  items: ProcessedItemInfo[];
}

export const PublishingStatusSummary: React.FC<PublishingStatusSummaryProps> = ({ items }) => {
  const summary = {
    total: items.length,
    published: items.filter(item => item.isPublished).length,
    unpublished: items.filter(item => !item.isPublished).length,
    outdated: items.filter(item => item.isOutdated).length,
    upToDate: items.filter(item => item.isPublished && !item.isOutdated).length
  };

  return (
    <HStack spacing={4} wrap="wrap">
      <Badge colorScheme="blue" size="lg">
        {summary.total} Total Items
      </Badge>
      
      {summary.upToDate > 0 && (
        <Badge colorScheme="green" size="lg">
          <Icon as={CheckCircleIcon} boxSize={3} mr={1} />
          {summary.upToDate} Up-to-date
        </Badge>
      )}
      
      {summary.outdated > 0 && (
        <Badge colorScheme="orange" size="lg">
          <Icon as={WarningIcon} boxSize={3} mr={1} />
          {summary.outdated} Outdated
        </Badge>
      )}
      
      {summary.unpublished > 0 && (
        <Badge colorScheme="red" size="lg">
          <Icon as={XCircleIcon} boxSize={3} mr={1} />
          {summary.unpublished} Not Published
        </Badge>
      )}
    </HStack>
  );
};

// Component for displaying item type
interface ItemTypeBadgeProps {
  itemType: ProcessedItemInfo['itemType'];
  size?: 'sm' | 'md' | 'lg';
}

export const ItemTypeBadge: React.FC<ItemTypeBadgeProps> = ({ 
  itemType, 
  size = 'md' 
}) => {
  return (
    <Badge
      colorScheme={getItemTypeColor(itemType)}
      size={size}
      textTransform="capitalize"
    >
      {getItemTypeLabel(itemType)}
    </Badge>
  );
};