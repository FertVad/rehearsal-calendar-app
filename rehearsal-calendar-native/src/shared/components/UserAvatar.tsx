import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontWeight } from '../constants/colors';

interface UserAvatarProps {
  firstName: string;
  lastName?: string;
  size?: number;
}

// Generate consistent color based on name
const getColorFromName = (name: string): string => {
  const colors = [
    '#9333ea', // purple
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // yellow
    '#ef4444', // red
    '#ec4899', // pink
    '#8b5cf6', // violet
    '#06b6d4', // cyan
  ];

  const hash = name.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);

  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (firstName: string, lastName?: string): string => {
  const first = firstName?.charAt(0)?.toUpperCase() || '';
  const last = lastName?.charAt(0)?.toUpperCase() || '';
  return `${first}${last}`.substring(0, 2);
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  firstName,
  lastName,
  size = 64,
}) => {
  const initials = getInitials(firstName, lastName);
  const backgroundColor = getColorFromName(firstName + (lastName || ''));
  const fontSize = size * 0.4;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  initials: {
    color: '#fff',
    fontWeight: FontWeight.semibold,
  },
});
