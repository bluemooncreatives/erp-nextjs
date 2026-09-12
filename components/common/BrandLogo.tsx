'use client';

// The configured logo, falling back to the company name.
//
// `general_settings.logo` points at a file under `public/uploads`, which an
// installation may have removed or never uploaded. A plain <img> would then
// render as a broken-image glyph on the login screen and in the sidebar, so the
// failure is caught and the name shown instead.

import Image from 'next/image';
import React, { useState } from 'react';

export function BrandLogo({
  src,
  name,
  width,
  height,
  className,
  fallbackClassName = 'text-lg font-semibold',
}: {
  src: string | null;
  name: string;
  width: number;
  height: number;
  className?: string;
  fallbackClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <span className={fallbackClassName}>{name}</span>;
  }

  return (
    <Image
      src={src}
      alt={name}
      width={width}
      height={height}
      className={className}
      onError={() => setFailed(true)}
      unoptimized
    />
  );
}
