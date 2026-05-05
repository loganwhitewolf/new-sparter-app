import type { NextConfig } from 'next'
import { LEGACY_LOCALIZED_ROUTES } from './lib/routes'

const nextConfig: NextConfig = {
  async redirects() {
    return LEGACY_LOCALIZED_ROUTES.map((route) => ({
      source: route.source,
      destination: route.destination,
      permanent: true,
    }))
  },
}

export default nextConfig
