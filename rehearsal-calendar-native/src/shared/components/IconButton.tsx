import React from 'react';
import { TouchableOpacity, StyleProp, TextStyle, TouchableOpacityProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, TouchTarget } from '../constants/colors';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface IconButtonProps
  extends Omit<TouchableOpacityProps, 'accessibilityLabel' | 'accessibilityRole' | 'children'> {
  icon: IconName;
  /** What it does: there is no text to say it. The e2e flows find it by this. */
  accessibilityLabel: string;
  size?: number;
  color?: string;
  iconStyle?: StyleProp<TextStyle>;
  /** The side of the area that takes the tap, where 44 is not enough on
   *  screen (a sheet iOS draws smaller). Never less than 44. */
  minSize?: number;
  /** Drawn with the icon, as the count on the bell. */
  children?: React.ReactNode;
}

/**
 * A button that is only an icon (T-014).
 *
 * Each screen drew its own: a 24 pt arrow with no padding, a cross with 4,
 * two with 8 — from 24×24 to 38×38, under the 44×44 the HIG asks of a target.
 * The icon stays the size it is drawn; the area that takes the tap is never
 * less than 44 a side, whatever style the caller passes.
 */
export function IconButton({
  icon,
  size = 24,
  color = Colors.text.secondary,
  iconStyle,
  minSize = TouchTarget,
  style,
  children,
  ...rest
}: IconButtonProps) {
  const side = Math.max(TouchTarget, minSize);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      {...rest}
      // Last in the list, so a caller's style cannot take it under 44.
      style={[style, { minWidth: side, minHeight: side, alignItems: 'center', justifyContent: 'center' }]}
    >
      <Ionicons name={icon} size={size} color={color} style={iconStyle} />
      {children}
    </TouchableOpacity>
  );
}
