'use client';

import { useEffect, useState } from 'react';
import { inventoryLocationProducts } from './actions';
import type { PickableProduct } from './line-picker';

export function useLocationProducts(initial: PickableProduct[], initialLocation: string, kind: 'transfer' | 'adjustment', editing: boolean) {
  const [location, setLocation] = useState(initialLocation);
  const [result, setResult] = useState({ location: initialLocation, products: initial, error: '' });
  useEffect(() => {
    let current = true;
    inventoryLocationProducts(location, kind, editing).then((products) => {
      if (current) setResult({ location, products, error: '' });
    }).catch(() => {
      if (current) setResult({ location, products: [], error: 'Could not load stock for this location. Select it again to retry.' });
    });
    return () => { current = false; };
  }, [location, kind, editing]);
  return { location, setLocation, products: result.location === location ? result.products : [], loading: result.location !== location, error: result.error };
}
