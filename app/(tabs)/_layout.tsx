/**
 * @file app/(tabs)/_layout.tsx
 * Layout della tab bar inferiore con due tab:
 * - Fascicoli (schermata principale)
 * - Impostazioni (configurazione webservice)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useConfigStore } from '@/store/config.store';

interface TabIconProps {
  color:   string;
  focused: boolean;
}

function IconFascicoli({ color, focused }: TabIconProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 7C3 5.89543 3.89543 5 5 5H9.58579C9.851 5 10.1054 5.10536 10.2929 5.29289L11.7071 6.70711C11.8946 6.89464 12.149 7 12.4142 7H19C20.1046 7 21 7.89543 21 9V17C21 18.1046 20.1046 19 19 19H5C3.89543 19 3 18.1046 3 17V7Z"
        stroke={color}
        strokeWidth={focused ? 2 : 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {focused && (
        <Path
          d="M8 12H16M8 15H13"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      )}
    </Svg>
  );
}

function IconImpostazioni({ color, focused }: TabIconProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
        stroke={color}
        strokeWidth={focused ? 2 : 1.5}
      />
      <Path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke={color}
        strokeWidth={focused ? 2 : 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ConfigBadge() {
  return (
    <View style={badgeStyles.badge}>
      <View style={badgeStyles.dot} />
    </View>
  );
}

export default function TabsLayout() {
  const insets       = useSafeAreaInsets();
  const isConfigured = useConfigStore((s) => s.isConfigured);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   '#6366F1',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth:  1,
          borderTopColor:  '#F3F4F6',
          height:          56 + insets.bottom,
          paddingBottom:   insets.bottom,
          paddingTop:      8,
        },
        tabBarLabelStyle: {
          fontSize:   11,
          fontWeight: '500',
          marginTop:  2,
        },
        headerStyle:         { backgroundColor: '#FFFFFF' },
        headerTintColor:     '#111827',
        headerTitleStyle:    { fontWeight: '600', fontSize: 17 },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="fascicoli"
        options={{
          title:       'Fascicoli',
          tabBarLabel: 'Fascicoli',
          tabBarIcon:  ({ color, focused }) => (
            <IconFascicoli color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="impostazioni"
        options={{
          title:       'Impostazioni',
          tabBarLabel: 'Impostazioni',
          tabBarIcon:  ({ color, focused }) => (
            <View>
              <IconImpostazioni color={color} focused={focused} />
              {!isConfigured && <ConfigBadge />}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    position:        'absolute',
    top:             -2,
    right:           -4,
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: '#FFFFFF',
    alignItems:      'center',
    justifyContent:  'center',
  },
  dot: {
    width:           7,
    height:          7,
    borderRadius:    3.5,
    backgroundColor: '#EF4444',
  },
});
