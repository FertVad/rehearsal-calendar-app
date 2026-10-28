// T-303 red-before: gives the pre-fix AvailabilityScreen (89d0467~1) the same
// testIDs and selected states flow 10 finds its controls by, and nothing else.
// node audit/evidence/T-303/old-screen-testids.mjs <AvailabilityScreen.tsx>
import fs from 'node:fs';

const file = process.argv[2];
let source = fs.readFileSync(file, 'utf8');

const props = [
  ["onPress={() => navigation.goBack()}", 'testID="availability-close"'],
  ["onPress={() => editor.handleModeChange('free')}", `testID="mode-free" accessibilityState={{ selected: shownMode === 'free' }}`],
  ["onPress={() => editor.handleModeChange('custom')}", `testID="mode-custom" accessibilityState={{ selected: shownMode === 'custom' }}`],
  ["onPress={() => editor.handleModeChange('busy')}", `testID="mode-busy" accessibilityState={{ selected: shownMode === 'busy' }}`],
  ["onPress={() => editor.openTimePicker(index, 'start')}", 'testID={`slot-${index}-start`}'],
  ["onPress={() => editor.openTimePicker(index, 'end')}", 'testID={`slot-${index}-end`}'],
  ['onPress={handleSave}', 'testID="availability-save"'],
];

for (const [anchor, added] of props) {
  const at = source.indexOf(anchor);
  if (at < 0 || source.indexOf(anchor, at + 1) >= 0) throw new Error(`not exactly one ${anchor}`);
  const open = source.lastIndexOf('<TouchableOpacity', at) + '<TouchableOpacity'.length;
  source = `${source.slice(0, open)} ${added}${source.slice(open)}`;
}
fs.writeFileSync(file, source);
console.log(`${props.length} controls given their testIDs in ${file}`);
