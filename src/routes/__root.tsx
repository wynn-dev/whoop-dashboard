import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import '@fontsource-variable/manrope'
import '@fontsource/dm-mono/400.css'
import stylesheet from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'FORM — Your personal WHOOP dashboard' },
      {
        name: 'description',
        content:
          'A clearer view of your recovery, sleep, and daily performance.',
      },
      { name: 'theme-color', content: '#11130f' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
    links: [{ rel: 'stylesheet', href: stylesheet }],
  }),
  component: () => (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  ),
  notFoundComponent: () => (
    <main className="p-12">
      <h1 className="text-2xl">Page not found</h1>
      <a className="text-primary underline" href="/">
        Back to your dashboard
      </a>
    </main>
  ),
  errorComponent: () => (
    <main className="p-12">
      <h1 className="text-2xl">Something went wrong</h1>
      <p className="mt-3 text-muted-foreground">
        Refresh the page to try again.
      </p>
      <a className="text-primary underline" href="/">
        Reload dashboard
      </a>
    </main>
  ),
})
