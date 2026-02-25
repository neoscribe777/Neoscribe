import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, TextInput, Alert, Modal, ToastAndroid, ActivityIndicator, ScrollView } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { HugeTextView, HugeTextViewRef } from './HugeTextView';
import LargeNoteEditor, { LargeNoteEditorRef } from './LargeNoteEditor';
import { SoraNavigationBar } from './SoraNavigationBar';
import { ThemeColors } from '../theme/themePresets';
import { createEmptyFileWithSAF } from '../services/scoped-storage-service';
import { launchImageLibrary } from 'react-native-image-picker';
import { NativeModules } from 'react-native';

import { RainbowBackground } from './RainbowBackground';
import { useAppTheme } from '../hooks/useAppTheme';
import { getTranslation, translations } from '../translations';
const { OCRModule } = NativeModules;

export interface FileViewerInstanceRef {
    save: () => void;
    saveCopy: (asTxt: boolean, customExt?: string, customName?: string) => void;
    jumpToLine: (line: number) => void;
    search: () => void;
    toggleSearch: () => void;
    toggleReplace: () => void;
    isDirty: boolean;
    path: string;
    name: string;
    extension: string;
    uri?: string;
    jumpToLastSearchMatch: () => void;
    findNext: () => void;
    findPrev: () => void;
    selectAll: () => void;
    clearSelection: () => void;
    copyToClipboard: () => void;
    exportSelection: () => void;
    editSelectedInSora: () => void;
    showJumpModal: () => void;
    showRangeSelectionModal: () => void;
    reload: () => void;
    copySelectionToClipboard: () => void;
    getSelectedTextForBridge: () => void;
    insertText: (text: string) => void;
    requestSearchInfo: () => void;
    exportSelectionToFile: (path: string) => void;
}

interface Props {
    tabId: string;
    path: string;
    name: string;
    extension: string;
    initialUri?: string;
    isReadOnly?: boolean;
    theme: ThemeColors;
    insets: any;
    fontSize: number;
    onDirtyChange: (id: string, isDirty: boolean) => void;
    onUriChange: (id: string, uri: string) => void;
    initialScrollLine?: number;
    initialSelectedCount?: number;
    initialSelectedIndices?: number[];
    initialSelectionRange?: { start: number, count: number };
    initialSelectionMode?: boolean;
    onSelectionChanged?: (id: string, count: number, indices: number[], range: { start: number, count: number } | undefined, mode: boolean) => void;
    onScroll: (line: number) => void;
    onClose: () => void;
    themeId?: string;
    onHardReset?: () => void;
    onLinesText?: (event: any) => void;
    onSaveComplete?: (event: any) => void;
    showStartEditing?: boolean;
    triggerTabShuffle?: (id: string) => void;
}

export const FileViewerInstance = forwardRef<FileViewerInstanceRef, Props>((props, ref) => {
    const { 
        tabId, path, name, extension, initialUri, isReadOnly, 
        theme, insets, fontSize, 
        onDirtyChange, onUriChange, onScroll, onSelectionChanged: onSelectionChangedProp,
        initialScrollLine, initialSelectedCount, initialSelectedIndices, initialSelectionRange, initialSelectionMode,
        themeId, onLinesText, onSaveComplete: onSaveCompleteProp
    } = props;

    const { language } = useAppTheme();
    const t = (key: string, params?: any) => getTranslation(language, key, params);

    const [isDirty, setIsDirty] = useState(false);
    const [uri, setUri] = useState(initialUri);
    
    // Viewer Instance Refs
    const viewerRef = useRef<HugeTextViewRef>(null);
    const soraEditorRef = useRef<LargeNoteEditorRef>(null);

    // Local State
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [replaceQuery, setReplaceQuery] = useState('');
    const [showReplace, setShowReplace] = useState(false);
    const [searchStatus, setSearchStatus] = useState({ current: 0, total: 0, line: 0, offset: 0, totalLines: 0, matchCase: false });
    const [showJumpModal, setShowJumpModal] = useState(false);
    const [jumpValue, setJumpValue] = useState('');
    const [showRangeModal, setShowRangeModal] = useState(false);
    const [rangeStart, setRangeStart] = useState('');
    const [rangeEnd, setRangeEnd] = useState('');

    const lastSearchStateRef = useRef({ line: -1, offset: -1 });
    const isClearingSelectionRef = useRef(false);
    const selectedIndicesRef = useRef<number[]>([]);
    const lastSelectionRangeRef = useRef<{ start: number, count: number } | undefined>(undefined);

    // State for Search and Selection
    const [isGlobalReplacing, setIsGlobalReplacing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectionMode, setSelectionMode] = useState(initialSelectionMode || false);
    const [selectedCount, setSelectedCount] = useState(initialSelectedCount || 0);
    const [totalLineCount, setTotalLineCount] = useState(-1);
    const [showSoraModal, setShowSoraModal] = useState(false);
    const [showSoraThemeModal, setShowSoraThemeModal] = useState(false);
    const [showSoraNavBar, setShowSoraNavBar] = useState(false);
    const [activeSoraTheme, setActiveSoraTheme] = useState('teal_dark');
    const [isLoading, setIsLoading] = useState(true);
    const [isSoraPulling, setIsSoraPulling] = useState(false);
    const [fileSize, setFileSize] = useState(0);

    const [showSearchInfoModal, setShowSearchInfoModal] = useState(false);
    const [searchAnalysisData, setSearchAnalysisData] = useState<any>(null);

    useEffect(() => {
        console.log('🟡 FILE_VIEWER: Component mounted/updated for tab:', tabId);
        console.log('🟡 FILE_VIEWER: Path:', path);
        
        // Only reset if path or tabId changed
        // We rely on onFileLoaded native event to set isLoading(true) 
        // if HugeTextView actually starts a new load process.
        // On mount, isLoading is already true by default.
    }, [tabId, path]);
    const [jumpOccurrenceLine, setJumpOccurrenceLine] = useState('');
    const [jumpOccurrenceIndex, setJumpOccurrenceIndex] = useState('1');
    const [jumpError, setJumpError] = useState<string | null>(null);

    const soraThemes = [
        { name: 'Teal Dark', id: 'teal_dark' },
        { name: 'Darcula', id: 'darcula' },
        { name: 'Eclipse', id: 'eclipse' },
        { name: 'IntelliJ Light', id: 'intellij_light' },
        { name: 'Ladies Night', id: 'ladies_night' },
        { name: 'Monokai', id: 'monokai' },
        { name: 'Obsidian', id: 'obsidian' },
        { name: 'Solarized Light', id: 'solarized_light' },
        { name: 'Tomorrow Night', id: 'tomorrow_night' },
        { name: 'Visual Studio', id: 'visual_studio' },
        { name: 'Paper Teal', id: 'paper_teal' },
        { name: 'Pure Teal', id: 'pure_teal' },
        { name: 'Dark Rainbow', id: 'dark_rainbow' },
    ];

    // Map app themes to Sora editor themes
    const getDefaultSoraTheme = (appThemeId: string): string => {
        const themeMap: { [key: string]: string } = {
            'Teal': 'teal_dark',
            'Rainbow': 'dark_rainbow',
            'Pure Teal': 'pure_teal',
            'Paper Teal': 'paper_teal',
            'Paper': 'eclipse',
            'Forest': 'obsidian',
            'Charcoal Ember': 'monokai',
        };
        return themeMap[appThemeId] || 'pure_teal';
    };
    
    // Refs for restoration
    const hasRestoredRef = useRef(false);
    const hasManuallySetSoraThemeRef = useRef(false);

    // Initialize theme on mount
    useEffect(() => {
        // Set initial theme when component mounts
        const initialSoraTheme = getDefaultSoraTheme(themeId || 'Pure Teal');
        console.log(`[SORA INIT] App Theme: ${themeId}, Initial Sora Theme: ${initialSoraTheme}`);
        setActiveSoraTheme(initialSoraTheme);
        
        // Reset manual override when app theme changes
        hasManuallySetSoraThemeRef.current = false;
        
        const timer = setTimeout(() => {
            if (soraEditorRef.current) {
                console.log(`[SORA INIT APPLY] Setting theme to: ${initialSoraTheme}`);
                // Force sync on mount
                soraEditorRef.current.setTheme(initialSoraTheme);
            } else {
                console.log(`[SORA INIT SKIP] Sora editor ref not ready yet`);
            }
        }, 500); 
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [themeId]);

    // Register instance-specific commands to parent
    useImperativeHandle(ref, () => ({
        save: handleSave,
        saveCopy: (asTxt: boolean, customExt?: string, customName?: string) => handleSaveCopy(asTxt, customExt, customName),
        jumpToLine: (line: number) => viewerRef.current?.jumpToLine(line),
        search: handleSearch,
        toggleSearch: () => setShowSearch(!showSearch),
        toggleReplace: () => setShowReplace(!showReplace),
        isDirty,
        path,
        name,
        extension,
        uri,
        jumpToLastSearchMatch: () => viewerRef.current?.jumpToLastSearchMatch(),
        findNext: () => viewerRef.current?.findNext(),
        findPrev: () => viewerRef.current?.findPrevMatch(),
        selectAll: () => viewerRef.current?.selectAll(),
        clearSelection: () => clearSelectionInternal(),
        copyToClipboard: () => viewerRef.current?.copySelectionToClipboard(),
        exportSelection: () => handleExportSelection(),
        reload: () => viewerRef.current?.reloadFile(),
        copySelectionToClipboard: () => viewerRef.current?.copySelectionToClipboard(),
        getSelectedTextForBridge: () => viewerRef.current?.getSelectedTextForBridge(),
        exportSelectionToFile: (outputPath: string) => viewerRef.current?.exportSelectionToFile(outputPath),
        editSelectedInSora: () => {
            setShowSoraModal(true);
            const handle = viewerRef.current?.getNativeHandle();
            if (handle) {
                setTimeout(() => {
                    soraEditorRef.current?.pullFromHugeText(handle);
                }, 400); 
            }
        },
        showJumpModal: () => setShowJumpModal(true),
        showRangeSelectionModal: () => setShowRangeModal(true),
        insertText: (text: string) => {
             // If not editing, open editor first
             if (!showSoraModal) {
                 setShowSoraModal(true);
                 setTimeout(() => {
                     soraEditorRef.current?.insertText(text);
                 }, 800); // Wait for modal and pull
             } else {
                 soraEditorRef.current?.insertText(text);
             }
        },
        requestSearchInfo: (query?: string) => viewerRef.current?.requestSearchInfo(query)
    }));

    const handleSoraOCR = () => {
        launchImageLibrary({ mediaType: 'photo', quality: 1 }, async (response) => {
            if (response.assets && response.assets[0].uri) {
                try {
                    // Use standard model (Latin) which ML Kit supports
                    const result = await OCRModule.recognizeText(response.assets[0].uri, 'eng_google', 'standard');
                    if (result.text) {
                        soraEditorRef.current?.insertText(result.text);
                        ToastAndroid.show(t('text_inserted'), ToastAndroid.SHORT);
                    } else {
                        ToastAndroid.show(t('no_text_found'), ToastAndroid.SHORT);
                    }
                } catch (e: any) {
                    Alert.alert('OCR Failed', String(e));
                }
            }
        });
    };

    // Local Handlers
    const setDirtyInternal = (dirty: boolean) => {
        setIsDirty(dirty);
        onDirtyChange(tabId, dirty);
    };

    const getMimeType = (ext: string | undefined): string => {
        if (!ext) return '*/*';
        const cleanExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
        
        switch (cleanExt) {
            case '.html': return 'text/html';
            case '.md': return 'text/markdown';
            case '.json': return 'application/json';
            case '.js': return 'application/javascript';
            // For everything else (txt, log, csv, xml, py, custom...) use wildcard
            // so Android does NOT override the filename extension
            default: return '*/*';
        }
    };

    const handleSave = async () => {
        if (isReadOnly) {
            Alert.alert('Read Only', 'This file is read-only.');
            return;
        }
        setIsProcessing(true);
        if (uri) {
            viewerRef.current?.saveToUri(uri);
            return;
        }
        
        // Handle Save As for new files (no URI)
        try {
            const fileName = name || 'Untitled.txt';
            const mime = getMimeType(extension || 'txt');
            // Open system picker to create file
            const newUri = await createEmptyFileWithSAF(fileName, mime);
            
            if (newUri) {
                 viewerRef.current?.saveToUri(newUri);
                 // onSaveComplete will handle state update
            } else {
                 ToastAndroid.show('Save cancelled', ToastAndroid.SHORT);
                 setIsProcessing(false);
            }
        } catch {
            Alert.alert('Save Failed', 'Could not create file.');
            setIsProcessing(false);
        }
    };

    const handleSaveCopy = async (asTxt: boolean, customExt?: string, customName?: string) => {
        try {
            let fileName;
            
            if (customName) {
                // Use custom name if provided
                if (customExt && !customName.toLowerCase().endsWith(customExt.toLowerCase())) {
                     fileName = `${customName}${customExt}`;
                } else if (!customExt && asTxt && !customName.toLowerCase().endsWith('.txt')) {
                     fileName = `${customName}.txt`;
                } else {
                     fileName = customName;
                }
            } else {
                // Default behavior
                fileName = asTxt ? `${name.split('.')[0]}.txt` : name;
                if (customExt) {
                    const base = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) : name;
                    fileName = `${base}${customExt}`;
                }
            }
            
            const mime = getMimeType(customExt);

            const newUri = await createEmptyFileWithSAF(fileName, mime);
            if (newUri) {
                viewerRef.current?.saveToUri(newUri);
                ToastAndroid.show(`Copying as ${fileName}...`, ToastAndroid.SHORT);
            }
        } catch (e) {
            Alert.alert('Save Copy Error', String(e));
        }
    };

    const handleSearch = () => {
        if (searchQuery.trim()) {
            viewerRef.current?.search(searchQuery);
        } else {
            ToastAndroid.show(t('enter_search_term'), ToastAndroid.SHORT);
        }
    };


    const handleGlobalReplace = () => {
        if (!replaceQuery) return;
        viewerRef.current?.replace(replaceQuery);
    };

    const handleGlobalReplaceAll = (applyLimit: boolean = false) => {
        if (!searchQuery) {
            ToastAndroid.show(t('enter_search_term'), ToastAndroid.SHORT);
            return;
        }
        setIsGlobalReplacing(true);
        viewerRef.current?.replaceAll(searchQuery, replaceQuery, false, applyLimit);
    };

    const handleExportSelection = async () => {
        // Logic for exporting selection (handled in original screen)
    };

    const [isSoraSaving, setIsSoraSaving] = useState(false);
    // Flag: true when a Sora push is in flight and we're waiting for the disk write to finish
    const isSoraSaveInFlightRef = useRef(false);

    const applySoraChanges = () => {
        try {
            const handle = viewerRef.current?.getNativeHandle();
            if (handle) {
                setIsSoraSaving(true);
                isSoraSaveInFlightRef.current = true;
                soraEditorRef.current?.pushToHugeText(handle);
                // Modal stays open with spinner — wait for onSaveComplete (disk write done)
            }
        } catch (e) {
            console.error('Error applying Sora changes:', e);
            setIsSoraSaving(false);
            isSoraSaveInFlightRef.current = false;
            ToastAndroid.show('Error saving changes', ToastAndroid.SHORT);
        }
    };

    const onSoraReplaceEnd = (event: any) => {
        const { success } = event.nativeEvent;
        if (!success) {
            // Push itself failed (e.g. no handle) — abort immediately
            setIsSoraSaving(false);
            isSoraSaveInFlightRef.current = false;
            ToastAndroid.show(t('failed_apply'), ToastAndroid.SHORT);
        }
        // On success: keep spinner alive — the heavy disk write in HugeTextView
        // is still running on its own executor. onSaveComplete will fire when done.
    };

    const onSoraReplaceProgress = (event: any) => {
        // Handle progress if needed
        console.log('Sora Replace Progress:', event.nativeEvent);
    };

    const onSoraReplaceLimit = (event: any) => {
        // Handle limit reached if needed
        console.log('Sora Replace Limit:', event.nativeEvent);
        ToastAndroid.show(t('sora_replace_limit_reached'), ToastAndroid.LONG);
    };

    const clearSelectionInternal = () => {
        isClearingSelectionRef.current = true;
        viewerRef.current?.clearSelection();
        setSelectionMode(false);
        setSelectedCount(0);
        selectedIndicesRef.current = [];
        lastSelectionRangeRef.current = undefined;
        if (onSelectionChangedProp) onSelectionChangedProp(tabId, 0, [], undefined, false);
        setTimeout(() => { isClearingSelectionRef.current = false; }, 300);
    };

    // Events from Native
    const onSaveComplete = (event: any) => {
        const { status, mode, detail } = event.nativeEvent;
        setIsProcessing(false);

        if (isSoraSaveInFlightRef.current) {
            // This save was triggered by a Sora push — handle the full completion here
            isSoraSaveInFlightRef.current = false;
            setIsSoraSaving(false);
            if (status === 'success') {
                // Pre-set loading=true BEFORE reloadFile() to avoid grey flash.
                // The native onHardReset + onSelectionChanged briefly sets totalLineCount=0;
                // if isLoading is false at that moment the empty overlay flashes grey.
                setIsLoading(true);
                // Disk write is confirmed done. NOW it's safe to reload and dismiss.
                viewerRef.current?.reloadFile();
                setDirtyInternal(false);
                setShowSoraModal(false);
                clearSelectionInternal();
                ToastAndroid.show(t('changes_applied'), ToastAndroid.SHORT);
                
                // --- THE HAMMER OF TRUTH ---
                // Force a full layout refresh to clear native artifacts without the 'Grey Flash'
                if (props.triggerTabShuffle) {
                    props.triggerTabShuffle();
                }
            } else {
                Alert.alert('Save Failed', detail || 'Unknown error');
            }
        } else {
            // Normal save (e.g. explicit save button)
            if (status === 'success') {
                setDirtyInternal(false);
                if (mode === 'uri') {
                    setUri(detail);
                    onUriChange(tabId, detail);
                    ToastAndroid.show(t('file_saved'), ToastAndroid.LONG);
                } else {
                    ToastAndroid.show(t('changes_synced'), ToastAndroid.SHORT);
                }
            } else {
                Alert.alert('Save Failed', detail || 'Unknown error');
            }
        }
        if (onSaveCompleteProp) onSaveCompleteProp(event);
    };

    const onGlobalReplaceEnd = (event: any) => {
        const { status, processedCount, detail } = event.nativeEvent;
        setIsGlobalReplacing(false);
        if (status === 'success') {
            const count = processedCount || 0;
            ToastAndroid.show(t('replaced_matches', { count: count.toLocaleString() }), ToastAndroid.LONG);
            setDirtyInternal(true);
            setIsLoading(true); // Pre-set loading to prevent grey flash during reload
            viewerRef.current?.reloadFile(); // Trigger full refresh as requested
            
            setSearchQuery('');
            setReplaceQuery('');
            viewerRef.current?.finishSearch();
            setShowSearch(false);
            setShowReplace(false);
        } else {
            Alert.alert('Replace Failed', detail || 'Unknown error');
        }
    };

    const onSelectionChanged = (e: any) => {
        if (isClearingSelectionRef.current) return;
        const { count, totalLineCount: total, indices, rangeStartIndex, rangeCount } = e.nativeEvent;
        setSelectedCount(count || 0);
        setTotalLineCount(total || 0);
        if (indices) selectedIndicesRef.current = indices;
        if (rangeCount > 0) lastSelectionRangeRef.current = { start: rangeStartIndex, count: rangeCount };
        
        if (onSelectionChangedProp) {
            onSelectionChangedProp(tabId, count || 0, indices || [], rangeCount > 0 ? { start: rangeStartIndex, count: rangeCount } : undefined, selectionMode);
        }
    };

    const renderInstanceHeader = () => {
        // Parent MassiveFileViewerScreen now handles the selection header.
        // We return null here to avoid duplicate headers.
        if (selectionMode && !showSearch) {
             return null;
        }

        if (showSearch) {
            return (
                <View 
                    collapsable={false} 
                    style={[
                        styles.header, 
                        { 
                            height: showReplace ? 100 : 50, 
                            backgroundColor: theme.surface, 
                            borderBottomWidth: 1, 
                            borderBottomColor: theme.divider,
                            zIndex: 9999, 
                            elevation: 50 // 🚀 Stay above native text
                        }
                    ]}
                >
                    <View style={{ flex: 1 }}>
                        <View style={styles.searchContainer}>
                            <TouchableOpacity 
                                onPress={() => { 
                                    viewerRef.current?.finishSearch(); 
                                    setShowSearch(false); 
                                    // Full refresh on close as requested, but only if we might have changed something 
                                    // or just explicitly as requested by user.
                                    viewerRef.current?.reloadFile();
                                }} 
                                style={styles.headerIcon}
                            >
                                <MaterialCommunityIcons name="close" size={24} color={themeId === 'Rainbow' ? 'white' : theme.text} style={themeId === 'Rainbow' ? styles.outlineEffect : {}} />
                            </TouchableOpacity>
                            <TextInput
                                style={[styles.searchInput, { color: theme.text }]}
                                placeholder={t('find')}
                                placeholderTextColor={theme.textSecondary}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoFocus
                                onSubmitEditing={handleSearch}
                                returnKeyType="search"
                            />
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {searchStatus.total > 0 && (
                                    <Text style={{ color: theme.textSecondary, fontSize: 13, marginRight: 8, fontWeight: 'bold' }}>
                                        {searchStatus.current} / {searchStatus.total}
                                    </Text>
                                )}
                                <TouchableOpacity onPress={() => setShowReplace(!showReplace)} style={styles.headerIconSmall}>
                                    <MaterialCommunityIcons name={showReplace ? "chevron-up" : "swap-horizontal"} size={24} color={showReplace ? (themeId === 'Rainbow' ? 'white' : theme.primary) : theme.textSecondary} style={themeId === 'Rainbow' && showReplace ? styles.outlineEffect : {}} />
                                </TouchableOpacity>
                                 <TouchableOpacity onPress={() => viewerRef.current?.requestSearchInfo(searchQuery)} style={styles.headerIconSmall}>
                                    <MaterialCommunityIcons name="target" size={24} color={themeId === 'Rainbow' ? 'white' : theme.textSecondary} style={themeId === 'Rainbow' ? styles.outlineEffect : {}} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => viewerRef.current?.findPrevMatch(searchQuery)} style={styles.headerIconSmall}>
                                    <MaterialCommunityIcons name="chevron-up" size={24} color={themeId === 'Rainbow' ? 'white' : theme.textSecondary} style={themeId === 'Rainbow' ? styles.outlineEffect : {}} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => viewerRef.current?.findNext(searchQuery)} style={styles.headerIconSmall}>
                                    <MaterialCommunityIcons name="chevron-down" size={24} color={themeId === 'Rainbow' ? 'white' : theme.primary} style={themeId === 'Rainbow' ? styles.outlineEffect : {}} />
                                </TouchableOpacity>
                            </View>
                        </View>
                        {showReplace && (
                            <View style={[styles.searchContainer, { borderTopWidth: 1, borderTopColor: theme.divider }]}>
                                <View style={styles.headerIcon} />
                                <TextInput
                                    style={[styles.searchInput, { color: theme.text }]}
                                    placeholder={t('replace_with')}
                                    placeholderTextColor={theme.textSecondary}
                                    value={replaceQuery}
                                    onChangeText={setReplaceQuery}
                                />
                                <TouchableOpacity onPress={handleGlobalReplace} style={[styles.replaceBtn, themeId === 'Rainbow' ? { backgroundColor: 'transparent', overflow: 'hidden' } : { backgroundColor: theme.primary }]}>
                                    {themeId === 'Rainbow' && <RainbowBackground style={StyleSheet.absoluteFill} />}
                                    <Text style={[styles.replaceBtnText, themeId === 'Rainbow' ? styles.outlineEffect : {}]}>{t('replace')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleGlobalReplaceAll(false)} style={[styles.replaceBtn, themeId === 'Rainbow' ? { backgroundColor: 'transparent', overflow: 'hidden' } : { backgroundColor: theme.accent || theme.primary }]}>
                                    {themeId === 'Rainbow' && <RainbowBackground style={StyleSheet.absoluteFill} />}
                                    <Text style={[styles.replaceBtnText, themeId === 'Rainbow' ? styles.outlineEffect : {}]}>{t('replace_all')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            );
        }
        return null;
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {renderInstanceHeader()}
            
            <View style={[styles.viewerContainer, { backgroundColor: theme.background }]} collapsable={false}>
                <HugeTextView 
                    ref={viewerRef}
                    style={[styles.hugeText, { backgroundColor: theme.background }]} 
                    path={path} 
                    selectionMode={selectionMode}
                    extension={extension}
                    fontSize={fontSize} 
                    backgroundColor={theme.background}
                    textColor={theme.text}
                    selectionColor={theme.primary}
                    lineNumberColor={theme.textSecondary}
                    rainbowMode={themeId === 'Rainbow'}
                    msgEnterSearchTerm={t('enter_search_first')}
                    msgAnalyzing={t('analyzing_huge_file')}
                    msgMaxSelectionLimit={t('max_selection_reached_msg')}
                    msgNothingSelected={t('nothing_selected')}
                    msgCopiedLines={translations[language]?.copied_lines || translations.en.copied_lines}
                    msgCopyFailed={translations[language]?.copy_failed_msg || translations.en.copy_failed_msg}
                    onFileLoaded={(e) => {
                        if (e.nativeEvent.status === 'loading') {
                            setIsLoading(true);
                            if (e.nativeEvent.fileSize) {
                                setFileSize(e.nativeEvent.fileSize);
                            }
                        } else if (e.nativeEvent.status === 'success') {
                            const lineCount = e.nativeEvent.totalLines || 0;
                            console.log('🟡 FILE_VIEWER: File loaded successfully, totalLines:', lineCount, 'path:', path);
                            setIsLoading(false);
                            setTotalLineCount(lineCount);
                            
                            // Restore state if needed (only once)
                            if (!hasRestoredRef.current) {
                                hasRestoredRef.current = true;
                                if (initialScrollLine && initialScrollLine > 0) {
                                    setTimeout(() => viewerRef.current?.jumpToLine(initialScrollLine), 100);
                                }
                                if (initialSelectionMode) {
                                    setSelectionMode(true);
                                    if (initialSelectedIndices && initialSelectedIndices.length > 0) {
                                        setTimeout(() => viewerRef.current?.setSelectedLines(initialSelectedIndices), 200);
                                    } else if (initialSelectionRange) {
                                        setTimeout(() => viewerRef.current?.selectRange(initialSelectionRange.start, initialSelectionRange.start + initialSelectionRange.count - 1), 200);
                                    }
                                }
                            }
                        }
                    }}
                    onSearchProgress={(e) => {
                        const data = e.nativeEvent;
                        setSearchStatus({
                            current: data.current,
                            total: data.total,
                            line: data.line,
                            offset: data.offset,
                            totalLines: data.totalLines || searchStatus.totalLines,
                            matchCase: data.matchCase !== undefined ? data.matchCase : (searchStatus.matchCase || false)
                        });
                        if (data.line !== undefined && data.line !== -1) {
                            lastSearchStateRef.current = { line: data.line, offset: data.offset };
                        }
                        
                        if (data.isFullReport) {
                            setSearchAnalysisData(data);
                            setJumpOccurrenceLine((data.line + 1).toString());
                            setJumpOccurrenceIndex(data.current.toString());
                            setShowSearchInfoModal(true);
                        }
                    }}
                    onSaveComplete={onSaveComplete}
                    onReplaceEnd={onGlobalReplaceEnd}
                    onLinesText={onLinesText}
                    onHardReset={() => {
                        setShowSearch(false);
                        setShowReplace(false);
                        setSearchQuery('');
                        setReplaceQuery('');
                        setSelectionMode(false);
                        setSelectedCount(0);
                        setSearchStatus({ current: 0, total: 0, line: 0, offset: 0, totalLines: 0, matchCase: false });
                        setShowRangeModal(false);
                        if (props.onHardReset) props.onHardReset();
                    }}
                    onScroll={(e) => onScroll(e.nativeEvent.line)}
                    onSelectionChanged={onSelectionChanged}
                    onSelectionModeChanged={(e) => {
                        setSelectionMode(e.nativeEvent.active);
                        if (onSelectionChangedProp) onSelectionChangedProp(tabId, selectedCount, selectedIndicesRef.current, lastSelectionRangeRef.current, e.nativeEvent.active);
                    }}
                    onLineClicked={(e) => {
                        if (!selectionMode) {
                            setSelectionMode(true);
                            viewerRef.current?.setSelectedLines([e.nativeEvent.index]);
                        }
                    }}
                    onLineLongClicked={(_e) => {
                        if (!selectionMode) {
                            // Immediately activate selection mode in native component
                            // This ensures the translucent selection rectangle appears instantly
                            setSelectionMode(true);
                        }
                    }}
                    onJumpResult={(e) => {
                        const { success, line, occurrenceIndex, totalLineMatches, isEmpty } = e.nativeEvent;
                        if (success) {
                            setShowSearchInfoModal(false);
                            setJumpError(null);
                        } else {
                            if (isEmpty) {
                                setJumpError(`Line ${line + 1} is empty.`);
                            } else {
                                setJumpError(`Line ${line + 1} has ${totalLineMatches} matches. (Match #${occurrenceIndex} not found)`);
                            }
                        }
                    }}
                />
            </View>

            {isLoading && (
                <View style={[styles.emptyOverlay, { backgroundColor: theme.background + 'EE' }]}>
                    <ActivityIndicator size="large" color={themeId === 'Rainbow' ? 'white' : theme.primary} />
                    <Text style={[styles.startEditingText, { marginTop: 15, color: theme.text }]}>{t('loading_large_file')}</Text>
                    {fileSize > 5 * 1024 * 1024 * 1024 && (
                        <Text style={[styles.startEditingSubtext, { color: theme.textSecondary }]}>{t('massive_file_msg')}</Text>
                    )}
                </View>
            )}

            {(() => {
                const isExportOrShared = name.includes('Export_') || name.includes('Shared_') || name.includes('shared_');
                const shouldHideOverlay = !props.showStartEditing || isExportOrShared;
                
                if (totalLineCount === 0 && !selectionMode && !showSearch && !showSoraModal && !isProcessing && !isLoading) {
                    console.log('🟡 FILE_VIEWER: Overlay check - showStartEditing:', props.showStartEditing, 'isExportOrShared:', isExportOrShared, 'name:', name);
                }

                if (!shouldHideOverlay && totalLineCount === 0 && !selectionMode && !showSearch && !showSoraModal && !isProcessing && !isLoading) {
                    return (
                        <View style={[styles.emptyOverlay, { backgroundColor: theme.background }]}>
                    <TouchableOpacity 
                        style={[styles.startEditingBtn, themeId === 'Rainbow' ? { backgroundColor: 'transparent', overflow: 'hidden' } : { backgroundColor: theme.primary }]}
                        onPress={() => {
                            setShowSoraModal(true);
                        }}
                    >
                        {themeId === 'Rainbow' && <RainbowBackground style={StyleSheet.absoluteFill} />}
                        <MaterialCommunityIcons name="pencil-plus-outline" size={40} color="white" style={themeId === 'Rainbow' ? styles.outlineEffect : {}} />
                        <Text style={[styles.startEditingText, themeId === 'Rainbow' ? styles.outlineEffect : {}]}>{t('start_editing')}</Text>
                        <Text style={[styles.startEditingSubtext, themeId === 'Rainbow' ? styles.outlineEffect : {}]}>{t('click_to_open')}</Text>
                    </TouchableOpacity>
                </View>
            );
                }
                return null;
            })()}


            {/* SORA EDITOR FULL SCREEN MODAL */}
            <Modal 
                visible={showSoraModal} 
                animationType="slide" 
                onRequestClose={() => setShowSoraModal(false)} 
                statusBarTranslucent
                onShow={() => {
                   // Sync theme
                   if (themeId) {
                       let themeToSet = getDefaultSoraTheme(themeId);
                       
                       // Only use manual theme if we actually picked one in this session
                       if (hasManuallySetSoraThemeRef.current) {
                           themeToSet = activeSoraTheme;
                       } else {
                           setActiveSoraTheme(themeToSet);
                       }

                       console.log(`[SORA THEME SYNC] App Theme: ${themeId}, Mapped Sora Theme: ${themeToSet}, Manual Override: ${hasManuallySetSoraThemeRef.current}`);
                       
                       // Apply theme after a short delay to ensure editor is ready
                       setTimeout(() => {
                           console.log(`[SORA THEME APPLY] Setting theme to: ${themeToSet}`);
                           soraEditorRef.current?.setTheme(themeToSet);
                       }, 200);
                   }
                   
                   // Pull content ONLY when modal is actually shown
                   const handle = viewerRef.current?.getNativeHandle();
                   if (handle) {
                        try {
                            // Clear first to avoid ghosting or stale content
                            soraEditorRef.current?.setText(''); 
                        } catch {
                            // Ignore if native ref not ready
                        }
                        
                        setTimeout(() => {
                            soraEditorRef.current?.pullFromHugeText(handle);
                        }, 200); 
                   }
                }}
            >
                <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top }}>
                     <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.divider, borderBottomWidth: 1, height: 56 }]}>
                         <TouchableOpacity onPress={() => setShowSoraModal(false)} style={styles.headerIcon}>
                             <MaterialCommunityIcons name="close" size={24} color={themeId === 'Rainbow' ? 'white' : theme.text} style={themeId === 'Rainbow' ? styles.outlineEffect : {}} />
                         </TouchableOpacity>
                          <View style={{flex: 1, paddingLeft: 10}}>
                             <Text style={[styles.title, {color: themeId === 'Rainbow' ? 'white' : theme.text, fontSize: 16}, themeId === 'Rainbow' ? styles.outlineEffect : {}]} numberOfLines={1}>
                                 {name}
                            </Text>
                         </View>
                         <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <TouchableOpacity 
                                onPress={() => soraEditorRef.current?.undo()} 
                                style={[styles.headerIconSmall, isSoraPulling && { opacity: 0.5 }]}
                                disabled={isSoraPulling}
                            >
                                <MaterialCommunityIcons name="undo" size={22} color={themeId === 'Rainbow' ? 'white' : theme.text} style={themeId === 'Rainbow' ? styles.outlineEffect : {}} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => soraEditorRef.current?.redo()} 
                                style={[styles.headerIconSmall, isSoraPulling && { opacity: 0.5 }]}
                                disabled={isSoraPulling}
                            >
                                <MaterialCommunityIcons name="redo" size={22} color={themeId === 'Rainbow' ? 'white' : theme.text} style={themeId === 'Rainbow' ? styles.outlineEffect : {}} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={handleSoraOCR} 
                                style={[styles.headerIconSmall, isSoraPulling && { opacity: 0.5 }]}
                                disabled={isSoraPulling}
                            >
                                <MaterialCommunityIcons name="text-recognition" size={22} color={themeId === 'Rainbow' ? 'white' : theme.primary} style={themeId === 'Rainbow' ? styles.outlineEffect : {}} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => setShowSoraThemeModal(true)} 
                                style={[styles.headerIconSmall, isSoraPulling && { opacity: 0.5 }]}
                                disabled={isSoraPulling}
                            >
                                <MaterialCommunityIcons name="palette" size={24} color={themeId === 'Rainbow' ? 'white' : theme.text} style={themeId === 'Rainbow' ? styles.outlineEffect : {}} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => setShowSoraNavBar(!showSoraNavBar)} 
                                style={[styles.headerIconSmall, isSoraPulling && { opacity: 0.5 }]}
                                disabled={isSoraPulling}
                            >
                                <MaterialCommunityIcons name="code-braces" size={22} color={showSoraNavBar ? (themeId === 'Rainbow' ? 'white' : theme.primary) : (themeId === 'Rainbow' ? 'rgba(255,255,255,0.5)' : theme.textSecondary)} style={themeId === 'Rainbow' ? styles.outlineEffect : {}} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => applySoraChanges()} 
                                style={styles.headerIcon}
                                disabled={isSoraSaving || isSoraPulling}
                            >
                                {(isSoraSaving || isSoraPulling) ? (
                                    <ActivityIndicator size="small" color={themeId === 'Rainbow' ? 'white' : theme.primary} />
                                ) : (
                                    <MaterialCommunityIcons name="check-bold" size={26} color={themeId === 'Rainbow' ? 'white' : theme.primary} style={themeId === 'Rainbow' ? styles.outlineEffect : {}} />
                                )}
                            </TouchableOpacity>
                         </View>
                     </View>
                     {showSoraNavBar && (
                         <SoraNavigationBar onSymbolPress={(symbol) => soraEditorRef.current?.insertText(symbol)} />
                     )}
                     <View style={{flex: 1}}>
                        <LargeNoteEditor
                           ref={soraEditorRef}
                           style={{flex: 1}}
                           isDark={theme.isDark}
                           customColors={{
                               background: theme.background,
                               text: theme.text,
                               primary: theme.primary,
                               surface: theme.surface,
                               divider: theme.divider,
                               textSecondary: theme.textSecondary
                           }}
                           fontSize={14}
                           language={extension?.replace('.', '') || ''}
                           onChange={() => setDirtyInternal(true)}
                           onPullStart={() => setIsSoraPulling(true)}
                           onPullEnd={() => setIsSoraPulling(false)}
                           onReplaceEnd={onSoraReplaceEnd}
                           onReplaceProgress={onSoraReplaceProgress}
                           onReplaceLimit={onSoraReplaceLimit}
                           msgSoraLoading={t('sora_loading')}
                           msgSoraPullSuccess={t('sora_pull_success')}
                           msgSoraPullError={t('sora_pull_error')}
                           msgSoraViewerError={t('sora_viewer_error')}
                        />
                     </View>
                     <View style={{ height: insets.bottom, backgroundColor: theme.surface }} />
                </View>

                {/* SORA THEME PICKER MODAL */}
                <Modal visible={showSoraThemeModal} transparent animationType="fade" onRequestClose={() => setShowSoraThemeModal(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={[styles.editModal, { backgroundColor: theme.surface }]}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Editor Theme</Text>
                            <ScrollView style={{ maxHeight: 300 }}>
                                {soraThemes.map((themeItem) => (
                                    <TouchableOpacity 
                                        key={themeItem.id} 
                                        style={[
                                            styles.themePickerItem, 
                                            activeSoraTheme === themeItem.id && { backgroundColor: theme.primary + '33', borderLeftWidth: 5, borderLeftColor: theme.primary }
                                        ]}
                                        onPress={() => {
                                            setActiveSoraTheme(themeItem.id);
                                            hasManuallySetSoraThemeRef.current = true;
                                            soraEditorRef.current?.setTheme(themeItem.id);
                                            setShowSoraThemeModal(false);
                                        }}
                                    >
                                        <Text style={{ 
                                            color: activeSoraTheme === themeItem.id ? theme.primary : theme.text,
                                            fontWeight: activeSoraTheme === themeItem.id ? 'bold' : 'normal',
                                            paddingVertical: 12,
                                            paddingHorizontal: 10,
                                            fontSize: 16
                                        }}>{themeItem.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>


                            <TouchableOpacity 
                                onPress={() => setShowSoraThemeModal(false)}
                                style={{ marginTop: 15, alignSelf: 'flex-end', padding: 10 }}
                            >
                                <Text style={{ color: theme.primary, fontWeight: 'bold' }}>{t('close')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </Modal>

            {/* Jump Modal */}
            <Modal visible={showJumpModal} transparent animationType="slide" onRequestClose={() => setShowJumpModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.editModal, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>{t('jump_to_line')}</Text>
                        <TextInput 
                            style={[styles.editInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.divider, borderWidth: 1 }]} 
                            placeholder={t('line_number')} 
                            placeholderTextColor={theme.textSecondary}
                            value={jumpValue} 
                            onChangeText={setJumpValue} 
                            keyboardType="numeric" 
                            autoFocus 
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setShowJumpModal(false)} style={styles.modalButtonCancel}>
                                <Text style={styles.modalButtonTextCancel}>{t('cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => {
                                    const l = parseInt(jumpValue, 10);
                                    if (!isNaN(l)) viewerRef.current?.jumpToLine(l - 1);
                                    setShowJumpModal(false);
                                }} 
                                style={[styles.modalButtonSave, themeId === 'Rainbow' ? { backgroundColor: 'transparent', overflow: 'hidden' } : { backgroundColor: theme.primary }]}
                            >
                                {themeId === 'Rainbow' && <RainbowBackground style={StyleSheet.absoluteFill} />}
                                <Text style={[styles.modalButtonTextSave, themeId === 'Rainbow' ? styles.outlineEffect : {}]}>{t('jump')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Selection Range Modal */}
            <Modal visible={showRangeModal} transparent animationType="fade" onRequestClose={() => setShowRangeModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.editModal, { backgroundColor: theme.surface }]}>
                                <Text style={[styles.modalTitle, { color: theme.text }]}>{t('select_line_range')}</Text>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, gap: 10}}>
                            <View style={{flex: 1}}>
                                <Text style={{color: theme.textSecondary, fontSize: 12, marginBottom: 5}}>{t('from')}</Text>
                                <TextInput style={[styles.editInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.divider, borderWidth: 1 }]} placeholder="1" placeholderTextColor={theme.textSecondary} keyboardType="numeric" value={rangeStart} onChangeText={setRangeStart} />
                            </View>
                            <View style={{flex: 1}}>
                                <Text style={{color: theme.textSecondary, fontSize: 12, marginBottom: 5}}>{t('to')}</Text>
                                <TextInput style={[styles.editInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.divider, borderWidth: 1 }]} placeholder={totalLineCount.toString()} placeholderTextColor={theme.textSecondary} keyboardType="numeric" value={rangeEnd} onChangeText={setRangeEnd} />
                            </View>
                        </View>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setShowRangeModal(false)} style={styles.modalButtonCancel}>
                                <Text style={styles.modalButtonTextCancel}>{t('cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => {
                                    const s = parseInt(rangeStart, 10) - 1;
                                    const e = parseInt(rangeEnd, 10) - 1;
                                    if (!isNaN(s) && !isNaN(e)) {
                                        viewerRef.current?.clearSelection();
                                        viewerRef.current?.selectRange(s, e);
                                    }
                                    setShowRangeModal(false);
                                }} 
                                style={[styles.modalButtonSave, { backgroundColor: theme.primary }]}
                            >
                                <Text style={styles.modalButtonTextSave}>{t('select_btn')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showSearchInfoModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => {
                    setShowSearchInfoModal(false);
                    setJumpError(null);
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.editModal, { backgroundColor: theme.surface, maxHeight: '80%' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={[styles.modalTitle, { color: theme.text, marginBottom: 0 }]}>{t('search_analysis')}</Text>
                            <TouchableOpacity onPress={() => {
                                setShowSearchInfoModal(false);
                                setJumpError(null);
                            }}>
                                <MaterialCommunityIcons name="close" size={24} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {searchAnalysisData && (
                                <View style={{ gap: 15 }}>
                                    <View style={[{ padding: 12, borderRadius: 8, overflow: 'hidden' }, themeId === 'Rainbow' ? { backgroundColor: 'transparent' } : { backgroundColor: theme.background }]}>
                                        {themeId === 'Rainbow' && <RainbowBackground style={StyleSheet.absoluteFill} />}
                                        <Text style={[{ color: theme.textSecondary, fontSize: 12, marginBottom: 4 }, themeId === 'Rainbow' ? styles.outlineEffect : {}]}>{t('search_query')}</Text>
                                        <Text style={[{ fontSize: 16, fontWeight: 'bold' }, themeId === 'Rainbow' ? [{ color: 'white' }, styles.outlineEffect] : { color: theme.primary }]}>"{searchAnalysisData.query}"</Text>
                                    </View>

                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <View style={{ flex: 1, backgroundColor: theme.background, padding: 12, borderRadius: 8 }}>
                                            <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 4 }}>{t('total_matches')}</Text>
                                            <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>{searchAnalysisData.totalMatchesInFile.toLocaleString()}</Text>
                                        </View>
                                        <View style={{ flex: 1, backgroundColor: theme.background, padding: 12, borderRadius: 8 }}>
                                            <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 4 }}>{t('total_lines')}</Text>
                                            <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>{searchAnalysisData.totalLines.toLocaleString()}</Text>
                                        </View>
                                    </View>

                                    <View style={{ backgroundColor: theme.background, padding: 12, borderRadius: 8 }}>
                                        <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 4 }}>{t('current_position')}</Text>
                                        <Text style={{ color: theme.text, fontSize: 14 }}>
                                            <Text style={[{ fontWeight: 'bold' }, themeId === 'Rainbow' ? [{ color: 'white' }, styles.outlineEffect] : { color: theme.primary }]}>Result {searchAnalysisData.globalRank.toLocaleString()}</Text> of {searchAnalysisData.totalMatchesInFile.toLocaleString()} (Global)
                                        </Text>
                                        <Text style={{ color: theme.text, fontSize: 14, marginTop: 4 }}>
                                            <Text style={{ fontWeight: 'bold' }}>Line {searchAnalysisData.line + 1}</Text>, Match {searchAnalysisData.current} / {searchAnalysisData.total} (Local)
                                        </Text>
                                    </View>

                                    <View style={{ height: 1, backgroundColor: theme.divider, marginVertical: 10 }} />

                                    <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16 }}>{t('jump_specific')}</Text>
                                    
                                    {jumpError && (
                                        <View style={{ backgroundColor: '#FFEBEE', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#FFCDD2' }}>
                                            <Text style={{ color: '#D32F2F', fontSize: 13, fontWeight: '500' }}>{jumpError}</Text>
                                        </View>
                                    )}

                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 4 }}>{t('line_number')}</Text>
                                            <TextInput
                                                style={[styles.editInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.divider }]}
                                                keyboardType="numeric"
                                                value={jumpOccurrenceLine}
                                                onChangeText={(text) => {
                                                    setJumpOccurrenceLine(text);
                                                    setJumpError(null);
                                                }}
                                                placeholder="Line #"
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 4 }}>{t('occurrence_index')}</Text>
                                            <TextInput
                                                style={[styles.editInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.divider }]}
                                                keyboardType="numeric"
                                                value={jumpOccurrenceIndex}
                                                onChangeText={(text) => {
                                                    setJumpOccurrenceIndex(text);
                                                    setJumpError(null);
                                                }}
                                                placeholder="1"
                                            />
                                        </View>
                                    </View>

                                     <TouchableOpacity
                                        style={[styles.modalButtonSave, themeId === 'Rainbow' ? { backgroundColor: 'transparent', overflow: 'hidden' } : { backgroundColor: theme.primary }, { alignItems: 'center', marginTop: 10 }]}
                                        onPress={() => {
                                            const line = parseInt(jumpOccurrenceLine, 10) - 1;
                                            const occurrences = parseInt(jumpOccurrenceIndex, 10);
                                            if (!isNaN(line) && !isNaN(occurrences)) {
                                                setJumpError(null);
                                                viewerRef.current?.jumpToOccurrence(
                                                    line, 
                                                    occurrences, 
                                                    searchAnalysisData.query, 
                                                    searchStatus.matchCase || false
                                                );
                                                // Note: we don't close the modal here anymore. 
                                                // onJumpResult will close it IF successful.
                                            } else {
                                                setJumpError(t('jump_error_numbers'));
                                            }
                                        }}
                                    >
                                        {themeId === 'Rainbow' && <RainbowBackground style={StyleSheet.absoluteFill} />}
                                        <Text style={[styles.modalButtonTextSave, themeId === 'Rainbow' ? styles.outlineEffect : {}]}>{t('jump_fetch')}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {(isProcessing || isGlobalReplacing) && (
                 <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }]}>
                    <ActivityIndicator size="large" color={themeId === 'Rainbow' ? 'white' : theme.primary} />
                    {isGlobalReplacing && <Text style={{ marginTop: 15, color: '#fff', fontWeight: 'bold' }}>{t('replacing_all')}</Text>}
                </View>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    container: { flex: 1 },
    outlineEffect: {
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 1.5,
    },
    header: { flexDirection: 'row', alignItems: 'center', height: 50, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.1)' },
    headerIcon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerIconSmall: { width: 40, height: 44, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 14, fontWeight: 'bold' },
    searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5 },
    searchInput: { flex: 1, fontSize: 15, paddingHorizontal: 10 },
    replaceBtn: { paddingHorizontal: 10, height: 32, borderRadius: 4, justifyContent: 'center', marginLeft: 5 },
    replaceBtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    viewerContainer: { flex: 1, overflow: 'hidden' },
    hugeText: { flex: 1 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    editModal: { width: '100%', backgroundColor: '#fff', borderRadius: 12, padding: 20, elevation: 15 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
    editInput: { borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1, borderColor: '#ddd' },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, gap: 15 },
    modalButtonCancel: { padding: 10 },
    modalButtonSave: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
    modalButtonTextCancel: { fontWeight: 'bold', color: '#666' },
    modalButtonTextSave: { fontWeight: 'bold', color: '#fff' },
    emptyOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10
    },
    startEditingBtn: {
        width: 300,
        height: 180,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    startEditingText: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 10
    },
    startEditingSubtext: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        marginTop: 5
    },
    themePickerItem: {
        width: '100%',
    }
});
