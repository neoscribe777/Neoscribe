import React, { memo, forwardRef, useImperativeHandle, useRef } from 'react';
import { requireNativeComponent, ViewProps, UIManager, findNodeHandle } from 'react-native';

interface LargeNoteEditorProps extends ViewProps {
  text?: string;
  isDark?: boolean;
  fontSize?: number;
  wordWrap?: boolean;
  language?: string;
  customColors?: {
    text: string;
    background: string;
    primary: string;
    surface: string;
    divider: string;
    textSecondary: string;
    matchBackground?: string;
  };
  onSoraChange?: (event: { nativeEvent: { text: string } }) => void;
  onSoraSearchResult?: (event: { nativeEvent: { count: number; index: number } }) => void;
  onSoraReplaceStart?: (event: { nativeEvent: { query: string, total: number } }) => void;
  onSoraReplaceEnd?: (event: { nativeEvent: { success: boolean, processedCount?: number } }) => void;
  onSoraReplaceProgress?: (event: { nativeEvent: { current: number, total: number } }) => void;
  onSoraReplaceLimit?: (event: { nativeEvent: { total: number, limit: number } }) => void;
  onSoraPullStart?: (event: { nativeEvent: {} }) => void;
  onSoraPullEnd?: (event: { nativeEvent: {} }) => void;
  msgSoraLoading?: string;
  msgSoraPullSuccess?: string;
  msgSoraPullError?: string;
  msgSoraViewerError?: string;
}

export interface LargeNoteEditorRef {
  undo: () => void;
  redo: () => void;
  find: (query: string, matchCase: boolean) => void;
  findNext: () => void;
  findPrev: () => void;
  replace: (replacement: string) => void;
  replaceAll: (replacement: string, applyLimit?: boolean) => void;
  stopSearch: () => void;
  insertText: (text: string) => void;
  loadFromFile: (path: string) => void;
  saveToFile: (path: string) => void;
  pullFromHugeText: (hugeTextId: number) => void;
  pushToHugeText: (hugeTextId: number) => void;
  setTheme: (themeName: string) => void;
  setText: (text: string) => void;
  setText: (text: string) => void;
  getNativeHandle: () => number | null;
}

const COMPONENT_NAME = 'SoraEditorView';

const NativeLargeNoteEditor = requireNativeComponent<LargeNoteEditorProps>(COMPONENT_NAME);

// Define props accepted by the React component (which matches Native + some aliases if needed)
interface Props extends LargeNoteEditorProps {
    onChange?: (event: { nativeEvent: { text: string } }) => void;
    onSearchResult?: (event: { nativeEvent: { count: number; index: number } }) => void;
    onReplaceStart?: (event: { nativeEvent: { query: string, total: number } }) => void;
    onReplaceEnd?: (event: { nativeEvent: { success: boolean, processedCount?: number } }) => void;
    onReplaceProgress?: (event: { nativeEvent: { current: number, total: number } }) => void;
    onReplaceLimit?: (event: { nativeEvent: { total: number, limit: number } }) => void;
    onPullStart?: (event: { nativeEvent: {} }) => void;
    onPullEnd?: (event: { nativeEvent: {} }) => void;
}

const LargeNoteEditor = forwardRef<LargeNoteEditorRef, Props>((
  {
    style,
    isDark,
    customColors,
    onChange,
    onSearchResult,
    onReplaceStart,
    onReplaceEnd,
    onReplaceProgress,
    onReplaceLimit,
    onPullStart,
    onPullEnd,
    ...rest // Capture other ViewProps
  },
  ref
) => {
  const nativeRef = useRef(null);

  useImperativeHandle(ref, () => ({
    undo: () => {
      UIManager.dispatchViewManagerCommand(
        findNodeHandle(nativeRef.current),
        'undo',
        []
      );
    },
    redo: () => {
      UIManager.dispatchViewManagerCommand(
        findNodeHandle(nativeRef.current),
        'redo',
        []
      );
    },
    find: (query: string, matchCase: boolean) => {
      UIManager.dispatchViewManagerCommand(
        findNodeHandle(nativeRef.current),
        'find',
        [query, matchCase]
      );
    },
    findNext: () => {
      UIManager.dispatchViewManagerCommand(
        findNodeHandle(nativeRef.current),
        'findNext',
        []
      );
    },
    findPrev: () => {
      UIManager.dispatchViewManagerCommand(
        findNodeHandle(nativeRef.current),
        'findPrev',
        []
      );
    },
    replace: (replacement: string) => {
      UIManager.dispatchViewManagerCommand(
        findNodeHandle(nativeRef.current),
        'replace',
        [replacement]
      );
    },
    replaceAll: (replacement: string, applyLimit: boolean = false) => {
      UIManager.dispatchViewManagerCommand(
        findNodeHandle(nativeRef.current),
        'replaceAll',
        [replacement, applyLimit]
      );
    },
    stopSearch: () => {
       UIManager.dispatchViewManagerCommand(
         findNodeHandle(nativeRef.current),
         'stopSearch',
         []
       );
     },
     insertText: (text: string) => {
       UIManager.dispatchViewManagerCommand(
         findNodeHandle(nativeRef.current),
         'insertText',
         [text]
       );
     },
    loadFromFile: (path: string) => {
      UIManager.dispatchViewManagerCommand(
        findNodeHandle(nativeRef.current),
        'loadFromFile',
        [path]
      );
    },
    saveToFile: (path: string) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          'saveToFile',
          [path]
        );
    },
    pullFromHugeText: (hugeTextId: number) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          'pullFromHugeText',
          [hugeTextId]
        );
    },
    setText: (text: string) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          'setText',
          [text]
        );
    },
    pushToHugeText: (hugeTextId: number) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          'pushToHugeText',
          [hugeTextId]
        );
    },
    setTheme: (themeName: string) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          'setTheme',
          [themeName]
        );
    },
    getNativeHandle: () => findNodeHandle(nativeRef.current)
  }));

  return (
      <NativeLargeNoteEditor
        {...rest}
        ref={nativeRef}
        style={style}
        isDark={isDark}
        customColors={customColors}
        onSoraChange={onChange} 
        onSoraSearchResult={onSearchResult}
        onSoraReplaceStart={onReplaceStart}
        onSoraReplaceEnd={onReplaceEnd}
        onSoraReplaceProgress={onReplaceProgress}
        onSoraReplaceLimit={onReplaceLimit}
        onSoraPullStart={onPullStart}
        onSoraPullEnd={onPullEnd}
        msgSoraLoading={rest.msgSoraLoading}
        msgSoraPullSuccess={rest.msgSoraPullSuccess}
        msgSoraPullError={rest.msgSoraPullError}
        msgSoraViewerError={rest.msgSoraViewerError}
      />
  );
});

export default memo(LargeNoteEditor);
