import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import '@fontsource-variable/manrope'
import stylesheet from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      { title: 'FORM' },
      {
        name: 'description',
        content:
          'A private dashboard for your WHOOP recovery, sleep, and strain.',
      },
      { name: 'theme-color', content: '#0f100e' },
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
    <main className="static-page">
      <h1>Page not found</h1>
      <p>There is nothing at this address.</p>
      <a href="/">Back to your dashboard</a>
    </main>
  ),
  errorComponent: () => (
    <main className="static-page">
      <h1>Something went wrong</h1>
      <p>Your data is safe. Reload to try again.</p>
      <a href="/">Reload the dashboard</a>
    </main>
  ),
})
