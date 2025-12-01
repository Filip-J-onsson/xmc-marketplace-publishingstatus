// components/PublishedStatusTable.tsx
import React from 'react';
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  VStack,
  Text,
  Button,
  HStack,
  Box,
  Heading,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Spinner,
  Center,
  useToast
} from '@chakra-ui/react';
import { useItemInformation } from '../hooks/useItemInformation';
import { 
  PublishingStatusIndicator, 
  PublishingStatusSummary, 
  ItemTypeBadge 
} from './PublishingStatusIndicator';
import { formatGuidWithHyphens } from '../utils/dataProcessing';

export const PublishedStatusTable: React.FC = () => {
  const { 
    data, 
    items, 
    loading, 
    error, 
    refetch 
  } = useItemInformation();

  const toast = useToast();

  const copyToClipboard = async (text: string, description: string = 'Item ID') => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        // Use modern clipboard API
        await navigator.clipboard.writeText(text);
        toast({
          title: `${description} Copied!`,
          description: `${text} has been copied to clipboard`,
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
      } else {
        // Fallback for older browsers or non-secure context
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          toast({
            title: `${description} Copied!`,
            description: `${text} has been copied to clipboard`,
            status: 'success',
            duration: 2000,
            isClosable: true,
          });
        } else {
          throw new Error('Fallback copy failed');
        }
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast({
        title: 'Copy Failed',
        description: 'Unable to copy to clipboard. Please select and copy manually.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  if (loading) {
    return (
      <Center py={10}>
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text>Loading item information...</Text>
        </VStack>
      </Center>
    );
  }

  if (error) {
    return (
      <Alert status="error">
        <AlertIcon />
        <VStack align="start" spacing={2}>
          <AlertTitle>Error Loading Item Information</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button size="sm" colorScheme="red" onClick={refetch}>
            Try Again
          </Button>
        </VStack>
      </Alert>
    );
  }

  if (!data || items.length === 0) {
    return (
      <Alert status="info">
        <AlertIcon />
        <VStack align="start" spacing={2}>
          <AlertTitle>No Items Found</AlertTitle>
          <AlertDescription>
            No item information could be retrieved from the current context.
          </AlertDescription>
          <Button size="sm" colorScheme="blue" onClick={refetch}>
            Refresh
          </Button>
        </VStack>
      </Alert>
    );
  }

  return (
    <VStack spacing={6} align="stretch" p={6}>
      {/* Header */}
      <VStack align="start" spacing={3}>
        <Heading size="lg">Item Publishing Status</Heading>
        <Text color="gray.600" fontSize="sm">
          Current item and referenced items publishing information
        </Text>
        <Button colorScheme="blue" onClick={refetch} size="sm">
          Refresh
        </Button>
      </VStack>

      {/* Summary */}
      <Box>
        <Text fontSize="md" fontWeight="semibold" mb={3}>
          Publishing Summary
        </Text>
        <PublishingStatusSummary items={items} />
      </Box>

      {/* Current Item Section */}
      {data.currentItem && (
        <Box>
          <Heading size="md" mb={4}>Current Item</Heading>
          <Table variant="simple" size="md">
            <Thead>
              <Tr>
                <Th>Item Information</Th>
                <Th>Type</Th>
                <Th>Latest Version</Th>
                <Th>Published Version</Th>
                <Th>Publishing Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              <Tr>
                <Td>
                  <VStack align="start" spacing={1}>
                    <Text fontWeight="bold">{data.currentItem.name}</Text>
                    <Text fontSize="sm" color="gray.500">
                      {data.currentItem.path}
                    </Text>
                    <HStack spacing={2} align="center">
                      <Text fontSize="xs" fontFamily="mono" color="blue.600">
                        ID: {formatGuidWithHyphens(data.currentItem.id)}
                      </Text>
                      <Button 
                        size="xs" 
                        variant="ghost" 
                        onClick={() => copyToClipboard(formatGuidWithHyphens(data.currentItem.id), 'Item ID')}
                        title="Copy Item ID"
                      >
                        📋
                      </Button>
                    </HStack>
                    {data.currentItem.template && (
                      <Text fontSize="xs" color="gray.400">
                        Template: {data.currentItem.template}
                      </Text>
                    )}
                  </VStack>
                </Td>
                <Td>
                  <ItemTypeBadge itemType={data.currentItem.itemType} />
                </Td>
                <Td>
                  <Text fontWeight="semibold">v{data.currentItem.latestVersion}</Text>
                </Td>
                <Td>
                  <Text>
                    {data.currentItem.publishedVersion 
                      ? `v${data.currentItem.publishedVersion}`
                      : 'Not Published'
                    }
                  </Text>
                </Td>
                <Td>
                  <PublishingStatusIndicator 
                    item={data.currentItem} 
                    showDetails={false}
                  />
                </Td>
              </Tr>
            </Tbody>
          </Table>
        </Box>
      )}

      {/* Referenced Items Section */}
      {data.referencedItems.length > 0 && (
        <Box>
          <Heading size="md" mb={4}>
            Referenced Items ({data.referencedItems.length})
          </Heading>
          <Table variant="simple" size="md">
            <Thead>
              <Tr>
                <Th>Item Information</Th>
                <Th>Type</Th>
                <Th>Latest Version</Th>
                <Th>Published Version</Th>
                <Th>Publishing Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {data.referencedItems.map((item) => (
                <Tr key={item.id}>
                  <Td>
                    <VStack align="start" spacing={1}>
                      <Text fontWeight="medium" fontSize="sm">
                        {item.name}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {item.path}
                      </Text>
                      <HStack spacing={2} align="center">
                        <Text fontSize="xs" fontFamily="mono" color="blue.600">
                          ID: {formatGuidWithHyphens(item.id)}
                        </Text>
                        <Button 
                          size="xs" 
                          variant="ghost" 
                          onClick={() => copyToClipboard(formatGuidWithHyphens(item.id), 'Item ID')}
                          title="Copy Item ID"
                        >
                          📋
                        </Button>
                      </HStack>
                      {item.template && (
                        <Text fontSize="xs" color="gray.400">
                          Template: {item.template}
                        </Text>
                      )}
                    </VStack>
                  </Td>
                  <Td>
                    {item.referencedBy && item.referencedBy.length > 0 ? (
                      <VStack align="start" spacing={1}>
                        {item.referencedBy.map((parent) => (
                          <Text key={parent.id} fontSize="sm" color="gray.600">
                            <span aria-hidden="true">📌</span> {parent.displayName || parent.name}
                          </Text>
                        ))}
                      </VStack>
                    ) : (
                      <Text fontSize="sm" color="gray.400">-</Text>
                    )}
                  </Td>
                  <Td>
                    <ItemTypeBadge itemType={item.itemType} />
                  </Td>
                  <Td>
                    <Text fontWeight="semibold">
                      v{item.latestVersion}
                    </Text>
                  </Td>
                  <Td>
                    <Text>
                      {item.publishedVersion 
                        ? `v${item.publishedVersion}`
                        : 'Not Published'
                      }
                    </Text>
                  </Td>
                  <Td>
                    <PublishingStatusIndicator item={item} showDetails={false} />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      {/* Debug Information (can be removed in production) */}
      {process.env.NODE_ENV === 'development' && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" mb={2} color="gray.500">
            Debug Information
          </Text>
          <Text fontSize="xs" color="gray.400" fontFamily="mono">
            Total Items: {data.summary.totalItems} | 
            Published: {data.summary.publishedItems} | 
            Outdated: {data.summary.outdatedItems}
          </Text>
        </Box>
      )}
    </VStack>
  );
};