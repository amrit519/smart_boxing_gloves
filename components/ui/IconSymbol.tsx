// This file is a fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight } from 'expo-symbols';
import React from 'react';
import { OpaqueColorValue, StyleProp, ViewStyle } from 'react-native';

// Add your SFSymbol to MaterialIcons mappings here.
const MAPPING = {
  // See MaterialIcons here: https://icons.expo.fyi
  // See SF Symbols in the SF Symbols app on Mac.
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'gear': 'settings',
  'bluetooth': 'bluetooth-audio',
  'search': 'search',
  'clock': 'access-time',
  'power': 'power-settings-new',
  'person': 'person',
  'android': 'android',
  'directions-car': 'directions-car',
  'flight': 'flight',
  'gamepad': 'gamepad',
  'remote-control': 'settings-remote',
  'help': 'help-outline',
  'lightbulb': 'lightbulb',
  'directions-run': 'directions-run',
  'flight-takeoff': 'flight-takeoff',
  'refresh': 'refresh',
  'shuffle': 'shuffle',
  'keyboard-arrow-up': 'keyboard-arrow-up',
  'keyboard-arrow-down': 'keyboard-arrow-down',
  'keyboard-arrow-left': 'keyboard-arrow-left',
  'keyboard-arrow-right': 'keyboard-arrow-right',
  'battery-std': 'battery-std',
  'fitness-center': 'fitness-center',
  'dashboard': 'dashboard',
  'emoji-events': 'emoji-events',
} as const;

export type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SFSymbols on iOS, and MaterialIcons on Android and web. This ensures a consistent look across platforms, and optimal resource usage.
 *
 * Icon `name`s are based on SFSymbols and require manual mapping to MaterialIcons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} styles ={style} />;
}
