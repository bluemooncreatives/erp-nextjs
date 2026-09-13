// Redirect /pos → /pos/pos-order-products so that the URL the navigation
// `match` array marks active also answers with a real page rather than a 404.
// The POS checkout itself lives at the sub-path because the (print) receipt
// group needs its own /pos/receipt/[id] at that URL without a path clash.

import { redirect } from 'next/navigation';
import { ROUTES } from '@/lib/routes';

export default function PosRedirect() {
  redirect(ROUTES['pos.index']);
}
