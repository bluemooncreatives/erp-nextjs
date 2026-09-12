import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Development serves hot reloading over a WebSocket and rejects the handshake
  // when the page's origin is not on this list, answering with a bare
  // "Unauthorized" that the browser reports as ERR_INVALID_HTTP_RESPONSE. The
  // client then never finishes booting: the page renders but nothing hydrates,
  // so every button and dropdown is inert. Next allows `localhost` by default;
  // opening the same server on 127.0.0.1 (or over the LAN) needs it spelled out.
  allowedDevOrigins: ['127.0.0.1', '[::1]'],

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
