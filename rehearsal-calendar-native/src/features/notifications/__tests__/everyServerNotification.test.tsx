/**
 * Every notification the server sends has somewhere to go and an icon of its
 * own, and its card says all of it (T-252).
 *
 * "New administrator" (admin_appointed) was sent and the app did not know it:
 * a tapped push went to the switch's default and opened nothing, and its card,
 * like "New member"'s, had the bell every unknown type gets. The types are read
 * from the server's own sender, so a type added there and not here fails here.
 *
 * And the card cut its text at the second line: "… programado para mañana a
 * las 1…" — the time and place the notice was sent for were nowhere to read,
 * since a tap opens the rehearsal, not the text.
 */
import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render, act, renderHook } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import NotificationsScreen from '../screens/NotificationsScreen';
import { useNotifications } from '../../../shared/hooks/useNotifications';

const SENDER = join(__dirname, '..', '..', '..', '..', 'server', 'services', 'notifications', 'pushNotificationService.js');

/** Every `type: '…'` the server's sender puts in a notification's data. */
function serverTypes(): string[] {
  const source = readFileSync(SENDER, 'utf8');
  return [...new Set([...source.matchAll(/\btype:\s*'([a-z0-9_]+)'/g)].map((m) => m[1]))].sort();
}

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useFocusEffect: (effect: () => void) => { mockFocus.run = effect; },
}));
const mockFocus: { run?: () => void } = {};
jest.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: jest.requireActual('../../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../../../contexts/UnreadContext', () => ({
  useUnread: () => ({
    unreadCount: 0,
    refresh: jest.fn(),
    markRead: jest.fn(() => Promise.resolve(true)),
    markAllRead: jest.fn(),
    remove: jest.fn(),
    removeAll: jest.fn(),
  }),
}));
const mockList = jest.fn();
jest.mock('../../../shared/services/api', () => ({
  notificationsAPI: { list: (...args: any[]) => mockList(...args) },
}));
jest.mock('../../../shared/hooks/useAutoCalendarSync', () => ({ runAutoSync: jest.fn(() => Promise.resolve()) }));
jest.mock('react-native-gesture-handler/Swipeable', () => {
  const { View } = jest.requireActual('react-native');
  const R = jest.requireActual('react');
  return ({ children }: any) => R.createElement(View, null, children);
});
jest.mock('react-native-gesture-handler', () => {
  const { TouchableOpacity } = jest.requireActual('react-native');
  return { TouchableOpacity };
});

const card = (id: number, type: string, title: string, body: string) => ({
  id, type, title, body, data: { type }, relatedType: null, relatedId: null,
  read: false, createdAt: new Date().toISOString(),
});

async function inboxOf(cards: ReturnType<typeof card>[]) {
  mockList.mockResolvedValueOnce({ data: { notifications: cards, unreadCount: 0, nextCursor: null } });
  const view = render(<NotificationsScreen />);
  await act(async () => { mockFocus.run?.(); });
  return view;
}

/** The icon drawn on the card titled `title`: the Ionicons mock draws "Icon: <name>". */
function iconOn(view: ReturnType<typeof render>, title: string): string {
  const isIcon = (node: any) => typeof node.props?.testID === 'string' && node.props.testID.startsWith('icon-Ionicons-');
  // Up from the title to the first node that holds an icon: the card.
  for (let node: any = view.getByText(title); node; node = node.parent) {
    const icons = node.findAll(isIcon);
    if (icons.length) return icons[0].props.testID.replace('icon-Ionicons-', '');
  }
  return '';
}

beforeEach(() => {
  mockNavigate.mockClear();
  mockList.mockReset();
});

it('reads the types from the server', () => {
  const types = serverTypes();
  expect(types).toEqual(expect.arrayContaining(['member_joined', 'admin_appointed', 'rehearsal_created', 'role_changed']));
});

describe('a tapped push of every type the server sends opens something', () => {
  it.each(serverTypes())('%s', async (type) => {
    const listen = Notifications.addNotificationResponseReceivedListener as jest.Mock;
    listen.mockClear();
    renderHook(() => useNotifications());
    await act(async () => {});
    // Everything a notification may carry: what is not opened is not for lack of an id.
    act(() => listen.mock.calls[0][0]({
      notification: { request: { content: { data: { type, rehearsalId: 9, projectId: 3, projectName: 'Hamlet' } } } },
    }));

    expect(mockNavigate).toHaveBeenCalled();
  });
});

describe('every type the server sends has an icon of its own on its card', () => {
  it('none is the bell an unknown type gets, and "New member" and "New administrator" are told apart', async () => {
    const types = serverTypes();
    const view = await inboxOf(types.map((type, i) => card(i + 1, type, `Title ${type}`, '')));

    const icons = Object.fromEntries(types.map((type) => [type, iconOn(view, `Title ${type}`)]));
    for (const type of types) {
      expect([type, icons[type]]).not.toEqual([type, '']);
      expect([type, icons[type]]).not.toEqual([type, 'notifications-outline']);
    }
    expect(icons.member_joined).toBe('person-add-outline');
    expect(icons.admin_appointed).not.toBe(icons.member_joined);
    expect(icons.admin_appointed).not.toBe(icons.role_changed);
  });

  it('a card from before b973361, "project_invite", still has its own', async () => {
    const view = await inboxOf([card(1, 'project_invite', 'Welcome to Hamlet', ''), card(2, 'member_joined', 'New member', '')]);

    expect(iconOn(view, 'Welcome to Hamlet')).not.toBe('notifications-outline');
    expect(iconOn(view, 'Welcome to Hamlet')).not.toBe(iconOn(view, 'New member'));
  });
});

describe('a card says all of it (T-252)', () => {
  // The longest the server sends: Spanish, "added", on a date and with a place.
  const title = 'Te han añadido a un ensayo';
  const body = 'Fuenteovejuna: Ensayo «Escena del comendador» programado para el mar, 17 nov a las 18:00 en Corral de comedias de Almagro';

  it('neither its title nor its text is cut to a number of lines', async () => {
    const view = await inboxOf([card(1, 'rehearsal_created', title, body)]);

    expect(view.getByText(title).props.numberOfLines).toBeUndefined();
    expect(view.getByText(body).props.numberOfLines).toBeUndefined();
  });
});
