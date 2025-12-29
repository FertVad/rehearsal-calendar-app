/**
 * Unit Tests for useRSVP Hook
 *
 * Tests:
 * - toggleLike with optimistic updates
 * - Toggle yes ↔ null (like/unlike)
 * - Error handling with rollback
 * - Loading states
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useRSVP } from '../useRSVP';
import { rehearsalsAPI } from '../../../../shared/services/api';
import { RSVPStatus } from '../../../../shared/types';

// Mock dependencies
jest.mock('../../../../shared/services/api');
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

describe('useRSVP Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('toggleLike - Basic Functionality', () => {
    it('should toggle null → yes (like)', async () => {
      const mockResponse = { data: { confirmed: 5, invited: 10 } };
      (rehearsalsAPI.respond as jest.Mock).mockResolvedValue(mockResponse);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useRSVP());

      await act(async () => {
        await result.current.toggleLike('rehearsal-1', null, onSuccess);
      });

      // Should call onSuccess twice: optimistic + final
      expect(onSuccess).toHaveBeenCalledTimes(2);

      // First call: optimistic update
      expect(onSuccess).toHaveBeenNthCalledWith(1, 'rehearsal-1', 'yes');

      // Second call: final update with stats
      expect(onSuccess).toHaveBeenNthCalledWith(
        2,
        'rehearsal-1',
        'yes',
        { confirmed: 5, invited: 10 }
      );

      expect(rehearsalsAPI.respond).toHaveBeenCalledWith('rehearsal-1', 'yes');
    });

    it('should toggle yes → null (unlike)', async () => {
      const mockResponse = { data: { confirmed: 4, invited: 10 } };
      (rehearsalsAPI.respond as jest.Mock).mockResolvedValue(mockResponse);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useRSVP());

      await act(async () => {
        await result.current.toggleLike('rehearsal-1', 'yes', onSuccess);
      });

      // Should call onSuccess twice: optimistic + final
      expect(onSuccess).toHaveBeenCalledTimes(2);

      // First call: optimistic update to null (unlike)
      expect(onSuccess).toHaveBeenNthCalledWith(1, 'rehearsal-1', null);

      // Second call: final update with stats
      expect(onSuccess).toHaveBeenNthCalledWith(
        2,
        'rehearsal-1',
        null,
        { confirmed: 4, invited: 10 }
      );

      expect(rehearsalsAPI.respond).toHaveBeenCalledWith('rehearsal-1', null);
    });
  });

  describe('toggleLike - Loading States', () => {
    it('should set respondingId during request', async () => {
      const mockResponse = { data: { confirmed: 5, invited: 10 } };
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      (rehearsalsAPI.respond as jest.Mock).mockReturnValue(promise);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useRSVP());

      // Start toggle
      act(() => {
        result.current.toggleLike('rehearsal-1', null, onSuccess);
      });

      // Should be loading
      expect(result.current.respondingId).toBe('rehearsal-1');

      // Resolve promise
      await act(async () => {
        resolvePromise!(mockResponse);
        await promise;
      });

      // Should clear loading state
      expect(result.current.respondingId).toBeNull();
    });
  });

  describe('toggleLike - Error Handling', () => {
    it('should rollback optimistic update on error', async () => {
      const error = new Error('Network error');
      (rehearsalsAPI.respond as jest.Mock).mockRejectedValue(error);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useRSVP());

      await act(async () => {
        await result.current.toggleLike('rehearsal-1', 'yes', onSuccess);
      });

      // Should call onSuccess twice: optimistic + rollback
      expect(onSuccess).toHaveBeenCalledTimes(2);

      // First call: optimistic update to null
      expect(onSuccess).toHaveBeenNthCalledWith(1, 'rehearsal-1', null);

      // Second call: rollback to original status 'yes'
      expect(onSuccess).toHaveBeenNthCalledWith(2, 'rehearsal-1', 'yes');

      // Should show error alert
      expect(Alert.alert).toHaveBeenCalledWith(
        'Ошибка',
        'Network error'
      );
    });

    it('should show default error message when error has no message', async () => {
      (rehearsalsAPI.respond as jest.Mock).mockRejectedValue({});

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useRSVP());

      await act(async () => {
        await result.current.toggleLike('rehearsal-1', null, onSuccess);
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Ошибка',
        'Не удалось обновить статус'
      );
    });

    it('should clear respondingId even on error', async () => {
      (rehearsalsAPI.respond as jest.Mock).mockRejectedValue(new Error('Fail'));

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useRSVP());

      await act(async () => {
        await result.current.toggleLike('rehearsal-1', null, onSuccess);
      });

      // Should clear loading state
      expect(result.current.respondingId).toBeNull();
    });
  });

  describe('toggleLike - Concurrent Requests', () => {
    it('should handle multiple rapid toggles', async () => {
      const mockResponse1 = { data: { confirmed: 5, invited: 10 } };
      const mockResponse2 = { data: { confirmed: 4, invited: 10 } };

      (rehearsalsAPI.respond as jest.Mock)
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useRSVP());

      // Rapid toggle: null → yes → null
      await act(async () => {
        await result.current.toggleLike('rehearsal-1', null, onSuccess);
      });

      await act(async () => {
        await result.current.toggleLike('rehearsal-1', 'yes', onSuccess);
      });

      // Should have called API twice
      expect(rehearsalsAPI.respond).toHaveBeenCalledTimes(2);
      expect(rehearsalsAPI.respond).toHaveBeenNthCalledWith(1, 'rehearsal-1', 'yes');
      expect(rehearsalsAPI.respond).toHaveBeenNthCalledWith(2, 'rehearsal-1', null);
    });
  });

  describe('toggleLike - Edge Cases', () => {
    it('should handle response data without stats', async () => {
      const mockResponse = { data: {} };
      (rehearsalsAPI.respond as jest.Mock).mockResolvedValue(mockResponse);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useRSVP());

      await act(async () => {
        await result.current.toggleLike('rehearsal-1', null, onSuccess);
      });

      // Should still call onSuccess with empty data
      expect(onSuccess).toHaveBeenNthCalledWith(2, 'rehearsal-1', 'yes', {});
    });

    it('should handle null response data', async () => {
      const mockResponse = { data: null };
      (rehearsalsAPI.respond as jest.Mock).mockResolvedValue(mockResponse);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useRSVP());

      await act(async () => {
        await result.current.toggleLike('rehearsal-1', null, onSuccess);
      });

      // Should call onSuccess only once (optimistic) if data is null
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith('rehearsal-1', 'yes');
    });
  });
});
