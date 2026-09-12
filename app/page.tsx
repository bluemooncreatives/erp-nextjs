// `Route::get('/', 'FrontendController@index')->name('main.page')` sent visitors
// straight into the application; the proxy then routes them to login when they
// are not signed in.

import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/home');
}
