/**
 * Slot counts have to agree with the number in every language.
 *
 * Russian is the one with real work to do: three forms, and the teens are an
 * exception to the rule the units otherwise follow.
 */
import { translations } from '../translations';

describe('slot counts agree with the number', () => {
  describe('Russian', () => {
    const t = (n: number) => translations.ru.smartPlanner.slotsCount(n);

    it('uses the singular for one', () => {
      expect(t(1)).toBe('1 слот');
      expect(t(21)).toBe('21 слот');
      expect(t(101)).toBe('101 слот');
    });

    it('uses the second form for two to four', () => {
      expect(t(2)).toBe('2 слота');
      expect(t(4)).toBe('4 слота');
      expect(t(22)).toBe('22 слота');
    });

    it('uses the third form for five and up', () => {
      expect(t(0)).toBe('0 слотов');
      expect(t(5)).toBe('5 слотов');
      expect(t(20)).toBe('20 слотов');
    });

    it('treats the teens as an exception', () => {
      // 11-14 take the third form even though 1-4 do not
      expect(t(11)).toBe('11 слотов');
      expect(t(12)).toBe('12 слотов');
      expect(t(14)).toBe('14 слотов');
      expect(t(111)).toBe('111 слотов');
    });
  });

  describe('the other three', () => {
    it('English switches at one', () => {
      expect(translations.en.smartPlanner.slotsCount(1)).toBe('1 slot');
      expect(translations.en.smartPlanner.slotsCount(2)).toBe('2 slots');
    });

    it('Spanish switches at one', () => {
      expect(translations.es.smartPlanner.slotsCount(1)).toBe('1 franja');
      expect(translations.es.smartPlanner.slotsCount(3)).toBe('3 franjas');
    });

    it('German does not change the noun', () => {
      expect(translations.de.smartPlanner.slotsCount(1)).toBe('1 Zeitfenster');
      expect(translations.de.smartPlanner.slotsCount(6)).toBe('6 Zeitfenster');
    });
  });
});
