// `/paypal/cancel` - the PHP sent the customer to the membership page; there is
// no such page here, so they land back on their own details.

import { NextResponse, type NextRequest } from 'next/server';
import { ROUTES } from '@/lib/routes';

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL(ROUTES['contact.my_details'], request.url));
}
