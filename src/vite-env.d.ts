/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITECORE_EDGE_TOKEN: string
  readonly VITE_SITECORE_EDGE_ENDPOINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
