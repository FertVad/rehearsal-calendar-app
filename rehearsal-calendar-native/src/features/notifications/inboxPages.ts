/**
 * The inbox read page by page (cause fix 21: NI01).
 *
 * The screen used to read the newest fifty and nothing more: anything older
 * was in the database and nowhere in the app. The server now answers a page
 * and a cursor for the next one; these say how a page joins what is on screen.
 */

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string;
  data: { rehearsalId?: number | string; projectId?: number | string };
  relatedType: 'rehearsal' | 'project' | null;
  relatedId: number | null;
  read: boolean;
  createdAt: string;
}

export interface InboxPage {
  notifications: NotificationItem[];
  /** Asks for the page after this one; null on the last. */
  nextCursor: string | null;
}

/** What is on screen: the pages read so far, and where the next begins. */
export interface Inbox {
  items: NotificationItem[];
  nextCursor: string | null;
}

export const emptyInbox: Inbox = { items: [], nextCursor: null };

/** The page as the server answered it, whatever it left out. */
export function pageOf(data: Partial<InboxPage> | undefined): InboxPage {
  return { notifications: data?.notifications ?? [], nextCursor: data?.nextCursor ?? null };
}

/** Whether `a` is older than `b` in the inbox's order: newest first, then by id. */
function isOlder(a: NotificationItem, b: NotificationItem): boolean {
  const [at, bt] = [Date.parse(a.createdAt), Date.parse(b.createdAt)];
  return at !== bt ? at < bt : a.id < b.id;
}

/**
 * The newest page read again — on focus, on a pull. From the top down to its
 * last card it is what the server holds now; the older pages already read stay
 * below it, so coming back from a notification far down does not cut the list
 * to the first page.
 */
export function withFirstPage(inbox: Inbox, page: InboxPage): Inbox {
  const last = page.notifications[page.notifications.length - 1];
  if (!last || page.nextCursor === null) return { items: page.notifications, nextCursor: page.nextCursor };
  const below = inbox.items.filter((n) => isOlder(n, last));
  if (below.length === 0) return { items: page.notifications, nextCursor: page.nextCursor };
  return { items: [...page.notifications, ...below], nextCursor: inbox.nextCursor };
}

/**
 * The page after the last one read, onto the end. Only if it is still the next
 * page — `cursor` is the one it was asked with — and with no card twice.
 */
export function withNextPage(inbox: Inbox, page: InboxPage, cursor: string): Inbox {
  if (inbox.nextCursor !== cursor) return inbox;
  const shown = new Set(inbox.items.map((n) => n.id));
  return {
    items: [...inbox.items, ...page.notifications.filter((n) => !shown.has(n.id))],
    nextCursor: page.nextCursor,
  };
}
