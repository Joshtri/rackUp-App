interface ImportMetaEnv {
  /** Base URL of the RackUp API, e.g. https://rackup-api.vercel.app */
  readonly VITE_API_URL?: string
  /** Path of the hidden login page. Default /login-secret */
  readonly VITE_LOGIN_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
