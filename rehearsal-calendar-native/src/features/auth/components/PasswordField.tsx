import React, { forwardRef, useState } from 'react';
import { StyleProp, StyleSheet, TextInput, TextInputProps, TextStyle, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../shared/constants/colors';
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
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setVisible((shown) => !shown)}
        accessibilityRole="button"
        accessibilityLabel={visible ? t.auth.hidePassword : t.auth.showPassword}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.text.secondary} />
      </TouchableOpacity>
    </View>
  );
});

export default PasswordField;

const styles = StyleSheet.create({
  // Room for the button, so the text never runs under it.
  input: {
    paddingRight: 44,
  },
  toggle: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
