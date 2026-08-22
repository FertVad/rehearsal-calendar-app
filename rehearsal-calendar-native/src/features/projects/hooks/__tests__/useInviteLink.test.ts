/**
 * Unit Tests for useInviteLink Hook
 *
 * The hook hands the invite to the system share sheet rather than the
 * clipboard — see the note on the hook itself for why.
 *
 * Tests:
 * - generateInviteLink opens the share sheet with the link and project name
 * - Loading states
 * - Error handling
 * - Concurrent calls
 * - Edge cases around a missing url
 */
import { renderHook, act } from '@testing-library/react-native';
import { Alert, Share } from 'react-native';
import { useInviteLink } from '../useInviteLink';
import { invitesAPI } from '../../../../shared/services/api';

// Mock dependencies
jest.mock('../../../../shared/services/api');
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    language: 'ru',
    setLanguage: jest.fn(),
    t: jest.requireActual('../../../../i18n/translations').ru,
  }),
}));

const PROJECT = 'Гамлет';

describe('useInviteLink Hook', () => {
  const shareSpy = Share.share as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    shareSpy.mockResolvedValue({ action: 'sharedAction' });
  });

  describe('generateInviteLink - Success', () => {
    it('should generate an invite link and open the share sheet', async () => {
      const mockInviteUrl = 'https://rehearsly.me/invite/abc123';
      (invitesAPI.createInvite as jest.Mock).mockResolvedValue({
        data: {
          inviteCode: 'abc123',
          inviteUrl: mockInviteUrl,
          expiresAt: '2025-12-31T23:59:59Z',
        },
      });

      const { result } = renderHook(() => useInviteLink());

      expect(result.current.generatingInvite).toBe(false);

      await act(async () => {
        await result.current.generateInviteLink('project-1', PROJECT);
      });

      expect(invitesAPI.createInvite).toHaveBeenCalledWith('project-1');

      // The sheet gets the localized message, the project name and the link
      expect(shareSpy).toHaveBeenCalledWith({
        message: `Присоединяйся к проекту "${PROJECT}" в приложении Rehearsly:\n\n${mockInviteUrl}`,
        title: `Приглашение в проект ${PROJECT}`,
      });

      // No alert on the happy path — the sheet is the whole feedback
      expect(Alert.alert).not.toHaveBeenCalled();

      expect(result.current.generatingInvite).toBe(false);
    });
  });

  describe('generateInviteLink - Loading States', () => {
    it('should set generatingInvite to true during request', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (invitesAPI.createInvite as jest.Mock).mockReturnValue(promise);

      const { result } = renderHook(() => useInviteLink());

      act(() => {
        result.current.generateInviteLink('project-1', PROJECT);
      });

      expect(result.current.generatingInvite).toBe(true);

      await act(async () => {
        resolvePromise!({
          data: { inviteUrl: 'https://rehearsly.me/invite/abc123' },
        });
        await promise;
      });

      expect(result.current.generatingInvite).toBe(false);
    });
  });

  describe('generateInviteLink - Error Handling', () => {
    it('should show error alert on API failure', async () => {
      (invitesAPI.createInvite as jest.Mock).mockRejectedValue(
        new Error('Failed to create invite')
      );

      const { result } = renderHook(() => useInviteLink());

      await act(async () => {
        await result.current.generateInviteLink('project-1', PROJECT);
      });

      expect(Alert.alert).toHaveBeenCalledWith('Ошибка', 'Failed to create invite');
      expect(shareSpy).not.toHaveBeenCalled();
      expect(result.current.generatingInvite).toBe(false);
    });

    it('should prefer the server error over the generic message', async () => {
      (invitesAPI.createInvite as jest.Mock).mockRejectedValue({
        response: { data: { error: 'Only admins can invite' } },
        message: 'Request failed with status code 403',
      });

      const { result } = renderHook(() => useInviteLink());

      await act(async () => {
        await result.current.generateInviteLink('project-1', PROJECT);
      });

      expect(Alert.alert).toHaveBeenCalledWith('Ошибка', 'Only admins can invite');
    });

    it('should show default error message when error has no message', async () => {
      (invitesAPI.createInvite as jest.Mock).mockRejectedValue({});

      const { result } = renderHook(() => useInviteLink());

      await act(async () => {
        await result.current.generateInviteLink('project-1', PROJECT);
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Ошибка',
        'Не удалось создать ссылку-приглашение'
      );
    });

    it('should surface a share sheet failure', async () => {
      (invitesAPI.createInvite as jest.Mock).mockResolvedValue({
        data: { inviteUrl: 'https://rehearsly.me/invite/abc123' },
      });
      shareSpy.mockRejectedValue(new Error('Share unavailable'));

      const { result } = renderHook(() => useInviteLink());

      await act(async () => {
        await result.current.generateInviteLink('project-1', PROJECT);
      });

      expect(Alert.alert).toHaveBeenCalledWith('Ошибка', 'Share unavailable');
      expect(result.current.generatingInvite).toBe(false);
    });
  });

  describe('generateInviteLink - Concurrent Requests', () => {
    it('should handle multiple rapid calls', async () => {
      (invitesAPI.createInvite as jest.Mock)
        .mockResolvedValueOnce({ data: { inviteUrl: 'https://rehearsly.me/invite/abc123' } })
        .mockResolvedValueOnce({ data: { inviteUrl: 'https://rehearsly.me/invite/def456' } });

      const { result } = renderHook(() => useInviteLink());

      await act(async () => {
        await result.current.generateInviteLink('project-1', PROJECT);
      });

      await act(async () => {
        await result.current.generateInviteLink('project-2', 'Лебединое озеро');
      });

      expect(invitesAPI.createInvite).toHaveBeenCalledTimes(2);
      expect(invitesAPI.createInvite).toHaveBeenNthCalledWith(1, 'project-1');
      expect(invitesAPI.createInvite).toHaveBeenNthCalledWith(2, 'project-2');

      expect(shareSpy).toHaveBeenCalledTimes(2);
      // Each call carries its own project name, not the first one's
      expect(shareSpy).toHaveBeenNthCalledWith(2, {
        message: `Присоединяйся к проекту "Лебединое озеро" в приложении Rehearsly:\n\nhttps://rehearsly.me/invite/def456`,
        title: 'Приглашение в проект Лебединое озеро',
      });
    });
  });

  describe('generateInviteLink - Edge Cases', () => {
    it('should handle empty inviteUrl', async () => {
      (invitesAPI.createInvite as jest.Mock).mockResolvedValue({
        data: { inviteUrl: '' },
      });

      const { result } = renderHook(() => useInviteLink());

      await act(async () => {
        await result.current.generateInviteLink('project-1', PROJECT);
      });

      expect(shareSpy).toHaveBeenCalledWith({
        message: `Присоединяйся к проекту "${PROJECT}" в приложении Rehearsly:\n\n`,
        title: `Приглашение в проект ${PROJECT}`,
      });
    });
  });
});
