package com.neoscribe

import android.content.Context
import android.view.ViewGroup
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import io.github.rosemoe.sora.widget.CodeEditor
import io.github.rosemoe.sora.event.ContentChangeEvent
import io.github.rosemoe.sora.widget.component.EditorAutoCompletion
import io.github.rosemoe.sora.widget.schemes.EditorColorScheme
import io.github.rosemoe.sora.widget.EditorSearcher
import android.graphics.Color
import java.io.File
import java.util.concurrent.Executors
import android.view.inputmethod.InputMethodManager
import android.os.Handler
import android.os.Looper
import io.github.rosemoe.sora.lang.EmptyLanguage
import android.graphics.Typeface
import io.github.rosemoe.sora.langs.textmate.TextMateLanguage
import io.github.rosemoe.sora.langs.textmate.registry.FileProviderRegistry
import io.github.rosemoe.sora.langs.textmate.registry.GrammarRegistry
import io.github.rosemoe.sora.langs.textmate.registry.ThemeRegistry
import io.github.rosemoe.sora.langs.textmate.registry.model.ThemeModel
import io.github.rosemoe.sora.langs.textmate.registry.provider.AssetsFileResolver
import com.facebook.react.uimanager.UIManagerModule
import org.json.JSONArray
import org.json.JSONObject
import java.io.InputStream
import java.nio.charset.Charset
import android.animation.ValueAnimator
import android.view.animation.LinearInterpolator

class LargeNoteEditorView(context: Context) : CodeEditor(context) {
    private var isSettingText = false
    private var isMassiveFile = false
    private val currentLoadId = java.util.concurrent.atomic.AtomicLong(0)
    private val operationGuard = java.util.concurrent.atomic.AtomicBoolean(false)
    private var lastFoundLineForAmortized = 0
    private var selectionAnimator: ValueAnimator? = null
    private var isIridescentActive = false
    



    private fun applyThemeColors(scheme: EditorColorScheme, colors: JSONObject) {
        val keys = colors.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val colorStr = colors.optString(key)
            if (colorStr.isNotEmpty() && colorStr.startsWith("#")) {
                try {
                    val color = Color.parseColor(colorStr)
                    when (key) {
                        "editor.background" -> scheme.setColor(EditorColorScheme.WHOLE_BACKGROUND, color)
                        "editor.foreground" -> scheme.setColor(EditorColorScheme.TEXT_NORMAL, color)
                        "editor.whitespace" -> scheme.setColor(EditorColorScheme.NON_PRINTABLE_CHAR, color)
                        "editor.cursor" -> scheme.setColor(EditorColorScheme.SELECTION_INSERT, color)
                        "editor.handle" -> scheme.setColor(EditorColorScheme.SELECTION_HANDLE, color)
                        "editor.selection.background" -> scheme.setColor(EditorColorScheme.SELECTED_TEXT_BACKGROUND, color)
                        "editor.currentLine.background" -> scheme.setColor(EditorColorScheme.CURRENT_LINE, color)
                        "editor.highlightedDelimiters.background" -> scheme.setColor(EditorColorScheme.HIGHLIGHTED_DELIMITERS_BACKGROUND, color)
                        "editor.highlightedDelimiters.foreground" -> scheme.setColor(EditorColorScheme.HIGHLIGHTED_DELIMITERS_FOREGROUND, color)
                        "editor.matchHighlight.background" -> scheme.setColor(EditorColorScheme.MATCHED_TEXT_BACKGROUND, color)
                        "editor.lineNumber.divider" -> {
                            scheme.setColor(EditorColorScheme.LINE_DIVIDER, color)
                            scheme.setColor(EditorColorScheme.STICKY_SCROLL_DIVIDER, color)
                        }
                        "editor.lineNumber.background" -> scheme.setColor(EditorColorScheme.LINE_NUMBER_BACKGROUND, color)
                        "editor.lineNumber.foreground" -> scheme.setColor(EditorColorScheme.LINE_NUMBER, color)
                        "editor.lineNumber.activeForeground" -> scheme.setColor(EditorColorScheme.LINE_NUMBER_CURRENT, color)
                        "editor.indentGuide.background" -> scheme.setColor(EditorColorScheme.BLOCK_LINE, color)
                        "editor.indentGuide.activeBackground" -> scheme.setColor(EditorColorScheme.BLOCK_LINE_CURRENT, color)
                        "editor.popupWindow.background" -> {
                            scheme.setColor(EditorColorScheme.COMPLETION_WND_BACKGROUND, color)
                            scheme.setColor(EditorColorScheme.TEXT_ACTION_WINDOW_BACKGROUND, color)
                            scheme.setColor(EditorColorScheme.DIAGNOSTIC_TOOLTIP_BACKGROUND, color)
                        }
                        "editor.popupWindow.activeBackground" -> scheme.setColor(EditorColorScheme.COMPLETION_WND_ITEM_CURRENT, color)
                        "editor.popupWindow.corner" -> scheme.setColor(EditorColorScheme.COMPLETION_WND_CORNER, color)
                    }
                } catch (e: Exception) { }
            }
        }
    }

    private open inner class SquircleScheme(
        private val rootJson: JSONObject?,
        private val colorModel: ColorModel?,
        private val assetsTheme: AssetsTheme? = null
    ) : EditorColorScheme() {
        
        init {
            // CRITICAL: super constructor calls applyDefault() BEFORE rootJson/colorModel are initialized.
            // We must call it again here so they are actually used.
            Log.d("LargeNoteEditor", "SquircleScheme.init: Re-applying defaults with initialized data")
            applyDefault()
        }

        override fun isDark(): Boolean {
            // 1. Use ColorModel brightness if available (Highest priority)
            if (colorModel != null) {
                val bg = colorModel.backgroundColor
                val r = (bg shr 16) and 0xFF
                val g = (bg shr 8) and 0xFF
                val b = bg and 0xFF
                val brightness = (r * 299 + g * 587 + b * 114) / 1000 // Standard luminance formula
                val isDark = brightness < 150 
                Log.d("LargeNoteEditor", "isDark() ColorModel check: brightness=$brightness, isDark=$isDark")
                return isDark
            }
            
            // 2. Use JSON type field if available
            val type = rootJson?.let {
                if (it.has("type")) {
                    val value = it.getString("type")
                    if (value == "null") null else value
                } else null
            } ?: "dark" // Default to dark if totally unknown
            
            val result = !type.equals("light", ignoreCase = true)
            Log.d("LargeNoteEditor", "isDark() JSON check: type='$type', result=$result")
            return result
        }

        override fun applyDefault() {
            val isDarkTheme = isDark()
            Log.d("LargeNoteEditor", "SquircleScheme.applyDefault: isDark=$isDarkTheme")
            
            // Core UI reset
            setColor(HIGHLIGHTED_DELIMITERS_UNDERLINE, Color.TRANSPARENT)
            
            // 0. Base Fallbacks (System baselines)
            if (isDarkTheme) {
                setColor(WHOLE_BACKGROUND, Color.parseColor("#1E1F22"))
                setColor(TEXT_NORMAL, Color.parseColor("#ABB7C5"))
                setColor(LINE_NUMBER_BACKGROUND, Color.parseColor("#1E1F22"))
                setColor(LINE_NUMBER, Color.parseColor("#616366"))
                setColor(LINE_NUMBER_CURRENT, Color.parseColor("#A4A3A3"))
                setColor(LINE_DIVIDER, Color.parseColor("#393B40"))
                setColor(SELECTION_INSERT, Color.parseColor("#ABB7C5"))
                setColor(SELECTED_TEXT_BACKGROUND, Color.parseColor("#28427F"))
                setColor(CURRENT_LINE, Color.parseColor("#26282D"))
                setColor(BLOCK_LINE, Color.parseColor("#44ADADAD"))
                setColor(BLOCK_LINE_CURRENT, Color.parseColor("#FFFFFFFF"))
                isBlockLineEnabled = true
                setColor(SCROLL_BAR_THUMB, Color.parseColor("#40ffffff"))
                
                // Selection Panel (Floating toolbar)
                setColor(TEXT_ACTION_WINDOW_BACKGROUND, Color.parseColor("#2C2C2C"))
            } else {
                setColor(WHOLE_BACKGROUND, Color.parseColor("#FFFFFF"))
                setColor(TEXT_NORMAL, Color.parseColor("#000000"))
                setColor(LINE_NUMBER_BACKGROUND, Color.parseColor("#FFFFFF"))
                setColor(LINE_NUMBER, Color.parseColor("#ADADAD"))
                setColor(LINE_NUMBER_CURRENT, Color.parseColor("#000000"))
                setColor(LINE_DIVIDER, Color.parseColor("#E0E0E0"))
                setColor(SELECTION_INSERT, Color.parseColor("#000000"))
                setColor(SELECTED_TEXT_BACKGROUND, Color.parseColor("#AFD1FB"))
                setColor(CURRENT_LINE, Color.parseColor("#F5F5F5"))
                setColor(BLOCK_LINE, Color.parseColor("#44808080")) 
                setColor(BLOCK_LINE_CURRENT, Color.parseColor("#FF000000"))
                isBlockLineEnabled = true
                setColor(SCROLL_BAR_THUMB, Color.parseColor("#40000000"))
            }
            setColor(SCROLL_BAR_THUMB_PRESSED, if (isDarkTheme) Color.WHITE else Color.BLACK)
            
            // 1. Hardcoded Baseline (Theme-specific rules)
            colorModel?.let { model ->
                setColor(WHOLE_BACKGROUND, model.backgroundColor)
                setColor(TEXT_NORMAL, model.textColor)
                setColor(LINE_NUMBER_BACKGROUND, model.backgroundColor)
                setColor(LINE_NUMBER, model.commentColor)
                setColor(LINE_NUMBER_CURRENT, model.textColor)
                setColor(LINE_DIVIDER, model.commentColor)
                
                setColor(SELECTION_INSERT, model.textColor)
                setColor(SELECTION_HANDLE, model.textColor)
                
                // Aesthetic Threads (Translucent version of comment color)
                val threadColor = (model.commentColor and 0x00FFFFFF) or 0x22000000
                setColor(BLOCK_LINE, threadColor)
                setColor(BLOCK_LINE_CURRENT, (model.commentColor and 0x00FFFFFF) or 0x44000000)
                
                setColor(KEYWORD, model.keywordColor)
                setColor(OPERATOR, model.operatorColor)
                setColor(COMMENT, model.commentColor)
                setColor(LITERAL, model.numberColor)
                setColor(FUNCTION_NAME, model.functionColor)
                setColor(IDENTIFIER_NAME, model.variableColor)
            }
            
            // 2. JSON Attributes (Absolute source of truth)
            val colorsJson = rootJson?.optJSONObject("colors")
            if (colorsJson != null) {
                applyThemeColors(this, colorsJson)
            }

            // 3. DYNAMIC RIBBON & UI (Matching the "Skin" of the editor)
            if (!isDarkTheme) {
                // FORCE: Clean list highlight for light themes (Subtle off-white)
                var currentLine = Color.parseColor("#F9F9F9")
                
                // Specific "Pure" handling to keep it looking clean
                if (assetsTheme == AssetsTheme.THEME_PURE_TEAL) {
                    currentLine = Color.WHITE
                    setColor(LINE_NUMBER_BACKGROUND, Color.WHITE)
                    setColor(WHOLE_BACKGROUND, Color.WHITE)
                }
                
                setColor(CURRENT_LINE, currentLine)
                
                // Ribbon: Use each theme's handle/accent color for contrast with white icons
                val ribbonBg = when (assetsTheme) {
                    AssetsTheme.THEME_TEAL_LIGHT, 
                    AssetsTheme.THEME_PAPER_TEAL, 
                    AssetsTheme.THEME_PURE_TEAL -> colorModel?.keywordColor ?: Color.parseColor("#00796B")
                    AssetsTheme.THEME_SOLARIZED_LIGHT -> Color.parseColor("#B5802C") // Warm amber handle
                    AssetsTheme.THEME_INTELLIJ_LIGHT -> Color.parseColor("#3E73B9")  // Steel blue handle
                    AssetsTheme.THEME_ECLIPSE -> Color.parseColor("#980167")         // Deep magenta/purple handle
                    else -> Color.parseColor("#2C2C2C")
                }
                setColor(TEXT_ACTION_WINDOW_BACKGROUND, ribbonBg)
            } else {
                // For dark themes
                val ribbonBg = when (assetsTheme) {
                    AssetsTheme.THEME_TEAL_DARK -> colorModel?.keywordColor ?: Color.parseColor("#008080")
                    else -> Color.parseColor("#2C2C2C")
                }
                setColor(TEXT_ACTION_WINDOW_BACKGROUND, ribbonBg)
            }
        }

        override fun getColor(type: Int): Int {
            if (type >= 255) {
                try {
                    // Refetch the CURRENT theme from registry to avoid stale colors
                    val theme = ThemeRegistry.getInstance().currentThemeModel?.theme
                    val color = theme?.getColor(type - 255)
                    if (color != null && !color.equals("@default", ignoreCase = true)) {
                        return Color.parseColor(color)
                    }
                } catch (e: Exception) { 
                    Log.e("LargeNoteEditor", "getColor error for type $type", e)
                }
                return super.getColor(EditorColorScheme.TEXT_NORMAL)
            }
            return try {
                super.getColor(type)
            } catch (e: Exception) {
                Color.BLACK
            }
        }
    }

    init {
        // Ensure TextMate is initialized once
        initTextMate(context)

        // Monospace is essential for vertical alignment
        typefaceText = Typeface.MONOSPACE
        typefaceLineNumber = Typeface.MONOSPACE
        
        isLineNumberEnabled = true
        isHighlightCurrentLine = true
        
        // DISABLE the white auto-completion popup window seen in oteRN.png
        try {
            getComponent(EditorAutoCompletion::class.java).isEnabled = false
        } catch (e: Exception) {
            Log.e("LargeNoteEditor", "Could not disable auto-completion", e)
        }
        
        isWordwrap = false
        setTextSize(14f) 
        
        // Squircle CE Aesthetics - Maximum Density
        val dp = context.resources.displayMetrics.density
        lineSpacingExtra = 0f  
        tabWidth = 4 
        
        // Gutter Padding (Matches Squircle CE constants)
        lineNumberMarginLeft = 2f * dp
        setDividerMargin(2f * dp, 4f * dp)
        dividerWidth = 2f 
        
        isDisplayLnPanel = false // Disable the line number bubble
        verticalExtraSpaceFactor = 1.0f // Allow massive over-scrolling
        isStickyTextSelection = true
        
        // NATIVE SCROLL SPACE: This is 100% safe and doesn't affect file content.
        // 1200dp of empty space at the bottom ensures you can scroll any line higher up.
        setPadding(0, 0, 0, (1200 * dp).toInt()) 
        
        // Indent guides enabled
        
        // Threaded Lines (Indent Guides)
        isBlockLineEnabled = true
        // Set a default color for indent guides so they are visible
        colorScheme.setColor(EditorColorScheme.BLOCK_LINE, Color.parseColor("#33ffffff"))
        colorScheme.setColor(EditorColorScheme.BLOCK_LINE_CURRENT, Color.parseColor("#66ffffff"))

        // Scroll and Selection optimizations
        isVerticalScrollBarEnabled = true
        isHorizontalScrollBarEnabled = true
        // Keep consistent with overscroll logic above
        // Initialize with basic baseline
        colorScheme = SquircleScheme(JSONObject().apply { put("type", "light") }, EditorTheme.ECLIPSE, AssetsTheme.THEME_ECLIPSE)
        
        // 🚀 THE THEME KICK SEQUENCE:
        // We simulate a manual theme swap on startup to 'kick' the rendering engine.
        // We use the initial theme to avoid flickering with wrong colors.
        post {
           applyTheme(lastUsedTheme)
        }
        
        // Set default fallback language
        setEditorLanguage(EmptyLanguage())

        // Ensure focusable for touch and scroll
        isFocusable = true
        isFocusableInTouchMode = true
        overScrollMode = android.view.View.OVER_SCROLL_ALWAYS
        
        // --- SCROLLBARS FOR SAMSUNG/MOTO CONSISTENCY ---
        // Reverted scrollbar custom properties to investigate crash
        isVerticalScrollBarEnabled = true
        isHorizontalScrollBarEnabled = true
        
        // Subscribe to changes
        subscribeAlways(ContentChangeEvent::class.java) { event ->
            if (!isSettingText && event.action != ContentChangeEvent.ACTION_SET_NEW_TEXT) {
                onTextChanged()
            }
        }
    }
    
    fun setLanguage(ext: String) {
        lastUsedExt = ext
        val cleanExt = ext.replace(".", "").lowercase()
        
        // Comprehensive Mapping: Map almost any text extension to its best available grammar
        val nameFromExt = when(cleanExt) {
            // Documents
            "md", "mdx", "markdown" -> "markdown"
            "tex", "latex" -> "latex"
            // Data & Config
            "json", "jsonl", "jsonc", "json5" -> "json"
            "yaml", "yml" -> "yaml"
            "toml" -> "toml"
            "xml", "svg", "xsl", "xslt", "dtd", "rss", "atom", "xaml", "wxi", "wxs" -> "xml"
            "ini", "conf", "cfg", "config", "env", "properties", "settings", "local", "plist", 
            "editorconfig", "gitignore", "gitattributes", "npmrc", "nvmrc", "babelrc", 
            "eslintrc", "prettierrc", "stylelintrc", "hgignore", "dockerignore", "htaccess", "lock" -> "ini"
            "sql", "ddl", "dml", "psql", "mysql", "sqlite", "cql", "graphql", "gql" -> "sql"
            // Web
            "js", "mjs", "cjs", "jsx" -> "javascript"
            "ts", "tsx" -> "typescript"
            "html", "htm", "xhtml", "phtml", "twig", "njk", "ejs", "hbs", "handlebars", "mustache", "liquid" -> "html"
            "css", "scss", "sass", "less", "styl" -> "css"
            "vue" -> "vue"
            "php" -> "php"
            // Systems & Low-level
            "c", "h" -> "c"
            "cpp", "cc", "cxx", "hpp", "hxx" -> "cpp"
            "cs" -> "csharp"
            "java" -> "java"
            "kt", "kts" -> "kotlin"
            "rs" -> "rust"
            "go" -> "go"
            "zig" -> "zig"
            "f", "f90", "f95", "f03", "for" -> "fortran"
            // Scripting
            "py", "pyw" -> "python"
            "rb", "rbw", "rakefile", "gemfile", "podfile" -> "ruby"
            "lua" -> "lua"
            "pl", "pm", "pod" -> "perl"
            "sh", "bash", "zsh", "fish", "ksh", "csh", "tcsh", "procfile" -> "shellscript"
            "bat", "cmd" -> "bat"
            "makefile", "mk", "mak", "ninja", "jenkinsfile" -> "makefile"
            // Functional / Academic
            "clj", "cljs", "cljc", "edn" -> "clojure"
            "fs", "fsx", "fsi" -> "fsharp"
            "groovy", "gradle", "kts", "gvy" -> "groovy"
            "jl" -> "julia"
            "lisp", "lsp", "scm", "ss", "rkt", "clob" -> "lisp"
            "dart" -> "dart"
            "smali" -> "smali"
            "vb", "vbs" -> "vb"
            else -> commonExtMap[cleanExt] ?: cleanExt
        }

        var scopeName = grammarMap[nameFromExt] ?: grammarMap[cleanExt]
        
        val language = if (scopeName != null && GrammarRegistry.getInstance().findGrammar(scopeName) != null) {
            TextMateLanguage.create(scopeName, true).apply {
                tabSize = this@LargeNoteEditorView.tabWidth
                useTab(false) 
            }
        } else {
            EmptyLanguage()
        }
        
        setEditorLanguage(language)
    }

    private val commonExtMap = mapOf<String, String>() // Placeholder, logic moved to setLanguage

    private var isReplacing = false

    fun setNoteText(text: String) {
        // Cancel any background loading so it doesn't corrupt the new text
        currentLoadId.incrementAndGet()

        // Reset massive flag for small snippet edits to ensure full sync
        if (text.length < 1024 * 512) {
            isMassiveFile = false
        }

        // Prevent React Native from overwriting massive file content with empty string placeholder
        if (isMassiveFile && text.isEmpty()) {
            return
        }
        
        // Fast length check first to avoid expensive toString() cast on massives
        val currentText = getText()
        if (currentText.length == text.length && currentText.toString() == text) return
        
        isSettingText = true
        
        // Add 50 empty lines at the bottom for comfortable scrolling
        val withSpacer = text + "\n".repeat(50)
        
        setText(withSpacer)
        isSettingText = false
    }

    private fun emitSearchUpdate() {
        // Sora Editor 0.24.3 searcher doesn't easily expose matchedCount/currentMatchIndex
        // For now, we emit a placeholder to maintain the bridge interface if needed
        val event = Arguments.createMap()
        event.putInt("count", 0)
        event.putInt("index", -1)
        (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(
            id,
            "topSoraSearchResult",
            event
        )
    }

    private fun onTextChanged() {
        // Suppress events during batch operations
        if (isReplacing) return

        // Optimization: For massive files, don't send the full text to JS to prevent OOM
        // We track if we are dealing with a massive file based on loadContentFromFile usage
        if (isMassiveFile) {
            val event = Arguments.createMap()
            event.putString("text", "") // Send empty string to signal change but avoid payload
            (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(
                id,
                "topSoraChange",
                event
            )
            return
        }

        val event = Arguments.createMap()
        event.putString("text", getText().toString())
        (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(
            id,
            "topSoraChange",
            event
        )
    }


    fun loadContentFromFile(path: String) {
        val loadId = currentLoadId.incrementAndGet()
        setText("Loading massive file...") 
        isMassiveFile = true
        
        val executor = Executors.newSingleThreadExecutor()
        val handler = Handler(Looper.getMainLooper())
        
        executor.execute {
            try {
                if (loadId != currentLoadId.get()) return@execute
                val file = File(path)
                if (file.exists()) {
                    // clear first
                    handler.post { 
                        if (loadId == currentLoadId.get()) setText("") 
                    }
                    
                    val reader = java.io.InputStreamReader(java.io.FileInputStream(file), "UTF-8")
                    val buffer = CharArray(1024 * 32) // 32KB buffer
                    var read: Int
                    val sb = StringBuilder()
                    
                    // Read and append in chunks to avoid allocating one massive string
                    while (reader.read(buffer).also { read = it } != -1) {
                         if (loadId != currentLoadId.get()) {
                             reader.close()
                             return@execute
                         }
                         sb.append(buffer, 0, read)
                         
                         // Flush to UI thread every ~512KB to keep memory usage low but batch excessive updates
                         if (sb.length >= 1024 * 512) {
                             val chunk = sb.toString()
                             sb.setLength(0)
                             handler.post {
                                 if (loadId == currentLoadId.get()) {
                                     try {
                                         // Direct content insertion is more efficient than setText concatenation
                                         text.insert(text.lineCount - 1, text.getColumnCount(text.lineCount - 1), chunk)
                                     } catch (e: Exception) {
                                         e.printStackTrace()
                                     }
                                 }
                             }
                             // Short sleep to allow UI thread to breathe
                             Thread.sleep(10)
                         }
                    }
                    
                    // Flush remaining
                    if (sb.isNotEmpty()) {
                        val chunk = sb.toString()
                        handler.post {
                            if (loadId == currentLoadId.get()) {
                                try {
                                    text.insert(text.lineCount - 1, text.getColumnCount(text.lineCount - 1), chunk)
                                } catch (e: Exception) {
                                    e.printStackTrace()
                                }
                            }
                        }
                    }
                    
                    reader.close()
                    
                    // Post completion tasks
                    handler.post {
                        try {
                            setSelection(0, 0)
                            ensureSelectionVisible()
                            requestFocus()
                            
                            handler.postDelayed({
                                val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
                                imm?.showSoftInput(this@LargeNoteEditorView, 0)
                            }, 200)
                            
                            invalidate()
                        } catch (e: Exception) { e.printStackTrace() }
                    }
                } else {
                    handler.post { setText("Error: File not found at $path") }
                }
            } catch (e: Exception) {
                handler.post { setText("Error loading file: ${e.message}") }
            }
        }
    }

    fun saveToFile(path: String) {
        val executor = Executors.newSingleThreadExecutor()
        val handler = Handler(Looper.getMainLooper())
        // Get text on main thread before offloading I/O
        val rawContent = getText().toString()
        
        // Strip trailing empty lines before saving
        val content = rawContent.trimEnd('\n', '\r', ' ', '\t')
        
        executor.execute {
            try {
                val file = File(path)
                file.writeText(content)
                // success
            } catch (e: Exception) {
               // error
            }
        }
    }

    private var lastUsedTheme = "teal_dark"
    private var lastUsedExt = "txt"

    fun applyTheme(themeName: String) {
        try {
            lastUsedTheme = themeName
            Log.d("LargeNoteEditor", "=== APPLYING THEME: $themeName ===")
            val assetsTheme = AssetsTheme.find(themeName)
            val fileName = assetsTheme?.themeId ?: themeName
            Log.d("LargeNoteEditor", "Matched AssetsTheme: $assetsTheme, File: $fileName")
            
            val themeRegistry = ThemeRegistry.getInstance()
            val jsonText = context.assets.open("themes/$fileName.json").bufferedReader().use { it.readText() }
            
            val json = JSONObject(jsonText)
            val themeType = json.optString("type", "MISSING")
            Log.d("LargeNoteEditor", "JSON type field: '$themeType'")
            
            val themeSource = org.eclipse.tm4e.core.registry.IThemeSource.fromInputStream(
                jsonText.byteInputStream(),
                "$fileName.json",
                java.nio.charset.Charset.forName("UTF-8")
            )
            themeRegistry.loadTheme(themeSource, true)
            
            // Resolve ColorModel from EditorTheme.kt
            val model = when (assetsTheme) {
                AssetsTheme.THEME_DARCULA -> EditorTheme.DARCULA
                AssetsTheme.THEME_ECLIPSE -> EditorTheme.ECLIPSE
                AssetsTheme.THEME_MONOKAI -> EditorTheme.MONOKAI
                AssetsTheme.THEME_OBSIDIAN -> EditorTheme.OBSIDIAN
                AssetsTheme.THEME_INTELLIJ_LIGHT -> EditorTheme.INTELLIJ_LIGHT
                AssetsTheme.THEME_LADIES_NIGHT -> EditorTheme.LADIES_NIGHT
                AssetsTheme.THEME_TOMORROW_NIGHT -> EditorTheme.TOMORROW_NIGHT
                AssetsTheme.THEME_SOLARIZED_LIGHT -> EditorTheme.SOLARIZED_LIGHT
                AssetsTheme.THEME_VISUAL_STUDIO -> EditorTheme.VISUAL_STUDIO
                AssetsTheme.THEME_TEAL_DARK -> EditorTheme.TEAL_DARK
                AssetsTheme.THEME_TEAL_LIGHT -> EditorTheme.TEAL_LIGHT
                AssetsTheme.THEME_PAPER_TEAL -> EditorTheme.PAPER_TEAL
                AssetsTheme.THEME_PURE_TEAL -> EditorTheme.PURE_TEAL
                AssetsTheme.THEME_IRIDESCENT -> EditorTheme.IRIDESCENT
                else -> null
            }
            Log.d("LargeNoteEditor", "ColorModel: ${model?.let { String.format("#%06X", 0xFFFFFF and it.backgroundColor) } ?: "null"}")
            
            // Check if it's iridescent theme
            isIridescentActive = (assetsTheme == AssetsTheme.THEME_IRIDESCENT)
            if (isIridescentActive) {
                startIridescentAnimation()
            } else {
                stopIridescentAnimation()
            }

            // Apply the new scheme which will fetch TextMate colors dynamically
            val newScheme = SquircleScheme(json, model, assetsTheme)
            colorScheme = newScheme
            
            Log.d("LargeNoteEditor", "Scheme applied, background color: ${String.format("#%06X", 0xFFFFFF and colorScheme.getColor(EditorColorScheme.WHOLE_BACKGROUND))}")
            
            // Final Refresh
            setLanguage(lastUsedExt)
            invalidate()
            requestLayout()
        } catch (e: Exception) {
            Log.e("LargeNoteEditor", "Error applying theme: $themeName", e)
            // Fallback to basic theme if JSON load fails
            try {
                setEditorTheme(true)
            } catch (ex: Exception) {}
        }
    }

    private fun startIridescentAnimation() {
        if (selectionAnimator != null) return
        
        val colors = intArrayOf(
            Color.parseColor("#FF0080"), // Magenta
            Color.parseColor("#7928CA"), // Purple
            Color.parseColor("#0070F3"), // Blue
            Color.parseColor("#00DFD8"), // Cyan
            Color.parseColor("#7928CA"), // Purple
            Color.parseColor("#FF0080")  // Magenta
        )
        
        selectionAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 3000
            repeatCount = ValueAnimator.INFINITE
            interpolator = LinearInterpolator()
            addUpdateListener { animation ->
                val fraction = animation.animatedValue as Float
                val colorCount = colors.size - 1
                val position = fraction * colorCount
                val startIndex = position.toInt()
                val endIndex = (startIndex + 1).coerceAtMost(colorCount)
                val innerFraction = position - startIndex
                
                val startColor = colors[startIndex]
                val endColor = colors[endIndex]
                
                val r = (Color.red(startColor) + (Color.red(endColor) - Color.red(startColor)) * innerFraction).toInt()
                val g = (Color.green(startColor) + (Color.green(endColor) - Color.green(startColor)) * innerFraction).toInt()
                val b = (Color.blue(startColor) + (Color.blue(endColor) - Color.blue(startColor)) * innerFraction).toInt()
                
                val animatedColor = Color.rgb(r, g, b)
                
                // Update selection background with transparency
                val transparentColor = Color.argb(120, r, g, b)
                colorScheme.setColor(EditorColorScheme.SELECTED_TEXT_BACKGROUND, transparentColor)
                colorScheme.setColor(EditorColorScheme.SELECTION_HANDLE, animatedColor)
                colorScheme.setColor(EditorColorScheme.SELECTION_INSERT, animatedColor)
                
                // Update action window background
                colorScheme.setColor(EditorColorScheme.TEXT_ACTION_WINDOW_BACKGROUND, Color.rgb(r / 2, g / 2, b / 2))
                
                invalidate()
            }
            start()
        }
    }

    private fun stopIridescentAnimation() {
        selectionAnimator?.cancel()
        selectionAnimator = null
    }

    fun setEditorTheme(isDark: Boolean) {
        val defaultJson = JSONObject().apply {
            put("type", if (isDark) "dark" else "light")
        }
        val model = if (isDark) EditorTheme.TEAL_DARK else EditorTheme.TEAL_LIGHT
        val assetsTheme = if (isDark) AssetsTheme.THEME_TEAL_DARK else AssetsTheme.THEME_TEAL_LIGHT
        colorScheme = SquircleScheme(defaultJson, model, assetsTheme)
    }

    fun setCustomColors(colors: com.facebook.react.bridge.ReadableMap) {
        val scheme = object : SquircleScheme(null, null) {
            override fun applyDefault() {
                super.applyDefault()
                
                try {
                    if (colors.hasKey("text")) setColor(EditorColorScheme.TEXT_NORMAL, Color.parseColor(colors.getString("text")))
                    if (colors.hasKey("background")) setColor(EditorColorScheme.WHOLE_BACKGROUND, Color.parseColor(colors.getString("background")))
                    if (colors.hasKey("primary")) {
                        val primary = Color.parseColor(colors.getString("primary"))
                        setColor(EditorColorScheme.SELECTION_INSERT, primary)
                        setColor(EditorColorScheme.SELECTION_HANDLE, primary)
                        setColor(EditorColorScheme.LINE_NUMBER_CURRENT, primary)
                    }
                    if (colors.hasKey("surface")) {
                        val surface = Color.parseColor(colors.getString("surface"))
                        setColor(EditorColorScheme.LINE_NUMBER_BACKGROUND, surface)
                    }
                    if (colors.hasKey("divider")) {
                        val divider = Color.parseColor(colors.getString("divider"))
                        setColor(EditorColorScheme.LINE_DIVIDER, divider)
                    }
                    if (colors.hasKey("textSecondary")) {
                        setColor(EditorColorScheme.LINE_NUMBER, Color.parseColor(colors.getString("textSecondary")))
                    }
                    if (colors.hasKey("matchBackground")) {
                        val matchBg = Color.parseColor(colors.getString("matchBackground"))
                        setColor(EditorColorScheme.MATCHED_TEXT_BACKGROUND, matchBg)
                    }
                } catch (e: Exception) {
                    // Fallback to defaults if color parsing fails
                }
            }
        }
        colorScheme = scheme
    }

    override fun undo() {
        if (canUndo()) {
            super.undo()
        }
    }

    override fun redo() {
        if (canRedo()) {
            super.redo()
        }
    }

    private var activeGrammarScope: String? = null
    
    // Localization
    var msgSoraLoading = "Loading document, please wait..."
    var msgSoraPullSuccess = "Successfully pulled selection"
    var msgSoraPullError = "Pull failed: {{message}}"
    var msgSoraViewerError = "Could not find viewer"

    private var currentSearchQuery: String? = null
    private var currentMatchCase: Boolean = false

    fun find(query: String, matchCase: Boolean) {
        currentSearchQuery = query
        currentMatchCase = matchCase
        
        if (isMassiveFile) {
            searcher.stopSearch()
            
            Executors.newSingleThreadExecutor().execute {
                var count = 0
                try {
                    val content = getText()
                    val p = java.util.regex.Pattern.compile(
                        java.util.regex.Pattern.quote(query), 
                        if (matchCase) 0 else java.util.regex.Pattern.CASE_INSENSITIVE
                    )
                    val m = p.matcher(content)
                    while(m.find()) count++
                } catch(e: Exception) {}
                
                val event = Arguments.createMap()
                event.putInt("count", count)
                event.putInt("index", -1) 
                (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(
                    id, "topSoraSearchResult", event
                )
            }
            
            manualSearchNext(true, fromStart = true)
        } else {
            isHighlightCurrentLine = false
            val options = EditorSearcher.SearchOptions(EditorSearcher.SearchOptions.TYPE_NORMAL, !matchCase)
            searcher.search(query, options)
            emitSearchUpdate()
        }
    }

    fun findNext() {
        if (isMassiveFile) {
            manualSearchNext(true)
        } else {
            searcher.gotoNext()
            ensureSelectionVisible()
            emitSearchUpdate()
        }
    }

    fun findPrev() {
        if (isMassiveFile) {
            manualSearchNext(false)
        } else {
            searcher.gotoPrevious()
            ensureSelectionVisible()
            emitSearchUpdate()
        }
    }

    private fun manualSearchNext(forward: Boolean, fromStart: Boolean = false) {
        if (operationGuard.get()) return
        val query = currentSearchQuery ?: return
        if (query.isEmpty()) return
        
        Executors.newSingleThreadExecutor().execute {
            try {
                operationGuard.set(true)
                val content = getText()
                val flags = if (currentMatchCase) 0 else java.util.regex.Pattern.CASE_INSENSITIVE
                val p = java.util.regex.Pattern.compile(java.util.regex.Pattern.quote(query), flags)
                val m = p.matcher(content)
                
                val currentLine = cursor.rightLine
                val currentCol = cursor.rightColumn
                val currentIndex = content.getCharIndex(currentLine, currentCol)
                
                var index = -1
                
                if (forward) {
                    val startPos = if (fromStart) 0 else currentIndex
                    if (m.find(startPos)) {
                        index = m.start()
                    } else if (!fromStart) {
                        if (m.find(0)) index = m.start()
                    }
                } else {
                    // Optimized backward search: don't count everything
                    // Instead, look in chunks backwards or just use find() and track last
                    var lastFound = -1
                    m.reset()
                    while (m.find()) {
                        if (m.start() >= currentIndex) break
                        lastFound = m.start()
                    }
                    index = lastFound
                    
                    if (index == -1) {
                        m.reset()
                        while (m.find()) {
                            index = m.start()
                        }
                    }
                }
                
                if (index != -1) {
                    val foundIdx = index
                    Handler(Looper.getMainLooper()).post {
                        val line = getLineFromIndex(foundIdx)
                        val lineStart = getText().getCharIndex(line, 0)
                        val col = foundIdx - lineStart
                        setSelectionRegion(line, col, line, col + query.length)
                        ensureSelectionVisible()
                        operationGuard.set(false)
                    }
                } else {
                    operationGuard.set(false)
                }
            } catch (e: Exception) {
                operationGuard.set(false)
            } finally {
                operationGuard.set(false)
            }
        }
    }

    private fun getLineFromIndex(index: Int, hint: Int = -1): Int {
        val content = getText()
        val lineCount = content.lineCount
        if (lineCount == 0) return 0
        
        // Fast path: check hint (especially useful for backward iteration in replaceAll)
        if (hint >= 0 && hint < lineCount) {
            val start = content.getCharIndex(hint, 0)
            val end = if (hint == lineCount - 1) content.length else content.getCharIndex(hint + 1, 0)
            if (index >= start && index < end) return hint
        }

        var low = 0
        var high = lineCount - 1
        while (low <= high) {
            val mid = (low + high) / 2
            val start = content.getCharIndex(mid, 0)
            val end = if (mid == lineCount - 1) content.length else content.getCharIndex(mid + 1, 0)
            
            if (index >= start && index < end) return mid
            if (index < start) high = mid - 1
            else low = mid + 1
        }
        return 0
    }

    fun replace(replacement: String) {
        if (isMassiveFile) {
            val query = currentSearchQuery ?: return
            if (query.isEmpty()) return
            
            try {
                val selStartLine = cursor.leftLine
                val selStartCol = cursor.leftColumn
                val selEndLine = cursor.rightLine
                val selEndCol = cursor.rightColumn
                
                if (selStartLine == selEndLine && selStartCol == selEndCol) return

                val selectedText = getText().subContent(selStartLine, selStartCol, selEndLine, selEndCol).toString()
                val matches = if (currentMatchCase) selectedText == query else selectedText.equals(query, true)
                
                if (matches) {
                    isReplacing = true
                    getText().replace(selStartLine, selStartCol, selEndLine, selEndCol, replacement)
                    isReplacing = false
                    
                    onTextChanged()
                    
                    Handler(Looper.getMainLooper()).postDelayed({
                        manualSearchNext(true)
                    }, 50)
                }
            } catch (e: Exception) {
                isReplacing = false
                e.printStackTrace()
            }
        } else {
            if (searcher.hasQuery()) {
                try {
                    searcher.replaceCurrentMatch(replacement)
                    emitSearchUpdate()
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    fun replaceAll(replacement: String, applyLimit: Boolean = false) {
        if (operationGuard.get()) return
        val query = currentSearchQuery
        if (query.isNullOrEmpty()) return
        
        val content = getText()
        val MAX_SAFETY_LIMIT = 2000000 // Increased for stress testing

        Executors.newSingleThreadExecutor().execute {
            try {
                operationGuard.set(true)
                val mainHandler = Handler(Looper.getMainLooper())
                val flags = if (currentMatchCase) 0 else java.util.regex.Pattern.CASE_INSENSITIVE
                val pattern = java.util.regex.Pattern.compile(java.util.regex.Pattern.quote(query), flags)
                val matcher = pattern.matcher(content)
                
                // 1. Alert Immediate Scan Status
                mainHandler.post {
                    val progressEvent = Arguments.createMap()
                    progressEvent.putString("status", "counting")
                    progressEvent.putInt("current", 0)
                    progressEvent.putInt("total", 0)
                    (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(id, "topSoraReplaceProgress", progressEvent)
                }

                // 2. Short-Circuit Counting & Collection
                val matches = LongArray(MAX_SAFETY_LIMIT)
                var totalFoundCount = 0
                var collectedForReplace = 0
                
                while (matcher.find()) {
                    if (collectedForReplace < MAX_SAFETY_LIMIT) {
                        val range = (matcher.start().toLong() shl 32) or (matcher.end().toLong() and 0xFFFFFFFFL)
                        matches[collectedForReplace] = range
                        collectedForReplace++
                    }
                    totalFoundCount++
                    
                    // Break check removed for stress testing

                    if (totalFoundCount % 50000 == 0) {
                        val currentCount = totalFoundCount
                        mainHandler.post {
                            val progressEvent = Arguments.createMap()
                            progressEvent.putString("status", "counting")
                            progressEvent.putInt("current", currentCount)
                            (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(id, "topSoraReplaceProgress", progressEvent)
                        }
                    }
                }

                if (totalFoundCount == 0) {
                     mainHandler.post {
                        operationGuard.set(false)
                        val endEvent = Arguments.createMap()
                        endEvent.putBoolean("success", true)
                        endEvent.putBoolean("isBatch", true)
                        (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(id, "topSoraReplaceEnd", endEvent)
                     }
                     return@execute
                }

                // Limit Check disabled for stress testing

                // 4. Replacement Phase
                val totalToReplace = Math.min(totalFoundCount, MAX_SAFETY_LIMIT)
                mainHandler.post {
                    val startEvent = Arguments.createMap()
                    startEvent.putString("query", query)
                    startEvent.putInt("total", totalToReplace)
                    (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(id, "topSoraReplaceStart", startEvent)
                }

                val CHUNK_SIZE = 2500 // Increased for better throughput
                var processed = 0
                lastFoundLineForAmortized = content.lineCount - 1
                
                mainHandler.post(object : Runnable {
                    override fun run() {
                        try {
                            if (processed == 0) {
                                isReplacing = true
                                content.beginBatchEdit()
                            }

                            val chunkStartInArray = totalToReplace - 1 - processed
                            val chunkEndInArray = Math.max(0, totalToReplace - processed - CHUNK_SIZE)
                            
                            for (i in chunkStartInArray downTo chunkEndInArray) {
                                val packed = matches[i]
                                val sIdx = (packed shr 32).toInt()
                                val eIdx = (packed and 0xFFFFFFFFL).toInt()
                                
                                // Amortized O(1) Search: Start from lastFoundLine and move back
                                while (lastFoundLineForAmortized > 0 && content.getCharIndex(lastFoundLineForAmortized, 0) > sIdx) {
                                    lastFoundLineForAmortized--
                                }
                                val startLine = lastFoundLineForAmortized
                                val startCol = sIdx - content.getCharIndex(startLine, 0)
                                
                                // End line is usually the same or close
                                var endLine = startLine
                                while (endLine < content.lineCount - 1 && 
                                       (if (endLine == content.lineCount - 1) content.length else content.getCharIndex(endLine + 1, 0)) <= eIdx) {
                                    endLine++
                                }
                                val endCol = eIdx - content.getCharIndex(endLine, 0)
                                
                                content.replace(startLine, startCol, endLine, endCol, replacement)
                                processed++
                            }
                            
                            val progressEvent = Arguments.createMap()
                            progressEvent.putString("status", "replacing")
                            progressEvent.putInt("current", processed)
                            progressEvent.putInt("total", totalToReplace)
                            (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(id, "topSoraReplaceProgress", progressEvent)

                            if (processed < totalToReplace) {
                                mainHandler.post(this)
                            } else {
                                content.endBatchEdit()
                                isReplacing = false
                                stopSearch()
                                onTextChanged()
                                operationGuard.set(false)

                                val endEvent = Arguments.createMap()
                                endEvent.putBoolean("success", true)
                                endEvent.putBoolean("isBatch", true)
                                (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(id, "topSoraReplaceEnd", endEvent)
                            }
                        } catch (e: Exception) {
                            operationGuard.set(false)
                            isReplacing = false
                            try { content.endBatchEdit() } catch(ex: Exception) {}
                        }
                    }
                })
            } catch (e: Exception) {
                operationGuard.set(false)
            }
        }
    }
    fun stopSearch() {
        searcher.stopSearch()
        isHighlightCurrentLine = true
        emitSearchUpdate()
    }

    fun insertText(text: String) {
        insertText(text, 1)
    }

    fun pullFromHugeText(hugeTextId: Int) {
        try {
            val hugeTextView = HugeTextView.getInstance(hugeTextId)
            
            if (hugeTextView == null) {
                Log.e("SoraBridge", "Could not resolve HugeTextView with ID: $hugeTextId via registry")
                setNoteText("ERROR: $msgSoraViewerError (Handle: $hugeTextId)")
                return
            }
            
            // Show immediate loading indicator to prevent ANR freeze perception
            setNoteText(msgSoraLoading)
            isMassiveFile = true // Avoid sending partial "Syncing" text to JS
            isEditable = false   // Disable editing while loading
            
            // Emit Pull Start
            (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(id, "topSoraPullStart", Arguments.createMap())
            
            Executors.newSingleThreadExecutor().execute {
                try {
                    // This call is heavy and involves I/O
                    var text = hugeTextView.getSelectedLinesText()
                    
                    // Fallback: If nothing is selected, pull everything (up to 10k lines)
                    if (text.isEmpty()) {
                        Log.d("SoraBridge", "No selection found, performing full pull fallback")
                        text = hugeTextView.getLinesText(0, 10000)
                    }
                    
                    val finalText = text
                    Handler(Looper.getMainLooper()).post {
                        if (finalText.isEmpty()) {
                            Log.w("SoraBridge", "Pulled text is empty or no selection")
                            isMassiveFile = false
                            setNoteText("")
                        } else {
                            isMassiveFile = true
                            setNoteText(finalText)
                            
                            // Small toast to confirm sync
                            android.widget.Toast.makeText(context, msgSoraPullSuccess, android.widget.Toast.LENGTH_SHORT).show()
                        }
                        // Emit Pull End
                        (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(id, "topSoraPullEnd", Arguments.createMap())
                        isEditable = true // Restore editing
                    }
                } catch (e: Exception) {
                    Log.e("SoraBridge", "Error pulling from huge text", e)
                    Handler(Looper.getMainLooper()).post {
                        val errorMsg = msgSoraPullError.replace("{{message}}", e.message ?: "Unknown error")
                        setNoteText("ERROR: $errorMsg")
                        
                        // Emit Pull End (Failure case)
                        (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(id, "topSoraPullEnd", Arguments.createMap())
                        isEditable = true
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("SoraBridge", "Fatal error in pullFromHugeText", e)
        }
    }

    fun pushToHugeText(hugeTextId: Int) {
        val hugeTextView = HugeTextView.getInstance(hugeTextId)
        if (hugeTextView == null) return
        
        val reactContext = context as? ReactContext ?: return
        
        // Capture a snapshot of the content to process in background
        // Note: toString() on Sora Content is relatively fast but can be heavy
        // We'll do it on background thread if possible, or just the split part.
        
        Executors.newSingleThreadExecutor().execute {
            try {
                val content = getText()
                val lineCount = content.lineCount
                val lines = ArrayList<String>(lineCount)
                
                // Extract lines one by one to avoid one giant string allocation + split() overhead
                for (i in 0 until lineCount) {
                    val line = content.getLineString(i)
                    lines.add(line)
                }
                
                // Strip trailing empty lines that Sora often adds (+ the 50 spacer lines)
                var lastNonEmpty = lines.size - 1
                while (lastNonEmpty >= 0 && lines[lastNonEmpty].isEmpty()) {
                    lastNonEmpty--
                }
                
                val cleanLines = if (lastNonEmpty < lines.size - 1) {
                    lines.subList(0, lastNonEmpty + 1)
                } else {
                    lines
                }
                
                // If it's completely empty but we want to keep it as at least 1 line for the viewer
                val finalLines = if (cleanLines.isEmpty()) listOf("") else cleanLines
                
                hugeTextView.replaceSelectedSpecificLines(finalLines)
                
                Handler(Looper.getMainLooper()).post {
                    val endEvent = Arguments.createMap()
                    endEvent.putBoolean("success", true)
                    reactContext.getJSModule(RCTEventEmitter::class.java).receiveEvent(
                        id,
                        "topSoraReplaceEnd",
                        endEvent
                    )
                }
            } catch (e: Exception) {
                Log.e("SoraBridge", "Error pushing to huge text", e)
                Handler(Looper.getMainLooper()).post {
                    val endEvent = Arguments.createMap()
                    endEvent.putBoolean("success", false)
                    reactContext.getJSModule(RCTEventEmitter::class.java).receiveEvent(
                        id,
                        "topSoraReplaceEnd",
                        endEvent
                    )
                }
            }
        }
    }

    companion object {
        private var isTextMateInitialized = false
        private val grammarMap = mutableMapOf<String, String>()

        @Synchronized
        fun initTextMate(context: Context) {
            if (isTextMateInitialized) return
            
            try {
                // 1. Initialize File Provider
                FileProviderRegistry.getInstance().addFileProvider(
                    AssetsFileResolver(context.assets)
                )

                // 2. Load Grammar Registry from languages.json
                val inputStream = context.assets.open("languages.json")
                val size = inputStream.available()
                val buffer = ByteArray(size)
                inputStream.read(buffer)
                inputStream.close()
                val jsonStr = String(buffer, Charset.forName("UTF-8"))
                val languages = JSONArray(jsonStr)

                for (i in 0 until languages.length()) {
                    val lang = languages.getJSONObject(i)
                    val name = lang.getString("name")
                    val scopeName = lang.getString("scopeName")
                    val grammarPath = lang.getString("grammar")
                    
                    // Map name and common extensions if possible (this is simplified)
                    grammarMap[name] = scopeName
                    
                    // Register the grammar
                    val grammarSource = org.eclipse.tm4e.core.registry.IGrammarSource.fromInputStream(
                        context.assets.open(grammarPath), 
                        grammarPath, 
                        java.nio.charset.Charset.forName("UTF-8")
                    )
                    val langConfigPath = if (lang.has("languageConfiguration")) lang.getString("languageConfiguration") else null
                    
                    GrammarRegistry.getInstance().loadGrammar(
                        io.github.rosemoe.sora.langs.textmate.registry.model.DefaultGrammarDefinition.withLanguageConfiguration(
                            grammarSource,
                            langConfigPath,
                            name,
                            scopeName
                        )
                    )
                }

                isTextMateInitialized = true
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
