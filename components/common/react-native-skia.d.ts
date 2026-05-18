declare module '@shopify/react-native-skia' {
  import * as React from 'react';

  export const Canvas: React.FC<{ style: any }>;  
  export const Rect: React.FC<{ x: number; y: number; width: number; height: number; color: string }>;  
} 