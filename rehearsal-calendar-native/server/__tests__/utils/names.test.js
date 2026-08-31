/**
 * Composing a person's name.
 *
 * The case that brought this about: a push that read "Ginger  Rode " — two
 * spaces and a trailing one — because the keyboard's autocomplete had left a
 * space on each half when the account was made.
 */
import { fullName } from '../../utils/names.js';

describe('fullName', () => {
  it('joins the two halves with one space', () => {
    expect(fullName({ first_name: 'Нина', last_name: 'Петрова' })).toBe('Нина Петрова');
  });

  it('closes the gap a trailing space leaves in the middle', () => {
    // Trimming only the result would still give "Ginger  Rode".
    expect(fullName({ first_name: 'Ginger ', last_name: 'Rode ' })).toBe('Ginger Rode');
  });

  it('leaves no space behind when there is no surname', () => {
    expect(fullName({ first_name: 'Ginger ', last_name: null })).toBe('Ginger');
    expect(fullName({ first_name: 'Ginger', last_name: '   ' })).toBe('Ginger');
  });

  it('reads the camelCase spelling too, for rows that come back from the API', () => {
    expect(fullName({ firstName: 'Нина ', lastName: ' Петрова' })).toBe('Нина Петрова');
  });

  it('falls back when there is no name at all', () => {
    expect(fullName({ first_name: '  ', last_name: '' }, 'user@test.com')).toBe('user@test.com');
    expect(fullName(null, 'user@test.com')).toBe('user@test.com');
    expect(fullName({})).toBe('');
  });
});
