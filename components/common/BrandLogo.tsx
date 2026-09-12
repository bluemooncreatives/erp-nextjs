'use client';

// The configured logo, falling back to the company name.
//
// `general_settings.logo` points at a file under `public/uploads`, which an
// installation may have removed or never uploaded. A plain <img> would then
// render as a broken-image glyph on the login screen and in the sidebar, so the
// failure is caught and the name shown instead.

import Image from 'next/image';
import React, { useEffect, useRef, useState } from 'react';

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
  const imageRef = useRef<HTMLImageElement>(null);

  // The image is in the server-rendered HTML, so the browser may have already
  // tried and failed to load it before React attached its `onError`. A finished
  // image with no intrinsic width is one that failed, which is the only signal
  // left by then.
  useEffect(() => {
    const element = imageRef.current;
    if (element?.complete && element.naturalWidth === 0) setFailed(true);
  }, [src]);

  if (!src || failed) {
    return <span className={fallbackClassName}>{name}</span>;
  }

  return (
    <Image
      ref={imageRef}
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
