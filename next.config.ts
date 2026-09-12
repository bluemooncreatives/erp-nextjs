import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `forbidden()` / `unauthorized()` back the ported `permission` middleware,
  // which answered with abort(401)/abort(403) in the Laravel stack.
  experimental: {
    authInterrupts: true,
  },

  // The TailAdmin UI imports its icon set as React components from .svg files.
  turbopack: {
    // The repo root is this directory; without this Next walks up to the PHP
    // project's package-lock.json and warns.
    root: __dirname,
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    return config;
  },

  // Product images, logos and invoice uploads keep the paths the PHP app used.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'ui-avatars.com' }],
  },

  serverExternalPackages: ['mysql2', 'bcryptjs', 'nodemailer'],
};

export default nextConfig;
