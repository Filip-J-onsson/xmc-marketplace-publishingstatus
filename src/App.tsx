import { useEffect } from "react";
import { Box } from "@chakra-ui/react";
import { useMarketplaceClient } from "./utils/hooks/useMarketplaceClient";
import { PublishedStatusTable } from "./components/PublishedStatusTable";

export default function App() {
  const { client, error, isInitialized } = useMarketplaceClient();

  useEffect(() => {
    if (!error && isInitialized && client) {
      console.log("Marketplace client initialized successfully.");
      // Make a query to retrieve the application context
      client
        .query("application.context")
        .then((res) => {
          console.log("Success retrieving application.context:", res.data);
        })
        .catch((error) => {
          console.error("Error retrieving application.context:", error);
        });
    } else if (error) {
      console.error("Error initializing Marketplace client:", error);
    }
  }, [client, error, isInitialized]);

  return (
    <Box>
      <PublishedStatusTable />
    </Box>
  );
}
