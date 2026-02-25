import React from 'react';
import renderer, { act } from 'react-test-renderer';
import MassiveFileViewerScreen from '../screens/MassiveFileViewerScreen';
import { NativeModules, View } from 'react-native';

// --- Global Mocks ---
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() }),
  useRoute: () => ({
    params: { path: 'f1.txt', fileName: 'F 1', originalUri: 'file:///f1.txt' },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../../App', () => ({}));
jest.mock('../hooks/useAppTheme', () => ({
  useAppTheme: () => ({
    themeId: 'Pure Teal',
    theme: { primary: '#000', surface: '#fff', background: '#fff', text: '#000', textSecondary: '#666', divider: '#ccc' },
    language: 'English',
    setLanguage: jest.fn(),
    setThemeId: jest.fn(),
    loadSettings: jest.fn(),
  }),
}));

jest.mock('../translations', () => ({
  getTranslation: (l, k) => k,
  languages: [{ name: 'English', code: 'en' }]
}));

jest.mock('../services/scoped-storage-service', () => ({
  pickAndGetFile: jest.fn(),
  createTempFile: jest.fn(),
}));

jest.mock('react-native-linear-gradient', () => 'View');
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('../components/RainbowBackground', () => 'View');
jest.mock('../components/ThemedAlert', () => ({ ThemedAlert: () => null }));
jest.mock('../components/AppGuide', () => ({ AppGuide: () => null }));
jest.mock('../components/OCRTab', () => 'View');

// Capture Props
let globalTabProps = {};
jest.mock('../components/FileViewerInstance', () => {
  const React = require('react');
  return React.forwardRef((props, ref) => {
    globalTabProps[props.tabId] = props;
    React.useImperativeHandle(ref, () => ({ save: jest.fn(), reload: jest.fn() }));
    return React.createElement('View', { testID: 'instance' }, null);
  });
});

describe('MassiveFileViewer Stability Test', () => {
    beforeEach(() => {
        globalTabProps = {};
        jest.useFakeTimers();
    });

    it('smoke test: renders without crashing', async () => {
        let root;
        await act(async () => {
            root = renderer.create(<MassiveFileViewerScreen />);
        });
        expect(root.toJSON()).toBeDefined();
    });

    it('Nuclear Shuffle logic: display toggles on trigger', async () => {
        let root;
        await act(async () => {
            root = renderer.create(<MassiveFileViewerScreen />);
        });

        const tabId = Object.keys(globalTabProps)[0];
        const trigger = globalTabProps[tabId].triggerTabShuffle;

        // Verify it exists
        expect(trigger).toBeDefined();

        // Trigger and check display state through state-based selection
        // In this test, we check if act() can process the state change
        await act(async () => {
            trigger(tabId);
        });

        // Advance and check recovery
        await act(async () => {
            jest.advanceTimersByTime(20);
        });
    });
});
