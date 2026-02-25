import React from 'react';
import renderer, { act } from 'react-test-renderer';
import MassiveFileViewerScreen from '../screens/MassiveFileViewerScreen';
import { NativeModules } from 'react-native';

// --- Mocks ---
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() }),
  useRoute: () => ({
    params: {
        path: 'file1.txt',
        fileName: 'File 1',
        originalUri: 'file:///file1.txt',
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 20, left: 0, right: 0 }),
}));

jest.mock('../../App', () => ({})); // Mock RootStackParamList source

jest.mock('../hooks/useAppTheme', () => ({
  useAppTheme: () => ({
    themeId: 'Pure Teal',
    theme: {
        primary: '#008080',
        surface: '#FFFFFF',
        background: '#F0F0F0',
        text: '#000000',
        textSecondary: '#666666',
        divider: '#CCCCCC'
    },
    language: 'English',
    setLanguage: jest.fn(),
    setThemeId: jest.fn(),
    loadSettings: jest.fn(),
  }),
}));

jest.mock('../translations', () => ({
  getTranslation: (lang: string, key: string) => key,
  languages: [{ name: 'English', code: 'en' }]
}));

jest.mock('../services/scoped-storage-service', () => ({
  pickAndGetFile: jest.fn(),
  createTempFile: jest.fn(),
}));

jest.mock('react-native-linear-gradient', () => {
  const React = require('react');
  return ({ children }: any) => React.createElement('View', {}, children);
});

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('../components/RainbowBackground', () => {
    const React = require('react');
    return ({ children }: any) => React.createElement('View', {}, children);
});
jest.mock('../components/ThemedAlert', () => ({ ThemedAlert: () => null }));
jest.mock('../components/AppGuide', () => ({ AppGuide: () => null }));
jest.mock('../components/OCRTab', () => {
    const React = require('react');
    return ({ children }: any) => React.createElement('View', {}, children);
});

// Mock NativeModules
NativeModules.OCRModule = { recognizeText: jest.fn() };

// Capture the FileViewerInstance props
let instanceProps: { [key: string]: any } = {};
jest.mock('../components/FileViewerInstance', () => {
  const React = require('react');
  const { forwardRef, useImperativeHandle } = React;
  const { View } = require('react-native');
  
  return {
    FileViewerInstance: forwardRef((props: any, ref: any) => {
      instanceProps[props.tabId] = props;
      useImperativeHandle(ref, () => ({
        save: jest.fn(),
        clearSelection: jest.fn(),
        reload: jest.fn(),
      }));
      return <View testID={`instance-${props.tabId}`} />;
    }),
  };
});

describe('MassiveFileViewerScreen Stability', () => {
    beforeEach(() => {
        instanceProps = {};
        jest.useFakeTimers();
    });

    it('Scenario 1: Tab Shuffling Display Toggle', async () => {
        let root: any;
        await act(async () => {
            root = renderer.create(<MassiveFileViewerScreen />);
        });

        // Get the first tab ID
        const tabId = Object.keys(instanceProps)[0];
        const triggerShuffle = instanceProps[tabId].triggerTabShuffle;

        // Find the container for this tab
        // The display logic is: display: (activeTabId === tab.id && shufflingId !== tab.id) ? 'flex' : 'none'
        
        const getTabDisplay = (id: string) => {
            const tabNode = root.root.findByKey(id);
            return tabNode.props.style.display;
        };

        expect(getTabDisplay(tabId)).toBe('flex');

        // TRIGGER SHUFFLE
        await act(async () => {
            triggerShuffle(tabId);
        });

        // FLASH: Should be 'none'
        expect(getTabDisplay(tabId)).toBe('none');

        // ADVANCE TIMER
        await act(async () => {
            jest.advanceTimersByTime(16);
        });

        // RECOVERY: Should be 'flex'
        expect(getTabDisplay(tabId)).toBe('flex');
    });

    it('Scenario 2: Selection Persistence after Shuffle', async () => {
        let root: any;
        await act(async () => {
            root = renderer.create(<MassiveFileViewerScreen />);
        });

        const tabId = Object.keys(instanceProps)[0];
        
        // Simulate selection
        await act(async () => {
            instanceProps[tabId].onSelectionChanged(tabId, 12, [0,1,2], undefined, true);
        });

        // Shuffle
        await act(async () => {
            instanceProps[tabId].triggerTabShuffle(tabId);
            jest.advanceTimersByTime(16);
        });

        // Verify selection is still 12 (check if header renders correctly)
        // Find text starting with "12"
        const headerText = root.root.findAll((node: any) => 
            node.type === 'Text' && node.props.children && node.props.children.toString().startsWith('12')
        );
        expect(headerText.length).toBeGreaterThan(0);
    });
});
