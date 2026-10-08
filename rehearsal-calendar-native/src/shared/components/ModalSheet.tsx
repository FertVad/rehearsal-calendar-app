import React, { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useI18n } from '../../contexts/I18nContext';

interface ModalSheetProps {
  /** Called when the dimmed area around the sheet is tapped. */
  onClose: () => void;
  /** The dimmed area: its background, and where the sheet sits in it. */
  overlayStyle: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * What goes directly inside a `Modal`: the dimmed area that closes the sheet
 * when tapped, and the sheet itself on top of it.
 *
 * The tappable area sits behind the sheet, never around it. A touchable
 * wrapped around a sheet makes iOS present the whole sheet as one button:
 * VoiceOver could not reach a single project in the picker, a member action or
 * a picker's Done, and neither could the e2e flows. And a tap anywhere on the
 * sheet that missed a control — its title, its padding — closed it. A touch
 * on the sheet does not reach a sibling behind it, so neither happens here.
 */
export function ModalSheet({ onClose, overlayStyle, children }: ModalSheetProps) {
  const { t } = useI18n();
  return (
    <View style={overlayStyle}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t.common.close}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});
