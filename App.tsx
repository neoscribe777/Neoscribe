import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';
import MassiveFileViewerScreen from './src/screens/MassiveFileViewerScreen';
import { useAppTheme } from './src/hooks/useAppTheme';

export type RootStackParamList = {
  Home: undefined;
  MassiveFileViewer: { path: string; fileName?: string; noteId?: string; stressSizeMb?: number; originalUri?: string; isReadOnly?: boolean; triggerSora?: boolean; isOCR?: boolean; shareId?: any; showStartEditing?: boolean };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function App(): React.JSX.Element {
  const { theme, loadSettings } = useAppTheme();

  React.useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const navigationTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: theme.primary,
      background: theme.background,
      card: theme.surface,
      text: theme.text,
      border: theme.divider,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar 
        backgroundColor={theme.background} 
        barStyle="light-content" 
        translucent={false}
      />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="MassiveFileViewer" component={MassiveFileViewerScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
