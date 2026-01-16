/**
 * Unit Tests for useInviteLink Hook
 *
 * Tests:
 * - generateInviteLink successfully
 * - Copy to clipboard
 * - Error handling
 * - Loading states
 */
import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useInviteLink } from '../useInviteLink';
import { invitesAPI } from '../../../../shared/services/api';

// Mock dependencies
jest.mock('../../../../shared/services/api');
jest.mock('expo-clipboard');
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

describe('useInviteLink Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateInviteLink - Success', () => {
    it('should generate invite link and copy to clipboard', async () => {
      const mockInviteUrl = 'https://app.com/invite/abc123';
      const mockResponse = {
        data: {
          inviteCode: 'abc123',
          inviteUrl: mockInviteUrl,
          expiresAt: '2025-12-31T23:59:59Z',
        },
      };

      (invitesAPI.createInvite as jest.Mock).mockResolvedValue(mockResponse);
      (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useInviteLink());

      // Initially not generating
      expect(result.current.generatingInvite).toBe(false);

      await act(async () => {
        await result.current.generateInviteLink('project-1');
      });

      // Should call API
      expect(invitesAPI.createInvite).toHaveBeenCalledWith('project-1');

      // Should copy to clipboard
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(mockInviteUrl);

      // Should show success alert
      expect(Alert.alert).toHaveBeenCalledWith(
        'Ссылка скопирована',
        'Ссылка-приглашение скопирована в буфер обмена',
        [{ text: 'OK' }]
      );

      // Should clear loading state
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
      (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useInviteLink());

      // Start generation
      act(() => {
        result.current.generateInviteLink('project-1');
      });

      // Should be generating
      expect(result.current.generatingInvite).toBe(true);

      // Resolve promise
      await act(async () => {
        resolvePromise!({
          data: {
            inviteUrl: 'https://app.com/invite/abc123',
          },
        });
        await promise;
      });

      // Should clear loading state
      expect(result.current.generatingInvite).toBe(false);
    });
  });

  describe('generateInviteLink - Error Handling', () => {
    it('should show error alert on API failure', async () => {
      const error = new Error('Failed to create invite');
      (invitesAPI.createInvite as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useInviteLink());

      await act(async () => {
        await result.current.generateInviteLink('project-1');
      });

      // Should show error alert with error message
      expect(Alert.alert).toHaveBeenCalledWith(
        'Ошибка',
        'Failed to create invite'
      );

      // Should clear loading state
      expect(result.current.generatingInvite).toBe(false);
    });

    it('should show default error message when error has no message', async () => {
      (invitesAPI.createInvite as jest.Mock).mockRejectedValue({});

      const { result } = renderHook(() => useInviteLink());

      await act(async () => {
        await result.current.generateInviteLink('project-1');
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Ошибка',
        'Не удалось создать ссылку-приглашение'
      );
    });

    it('should handle clipboard failure gracefully', async () => {
      const mockResponse = {
        data: {
          inviteUrl: 'https://app.com/invite/abc123',
        },
      };

      (invitesAPI.createInvite as jest.Mock).mockResolvedValue(mockResponse);
      (Clipboard.setStringAsync as jest.Mock).mockRejectedValue(
        new Error('Clipboard permission denied')
      );

      const { result } = renderHook(() => useInviteLink());

      // Should handle error and show Alert
      await act(async () => {
        await result.current.generateInviteLink('project-1');
      });

      // Should show error alert with clipboard error message
      expect(Alert.alert).toHaveBeenCalledWith(
        'Ошибка',
        'Clipboard permission denied'
      );

      // Should still clear loading state
      expect(result.current.generatingInvite).toBe(false);
    });
  });

  describe('generateInviteLink - Concurrent Requests', () => {
    it('should handle multiple rapid calls', async () => {
      const mockResponse1 = { data: { inviteUrl: 'https://app.com/invite/abc123' } };
      const mockResponse2 = { data: { inviteUrl: 'https://app.com/invite/def456' } };

      (invitesAPI.createInvite as jest.Mock)
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);
      (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useInviteLink());

      // Make two rapid calls
      await act(async () => {
        await result.current.generateInviteLink('project-1');
      });

      await act(async () => {
        await result.current.generateInviteLink('project-2');
      });

      // Should have called API twice
      expect(invitesAPI.createInvite).toHaveBeenCalledTimes(2);
      expect(invitesAPI.createInvite).toHaveBeenNthCalledWith(1, 'project-1');
      expect(invitesAPI.createInvite).toHaveBeenNthCalledWith(2, 'project-2');

      // Should have copied both to clipboard
      expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(2);
      expect(Clipboard.setStringAsync).toHaveBeenNthCalledWith(1, 'https://app.com/invite/abc123');
      expect(Clipboard.setStringAsync).toHaveBeenNthCalledWith(2, 'https://app.com/invite/def456');
    });
  });

  describe('generateInviteLink - Edge Cases', () => {
    it('should handle empty inviteUrl', async () => {
      const mockResponse = { data: { inviteUrl: '' } };
      (invitesAPI.createInvite as jest.Mock).mockResolvedValue(mockResponse);
      (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useInviteLink());

      await act(async () => {
        await result.current.generateInviteLink('project-1');
      });

      // Should still try to copy empty string
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('');

      // Should still show success alert
      expect(Alert.alert).toHaveBeenCalledWith(
        'Ссылка скопирована',
        'Ссылка-приглашение скопирована в буфер обмена',
        [{ text: 'OK' }]
      );
    });

    it('should handle response without inviteUrl', async () => {
      const mockResponse = { data: {} };
      (invitesAPI.createInvite as jest.Mock).mockResolvedValue(mockResponse);
      (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useInviteLink());

      await act(async () => {
        await result.current.generateInviteLink('project-1');
      });

      // Should try to copy undefined
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(undefined);
    });
  });
});
