import React, { forwardRef, useState } from 'react';
import { StyleProp, StyleSheet, TextInput, TextInputProps, TextStyle, View } from 'react-native';
import { Colors, TouchTarget } from '../../../shared/constants/colors';
import { IconButton } from '../../../shared/components/IconButton';
import { useI18n } from '../../../contexts/I18nContext';

type PasswordFieldProps = Omit<TextInputProps, 'secureTextEntry' | 'style'> & {
  style?: StyleProp<TextStyle>;
};

/**
 * A password input with a 44×44 "show password" button inside it, for the
 * sign-in and registration forms. The text is hidden until the button is
 * pressed; its label says what the next press does.
 */
const PasswordField = forwardRef<TextInput, PasswordFieldProps>(function PasswordField({ style, ...props }, ref) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <TextInput
        ref={ref}
        {...props}
        style={[style, styles.input]}
        placeholderTextColor={Colors.text.tertiary}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <IconButton
        icon={visible ? 'eye-off-outline' : 'eye-outline'}
        size={20}
        style={styles.toggle}
        onPress={() => setVisible((shown) => !shown)}
        accessibilityLabel={visible ? t.auth.hidePassword : t.auth.showPassword}
      />
    </View>
  );
});

export default PasswordField;

const styles = StyleSheet.create({
  // Room for the button, so the text never runs under it.
  input: {
    paddingRight: TouchTarget,
  },
  toggle: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: TouchTarget,
  },
});
