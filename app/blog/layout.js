/**
 * Blog segment layout — shared chrome for all future blog posts.
 *
 * Added by Plan 03-02 (DOG-04). First post:
 * app/blog/claude-code-beachhead/page.js.
 *
 * Design: CSS tokens only per .impeccable.md. The max-w-3xl prose column
 * matches /pricing so brand chrome feels consistent across launch surfaces.
 */

import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

export default function BlogLayout({ children }) {
  return (
    <div className="min-h-screen bg-surface-primary text-text-primary">
      <PublicNavbar />
      <main className="px-6 pb-20 pt-28">
        <article className="mx-auto max-w-3xl">{children}</article>
      </main>
      <PublicFooter />
    </div>
  );
}
