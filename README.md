# Published Status Callback App

A Sitecore Marketplace app that displays the publishing status of content items and their referenced components.

## Features

- **Current Item Display**: Shows the currently viewed content item
- **Referenced Items**: Lists all items referenced by the current page (via datasources, components, etc.)
- **Publishing Status**: Displays latest version vs published version for each item
- **Blok Design**: Uses Sitecore Blok design system for consistent UI

## Table Columns

- **Item**: Item name and path
- **Item ID**: Unique identifier
- **Latest**: Most recent version number
- **Published**: Currently published version number
- **Actions**: Copy ID button for each item

## Development Setup

1. **Prerequisites**:
   - Node.js 16+
   - npm 10+
   - Sitecore Marketplace app configured

2. **Installation**:
   ```bash
   npm install
   ```

3. **Environment Configuration**:
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit .env and add your Sitecore Experience Edge API token
   # Get your token from: Sitecore Cloud Portal -> Experience Edge -> API Keys
   ```

4. **Development**:
   ```bash
   npm run dev
   ```
   The app will run on `https://localhost:5173` (HTTPS required for Sitecore integration)
   
   ⚠️ **First time setup**: The system will automatically create trusted certificates. You may be prompted to allow certificate installation. See [HTTPS-SETUP.md](HTTPS-SETUP.md) for details.

5. **Build**:
   ```bash
   npm run build
   ```

## Environment Variables

The following environment variables are required:

- `VITE_SITECORE_EDGE_TOKEN`: Your Sitecore Experience Edge API token
  - Get this from: Sitecore Cloud Portal → Experience Edge → API Keys
  - Required for querying published content versions

Optional environment variables:

- `VITE_SITECORE_EDGE_ENDPOINT`: Custom Experience Edge endpoint URL
  - Default: `https://edge.sitecorecloud.io/api/graphql/v1`

## Deployment to Sitecore

### Step 1: Configure Your Marketplace App
1. Go to [Sitecore Cloud Portal](https://portal.sitecorecloud.io/)
2. Create a new Marketplace app or configure an existing one
3. Set the app URL to `https://localhost:5173` (HTTPS required for development)
4. Choose appropriate extension points:
   - **Page builder context panel**: Best for this app - shows in sidebar when editing pages
   - **Full screen**: Shows as a full-page app in XM Cloud
   - **Standalone**: Shows in Cloud Portal home page

### Step 2: Open App in Sitecore
1. In XM Cloud, go to your configured extension point
2. Find your app in the Apps dropdown or marketplace apps section
3. The app will load in the iframe and communicate with Sitecore
4. Check browser console in the Sitecore extension point (not localhost) for logs

### Step 3: Production Deployment
1. Build the app: `npm run build`
2. Deploy the `dist` folder to your hosting service
3. Update the app URL in Cloud Portal to your production URL
4. The app will automatically detect the Sitecore environment and use real data

### Extension Point Recommendations
- **Page builder context panel**: Perfect for this publishing status app
- **Full screen**: Good for comprehensive publishing dashboards
- **Dashboard widget**: Ideal for summary publishing metrics

## Architecture

### Components
- `App.tsx`: Main application component
- `PublishedStatusTable.tsx`: Table component displaying item status
- `useMarketplaceClient.ts`: Hook for Marketplace SDK client
- `useXMCClient.ts`: Hook for XM Cloud client

### APIs Used
- **Marketplace SDK**:
  - `application.context`: Get app context
  - `pages.context`: Get current page information
  - `host.user`: Get user information

- **XM Cloud APIs** (planned):
  - Live endpoint queries for published versions
  - Content API for item information

## Current Implementation

The app currently uses mock data for demonstration. To connect to real Sitecore data:

1. Implement authentication in `useXMCClient.ts`
2. Replace mock data in `PublishedStatusTable.tsx` with actual API calls
3. Parse `pages.context` to discover referenced items
4. Query XM Cloud APIs for version information

## Blok Design System

This app uses the Sitecore Blok design system:
- Chakra UI v2 components
- Sitecore-specific theming
- Consistent visual design
- Responsive layout

## Future Enhancements

- Real-time publishing status updates
- Bulk operations (publish multiple items)
- Version history visualization
- Advanced filtering and search
- Integration with Sitecore's publishing pipeline
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
