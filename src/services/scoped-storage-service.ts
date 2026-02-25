import * as ScopedStorage from 'react-native-scoped-storage';
import { Alert } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

/**
 * Saves a file using Android's Scoped Storage Framework (SAF).
 * returns the saved file info or null if failed/cancelled.
 */
export async function saveFileWithSAF(
  base64Data: string, 
  fileName: string, 
  mimeType: string
): Promise<{ uri: string, name: string } | null> {
  console.log('[SAF] ========== STARTING SAF SAVE ==========');
  
  // Sanitize filename
  const safeFileName = fileName
    .replace(/[^\x00-\x7F]/g, '_')
    .replace(/[\\/:"*?<>|]/g, '_');
  
  const CreateDocument = ScopedStorage.createDocument || (ScopedStorage as any).default?.createDocument;

  if (!CreateDocument) {
    Alert.alert('System Error', 'Scoped Storage module not found.');
    return null;
  }

  try {
    console.log(`[SAF] Saving ${safeFileName} (${mimeType})...`);
    
    const file = await CreateDocument(
      safeFileName,
      mimeType,
      base64Data,
      'base64'
    );
    
    if (!file) {
      console.log('[SAF] User cancelled');
      return null;
    }

    console.log('[SAF] Success! URI:', file.uri);
    return { uri: file.uri, name: file.name };

  } catch (error: any) {
    console.error('[SAF] Error:', error.message);
    if (error.message && error.message.includes('No activity found')) {
        Alert.alert('Save Failed', 'Could not open file picker.');
    } else {
        Alert.alert('Save Failed', `Error: ${error.message}`);
    }
    return null;
  }
}

/**
 * Creates an empty file and returns its URI (for native streaming save).
 */
export async function createEmptyFileWithSAF(
    fileName: string, 
    mimeType: string
  ): Promise<string | null> {
    const CreateDocument = ScopedStorage.createDocument || (ScopedStorage as any).default?.createDocument;
    if (!CreateDocument) return null;
    
    try {
      // We pass an empty string to create a placeholder
      const file = await CreateDocument(fileName, mimeType, '', 'utf8');
      return file ? file.uri : null;
    } catch (e) {
      console.error('[SAF] Create empty failed:', e);
      return null;
    }
  }

/**
 * Saves a file from a local path using SAF.
 */
export async function saveFileFromPathWithSAF(
  localPath: string,
  fileName: string,
  mimeType: string
): Promise<{ uri: string, name: string } | null> {
  console.log('[SAF] ========== STARTING SAF SAVE FROM PATH ==========');
  
  const CreateDocument = ScopedStorage.createDocument || (ScopedStorage as any).default?.createDocument;

  if (!CreateDocument) {
    Alert.alert('System Error', 'Scoped Storage module not found.');
    return null;
  }

  try {
    // We still have to read it once as base64 to pass to ScopedStorage library 
    // unless the library supports a 'fromFile' option. 
    // react-native-scoped-storage v1.9.5 typically wants the string payload.
    // However, if we read it in chunks or if the file is < 50MB, base64 MIGHT work 
    // but the REAL bottleneck was the library internally converting HTML.
    // For now, let's provide this utility.
    const base64Data = await ReactNativeBlobUtil.fs.readFile(localPath.replace('file://', ''), 'base64');
    
    return await saveFileWithSAF(base64Data, fileName, mimeType);

  } catch (error: any) {
    console.error('[SAF] Error:', error.message);
    Alert.alert('Save Failed', `Error: ${error.message}`);
    return null;
  }
}
/**
 * Picks a document and reads its content reliably.
 * Strategy: Copy picked content:// URI to a temp file in cache, read it, then delete.
 * Returns the file content as string or null if failed/cancelled.
 */
export async function pickAndReadFile(): Promise<{ name: string, content: string } | null> {
  console.log('[SAF] ========== STARTING SAF PICK & READ (STABLE) ==========');
  
  const OpenDocument = ScopedStorage.openDocument || (ScopedStorage as any).default?.openDocument;

  if (!OpenDocument) {
    Alert.alert('System Error', 'Scoped Storage functions not found.');
    return null;
  }

  try {
    // Open picker restricted to text files
    const file = await OpenDocument(false); // CRITICAL: false to prevent JS Memory Crash
    
    if (!file) {
      console.log('[SAF] User cancelled pick');
      return null;
    }

    console.log('[SAF] Picked file:', file.name, file.uri);

    // Strategy: Copy to local cache first to avoid content:// URI resolution issues with direct reads
    const tempPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/import_temp_${Date.now()}.txt`;
    console.log('[SAF] Creating temp copy at:', tempPath);

    // ReactNativeBlobUtil 'cp' can handle content:// URIs on Android
    await ReactNativeBlobUtil.fs.cp(file.uri, tempPath);
    
    // Read from the local file
    const content = await ReactNativeBlobUtil.fs.readFile(tempPath, 'utf8');
    
    // Clean up
    await ReactNativeBlobUtil.fs.unlink(tempPath).catch(err => console.warn('[SAF] Temp cleanup failed:', err));
    
    console.log('[SAF] Read success, content length:', content.length);
    return { name: file.name, content };

  } catch (error: any) {
    console.error('[SAF] Pick/Read Error:', error.message);
    Alert.alert('Import Failed', `Error: ${error.message}`);
    return null;
  }
}
/**
 * Picks a document and returns its metadata and a local temporary path.
 * This avoids loading large files into JavaScript memory as strings.
 * Uses binary detection (magic bytes + byte density) instead of an extension allowlist,
 * so it can open ANY text-based format regardless of extension.
 */
export async function pickAndGetFile(): Promise<{ name: string, path: string, size: number, extension: string, uri: string } | null> {
  console.log('[SAF] ========== STARTING SAF PICK (NATIVE PATH) ==========');

  /**
   * Detects binary content by:
   * 1. Checking known binary magic byte signatures
   * 2. Measuring density of null/non-printable bytes
   * Returns a description string if binary, or null if it looks like text.
   */
  const detectBinary = (base64Chunk: string): string | null => {
    // Manual base64 decode (atob is not available in React Native's Hermes JS engine)
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const bytes: number[] = [];
    const clean = base64Chunk.replace(/[^A-Za-z0-9+/]/g, '');
    for (let i = 0; i < clean.length - 3 && bytes.length < 512; i += 4) {
      const b0 = base64Chars.indexOf(clean[i]);
      const b1 = base64Chars.indexOf(clean[i + 1]);
      const b2 = base64Chars.indexOf(clean[i + 2]);
      const b3 = base64Chars.indexOf(clean[i + 3]);
      bytes.push((b0 << 2) | (b1 >> 4));
      if (clean[i + 2] !== '=') bytes.push(((b1 & 0xf) << 4) | (b2 >> 2));
      if (clean[i + 3] !== '=') bytes.push(((b2 & 0x3) << 6) | b3);
    }
    if (bytes.length === 0) return null;

    // --- Magic byte signatures ---
    const check = (sig: number[], offset = 0) =>
      sig.every((b, i) => bytes[offset + i] === b);

    if (check([0x25, 0x50, 0x44, 0x46]))        return 'PDF document';          // %PDF
    if (check([0x50, 0x4B, 0x03, 0x04]))        return 'ZIP / Office document'; // PK (DOCX, XLSX, PPTX, JAR, APK)
    if (check([0x50, 0x4B, 0x05, 0x06]))        return 'ZIP archive (empty)';
    if (check([0xFF, 0xD8, 0xFF]))               return 'JPEG image';
    if (check([0x89, 0x50, 0x4E, 0x47]))        return 'PNG image';
    if (check([0x47, 0x49, 0x46, 0x38]))        return 'GIF image';
    if (check([0x42, 0x4D]))                     return 'BMP image';
    if (check([0x4D, 0x5A]))                     return 'Windows EXE / DLL';
    if (check([0x7F, 0x45, 0x4C, 0x46]))        return 'ELF binary (Linux/Android)';
    if (check([0xCA, 0xFE, 0xBA, 0xBE]))        return 'Java class file';
    if (check([0xCE, 0xFA, 0xED, 0xFE]))        return 'Mach-O binary (macOS/iOS)';
    if (check([0x1F, 0x8B]))                     return 'GZIP archive';
    if (check([0x42, 0x5A, 0x68]))              return 'BZIP2 archive';
    if (check([0x52, 0x61, 0x72, 0x21]))        return 'RAR archive';
    if (check([0x37, 0x7A, 0xBC, 0xAF]))        return '7-Zip archive';
    if (check([0xD0, 0xCF, 0x11, 0xE0]))        return 'Legacy Office doc (DOC/XLS/PPT)'; // Compound Doc
    if (check([0x53, 0x51, 0x4C, 0x69, 0x74])) return 'SQLite database';         // SQLite
    if (check([0x4F, 0x67, 0x67, 0x53]))        return 'OGG audio/video';
    if (check([0x49, 0x44, 0x33]))              return 'MP3 audio';
    if (check([0x66, 0x74, 0x79, 0x70], 4))    return 'MP4/MOV video';           // ftyp at offset 4
    if (check([0x52, 0x49, 0x46, 0x46]))        return 'WAV/AVI/WebP media';

    // --- Byte density check ---
    // Count bytes that are not valid UTF-8 printable text or common whitespace
    let nonTextCount = 0;
    for (const byte of bytes) {
      const isTab      = byte === 0x09;
      const isNewline  = byte === 0x0A || byte === 0x0D;
      const isPrintable = byte >= 0x20 && byte <= 0x7E;
      const isUtf8High = byte >= 0x80; // Part of multi-byte UTF-8 (valid for non-latin text)
      if (!isTab && !isNewline && !isPrintable && !isUtf8High) {
        nonTextCount++; // Null bytes and other control chars are the real tell
      }
    }

    const binaryRatio = nonTextCount / bytes.length;
    console.log(`[SAF] Binary ratio: ${(binaryRatio * 100).toFixed(1)}% (${nonTextCount}/${bytes.length} non-text bytes)`);

    if (binaryRatio > 0.15) {
      return `binary data (${(binaryRatio * 100).toFixed(0)}% non-text bytes)`;
    }

    return null; // Looks like text — safe to open
  };

  const OpenDocument = ScopedStorage.openDocument || (ScopedStorage as any).default?.openDocument;

  if (!OpenDocument) {
    Alert.alert('System Error', 'Scoped Storage functions not found.');
    return null;
  }

  try {
    const file = await OpenDocument(false); // CRITICAL: false to prevent JS Memory Crash
    
    if (!file) {
      console.log('[SAF] User cancelled pick');
      return null;
    }

    const tempPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/import_large_${Date.now()}.txt`;
    console.log('[SAF] Copying file to temp:', tempPath);

    await ReactNativeBlobUtil.fs.cp(file.uri, tempPath);
    const stats = await ReactNativeBlobUtil.fs.stat(tempPath);
    console.log('[SAF] Copy complete. Size:', stats.size);

    // Memory-Safe Binary Detection: Slice the first 1KB and read only that
    let headerBase64 = '';
    try {
      const headerPath = `${tempPath}.header`;
      // Slice only the first 1024 bytes
      await ReactNativeBlobUtil.fs.slice(tempPath, headerPath, 0, 1024);
      // Read the tiny header file
      headerBase64 = await ReactNativeBlobUtil.fs.readFile(headerPath, 'base64');
      // Cleanup header slice
      ReactNativeBlobUtil.fs.unlink(headerPath).catch(() => {});
    } catch (e) {
      console.warn('[SAF] Error slicing header for binary detection:', e);
    }

    const binaryReason = detectBinary(headerBase64);
    if (binaryReason) {
      // Clean up temp file before alerting
      ReactNativeBlobUtil.fs.unlink(tempPath).catch(() => {});
      Alert.alert(
        '🚫 Binary File Detected',
        `"${file.name}" appears to be a ${binaryReason}.\n\nNeoscribe is a text & code editor — binary files would display as garbled data.\n\nTip: Convert to .txt or export as plain text first.`
      );
      return null;
    }

    // Extract extension (any extension is fine — binary check passed)
    const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
    const extension = extMatch ? extMatch[1].toLowerCase() : '';

    return { 
      name: file.name, 
      path: tempPath, 
      size: Number(stats.size),
      extension: extension,
      uri: file.uri
    };

  } catch (error: any) {
    console.error('[SAF] Pick Error:', error.message);
    Alert.alert('Import Failed', `Error: ${error.message}`);
    return null;
  }
}

/**
 * Creates a temporary file for a new tab with optional content.
 */
export async function createTempFile(
    fileName: string = 'Untitled.txt',
    content: string = ''
): Promise<{ name: string, path: string, extension: string, uri: string | undefined } | null> {
    try {
        const timestamp = Date.now();
        const tempPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${timestamp}_${fileName}`;
        await ReactNativeBlobUtil.fs.writeFile(tempPath, content, 'utf8');
        
        const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
        const extension = extMatch ? extMatch[1].toLowerCase() : 'txt';

        return {
            name: fileName,
            path: tempPath,
            extension: extension,
            uri: undefined // Temp files in CacheDir don't have a SAF URI initially
        };
    } catch (e) {
        console.error('Failed to create temp file', e);
        return null;
    }
}
