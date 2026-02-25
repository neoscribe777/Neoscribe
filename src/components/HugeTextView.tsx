import React, { useImperativeHandle, useRef } from 'react';
import { requireNativeComponent, ViewProps, UIManager, findNodeHandle } from 'react-native';

interface HugeTextViewProps extends ViewProps {
  path: string;
  onGenerateComplete?: (event: any) => void;
  onLineClicked?: (event: any) => void;
  onLineLongClicked?: (event: any) => void;
  onSearchProgress?: (event: any) => void;
  onSaveComplete?: (event: any) => void;
  onLinesText?: (event: any) => void;
  onSelectionChanged?: (event: any) => void;
  onSelectionModeChanged?: (event: any) => void;
  onScroll?: (event: { nativeEvent: { line: number } }) => void;
  onReplaceLimit?: (event: { nativeEvent: { total: number, limit: number } }) => void;
  onReplaceEnd?: (event: { nativeEvent: { status: string, processedCount: number, detail?: string } }) => void;
  onFileLoaded?: (event: { nativeEvent: { status: string, path: string, totalLines?: number, fileSize?: number } }) => void;
  onHardReset?: (event: any) => void;
  onJumpResult?: (event: { nativeEvent: { success: boolean, line: number, occurrenceIndex: number, totalLineMatches: number, isEmpty?: boolean } }) => void;
  targetLine?: number;
  targetNonce?: number;
  selectionMode?: boolean;
  extension?: string;
  fontSize?: number;
  backgroundColor?: string;
  textColor?: string;
  selectionColor?: string;
  lineNumberColor?: string;
  rainbowMode?: boolean;
  msgEnterSearchTerm?: string;
  msgAnalyzing?: string;
  msgMaxSelectionLimit?: string;
  msgNothingSelected?: string;
  msgCopiedLines?: string;
  msgCopyFailed?: string;
}

export interface HugeTextViewRef {
  search: (query: string, matchCase?: boolean) => void;
  generateSample: (path: string, sizeMb: number) => void;
  replaceLine: (index: number, newText: string) => void;
  reverseSearch: (query: string, matchCase?: boolean) => void;
  reverseSearchFromBottom: (query: string, matchCase?: boolean) => void;
  replaceLines: (index: number, count: number, newLines: string[]) => void;
  syncFile: () => void;
  saveToUri: (uri: string) => void;
  jumpToTop: () => void;
  jumpToBottom: () => void;
  jumpToLine: (line: number) => void;
  findPrev: (query: string, matchCase?: boolean) => void;
  copyLocalToUri: (localPath: string, destUri: string) => void;
  clearSearch: () => void;
  setSelectedLines: (indices: number[]) => void;
  getLinesText: (start: number, count: number) => void;
  finishSearch: () => void;
  findNext: (query?: string, matchCase?: boolean) => void;
  findPrevMatch: (query?: string, matchCase?: boolean) => void;
  clearSelection: () => void;
  createEmptyFile: (path: string) => void;
  selectAll: () => void;
  selectRange: (start: number, end: number) => void;
  replaceAll: (query: string, replacement: string, matchCase: boolean, applyLimit: boolean) => void;
  replace: (replacement: string) => void;
  jumpToLastSearchMatch: () => void;
  getSelectedTextForBridge: () => void;
  setSearchState: (line: number, offset: number, query: string, matchCase: boolean) => void;
  copySelectionToClipboard: () => void;
  reloadFile: () => void;
  requestSearchInfo: (query?: string, matchCase?: boolean) => void;
  jumpToOccurrence: (line: number, occurrence: number, query: string, matchCase: boolean) => void;
  exportSelectionToFile: (path: string) => void;
  dispatchCommand: (command: string | number, args?: any[]) => void;
  getNativeHandle: () => number | null;
}

const ComponentName = 'HugeTextView';

const NativeHugeTextView = requireNativeComponent<HugeTextViewProps>(ComponentName);

export const HugeTextView = React.forwardRef<HugeTextViewRef, HugeTextViewProps>((props, ref) => {
  const nativeRef = useRef(null);

  useImperativeHandle(ref, () => ({
    search: (query: string, matchCase: boolean = false) => {
      UIManager.dispatchViewManagerCommand(
        findNodeHandle(nativeRef.current),
        1, // search
        [query, matchCase]
      );
    },
    generateSample: (path: string, sizeMb: number) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          2, // generateSample
          [path, sizeMb]
        );
    },
    replaceLine: (index: number, newText: string) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          3, // replaceLine
          [index, newText]
        );
    },
    jumpToTop: () => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          4, // jumpToTop
          []
        );
    },
    jumpToBottom: () => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          5, // jumpToBottom
          []
        );
    },
    jumpToLine: (line: number) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          6, // jumpToLine
          [line]
        );
    },
    findPrev: (query: string, matchCase: boolean = false) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          7, // findPrev
          [query, matchCase]
        );
    },
    reverseSearchFromBottom: (query: string, matchCase: boolean = false) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          8, // reverseSearchFromBottom
          [query, matchCase]
        );
    },
    reverseSearch: (query: string, matchCase: boolean = false) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          9, // reverseSearch
          [query, matchCase]
        );
    },
    replaceLines: (index: number, count: number, newLines: string[]) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          10, // replaceLines
          [index, count, newLines]
        );
    },
    syncFile: () => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          11, // syncFile
          []
        );
    },
    saveToUri: (uri: string) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          12, // saveToUri
          [uri]
        );
    },
    copyLocalToUri: (localPath: string, destUri: string) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          13, // copyLocalToUri
          [localPath, destUri]
        );
    },
    clearSearch: () => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          14, // clearSearch
          []
        );
    },
    setSelectedLines: (indices: number[]) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          15, // setSelectedLines
          [indices]
        );
    },
    getLinesText: (start: number, count: number) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          16, // getLinesText
          [start, count]
        );
    },
    finishSearch: () => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          17, // finishSearch
          []
        );
    },
    findNext: (query?: string, matchCase: boolean = false) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          18, // findNext
          [query, matchCase]
        );
    },
    findPrevMatch: (query?: string, matchCase: boolean = false) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          19, // findPrev
          [query, matchCase]
        );
    },
    clearSelection: () => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          20, // clearSelection
          []
        );
    },
    createEmptyFile: (path: string) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          21, // createEmptyFile
          [path]
        );
    },
    selectAll: () => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          22, // selectAll
          []
        );
    },
    selectRange: (start: number, end: number) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          23, // selectRange
          [start, end]
        );
    },
    replaceAll: (query: string, replacement: string, matchCase: boolean = false, applyLimit: boolean = false) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          24, // replaceAll
          [query, replacement, matchCase, applyLimit]
        );
    },
    replace: (replacement: string) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          25, // replace
          [replacement]
        );
    },
    jumpToLastSearchMatch: () => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          26, // jumpToLastSearchMatch
          []
        );
    },
    getSelectedTextForBridge: () => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          27, // getSelectedTextForBridge
          []
        );
    },
    setSearchState: (line: number, offset: number, query: string, matchCase: boolean = false) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          28, // setSearchState
          [line, offset, query, matchCase]
        );
    },
    copySelectionToClipboard: () => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          29, // copySelectionToClipboard
          []
        );
    },
    reloadFile: () => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          30, // reloadFile
          []
        );
    },
    requestSearchInfo: (query?: string, matchCase: boolean = false) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          31, // requestSearchInfo
          [query, matchCase]
        );
    },
    jumpToOccurrence: (line: number, occurrence: number, query: string, matchCase: boolean = false) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          32, // jumpToOccurrence
          [line, occurrence, query, matchCase]
        );
    },
    exportSelectionToFile: (path: string) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          33, // exportSelectionToFile
          [path]
        );
    },
    dispatchCommand: (command: string | number, args: any[] = []) => {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(nativeRef.current),
          command,
          args
        );
    },
    getNativeHandle: () => findNodeHandle(nativeRef.current)
  }));

  return (
    <NativeHugeTextView 
      {...props} 
      ref={nativeRef} 
    />
  );
});
