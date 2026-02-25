package com.neoscribe

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.events.RCTEventEmitter


class HugeTextViewManager : SimpleViewManager<HugeTextView>() {

    override fun getName(): String {
        return "HugeTextView"
    }

    override fun createViewInstance(reactContext: ThemedReactContext): HugeTextView {
        return HugeTextView(reactContext)
    }

    @ReactProp(name = "path")
    fun setPath(view: HugeTextView, path: String?) {
        if (!path.isNullOrEmpty()) {
            view.loadFile(path)
        }
    }

    @ReactProp(name = "targetLine")
    fun setTargetLine(view: HugeTextView, line: Int) {
        if (line >= 0) {
            view.jumpToLine(line)
        }
    }

    @ReactProp(name = "targetNonce")
    fun setTargetNonce(view: HugeTextView, nonce: Double) {
        view.jumpToLine(-2) // Use -2 as "refresh scroll" signal OR just re-trigger lastTargetLine
    }

    @ReactProp(name = "selectionMode")
    fun setSelectionMode(view: HugeTextView, active: Boolean) {
        if (view.selectionModeActive != active) {
            view.selectionModeActive = active
            view.megaRefresh()
        }
    }

    @ReactProp(name = "rainbowMode")
    fun setRainbowMode(view: HugeTextView, active: Boolean) {
        view.setRainbowMode(active)
    }

    @ReactProp(name = "extension")
    fun setExtension(view: HugeTextView, ext: String?) {
        view.setSyntaxExtension(ext ?: "")
    }

    @ReactProp(name = "fontSize")
    fun setFontSize(view: HugeTextView, size: Float) {
        view.setCustomFontSize(size)
    }

    @ReactProp(name = "backgroundColor")
    fun setBackgroundColorProp(view: HugeTextView, color: String?) {
        color?.let { view.updateBackgroundColor(it) }
    }

    @ReactProp(name = "textColor")
    fun setTextColorProp(view: HugeTextView, color: String?) {
        color?.let { view.updateTextColor(it) }
    }

    @ReactProp(name = "selectionColor")
    fun setSelectionColorProp(view: HugeTextView, color: String?) {
        color?.let { view.updateSelectionColor(it) }
    }

    @ReactProp(name = "lineNumberColor")
    fun setLineNumberColorProp(view: HugeTextView, color: String?) {
        color?.let { view.updateLineNumberColor(it) }
    }

    @ReactProp(name = "msgEnterSearchTerm")
    fun setMsgEnterSearchTerm(view: HugeTextView, msg: String?) {
        msg?.let { view.msgEnterSearchTerm = it }
    }

    @ReactProp(name = "msgAnalyzing")
    fun setMsgAnalyzing(view: HugeTextView, msg: String?) {
        msg?.let { view.msgAnalyzing = it }
    }

    @ReactProp(name = "msgMaxSelectionLimit")
    fun setMsgMaxSelectionLimit(view: HugeTextView, msg: String?) {
        msg?.let { view.msgMaxSelectionLimit = it }
    }

    @ReactProp(name = "msgNothingSelected")
    fun setMsgNothingSelected(view: HugeTextView, msg: String?) {
        msg?.let { view.msgNothingSelected = it }
    }

    @ReactProp(name = "msgCopiedLines")
    fun setMsgCopiedLines(view: HugeTextView, msg: String?) {
        msg?.let { view.msgCopiedLines = it }
    }

    @ReactProp(name = "msgCopyFailed")
    fun setMsgCopyFailed(view: HugeTextView, msg: String?) {
        msg?.let { view.msgCopyFailed = it }
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> {
        return com.facebook.react.common.MapBuilder.builder<String, Any>()
            .put("onGenerateComplete", com.facebook.react.common.MapBuilder.of("registrationName", "onGenerateComplete"))
            .put("onLineClicked", com.facebook.react.common.MapBuilder.of("registrationName", "onLineClicked"))
            .put("onSearchProgress", com.facebook.react.common.MapBuilder.of("registrationName", "onSearchProgress"))
            .put("onSaveComplete", com.facebook.react.common.MapBuilder.of("registrationName", "onSaveComplete"))
            .put("onLineLongClicked", com.facebook.react.common.MapBuilder.of("registrationName", "onLineLongClicked"))
            .put("onLinesText", com.facebook.react.common.MapBuilder.of("registrationName", "onLinesText"))
            .put("onSelectionChanged", com.facebook.react.common.MapBuilder.of("registrationName", "onSelectionChanged"))
            .put("onSelectionModeChanged", com.facebook.react.common.MapBuilder.of("registrationName", "onSelectionModeChanged"))
            .put("onScroll", com.facebook.react.common.MapBuilder.of("registrationName", "onScroll"))
            .put("onReplaceLimit", com.facebook.react.common.MapBuilder.of("registrationName", "onReplaceLimit"))
            .put("onReplaceEnd", com.facebook.react.common.MapBuilder.of("registrationName", "onReplaceEnd"))
            .put("onFileLoaded", com.facebook.react.common.MapBuilder.of("registrationName", "onFileLoaded"))
            .put("onHardReset", com.facebook.react.common.MapBuilder.of("registrationName", "onHardReset"))
            .put("onJumpResult", com.facebook.react.common.MapBuilder.of("registrationName", "onJumpResult"))
            .build()
    }

    override fun getCommandsMap(): Map<String, Int> {
        return mapOf(
            "search" to 1,
            "generateSample" to 2,
            "replaceLine" to 3,
            "jumpToTop" to 4,
            "jumpToBottom" to 5,
            "jumpToLine" to 6,
            "findPrev" to 7,
            "reverseSearchFromBottom" to 8,
            "reverseSearch" to 9,
            "replaceLines" to 10,
            "syncFile" to 11,
            "saveToUri" to 12,
            "copyLocalToUri" to 13,
            "clearSearch" to 14,
            "setSelectedLines" to 15,
            "getLinesText" to 16,
            "finishSearch" to 17,
            "clearSelection" to 20,
            "createEmptyFile" to 21,
            "findNext" to 18,
            "findPrev" to 19,
            "selectAll" to 22,
            "selectRange" to 23,
            "replaceAll" to 24,
            "replace" to 25,
            "jumpToLastSearchMatch" to 26,
            "getSelectedTextForBridge" to 27,
            "setSearchState" to 28,
            "copySelectionToClipboard" to 29,
            "reloadFile" to 30,
            "requestSearchInfo" to 31,
            "jumpToOccurrence" to 32,
            "exportSelectionToFile" to 33
        )
    }

    override fun receiveCommand(view: HugeTextView, commandId: Int, args: com.facebook.react.bridge.ReadableArray?) {
        when (commandId) {
            1 -> {
                val query = args?.getString(0) ?: ""
                val matchCase = args?.getBoolean(1) ?: false
                view.find(query, matchCase, true)
            }
            2 -> {
                val path = args?.getString(0) ?: ""
                val sizeMb = args?.getInt(1) ?: 100
                generateLargeFile(view, path, sizeMb)
            }
            3 -> {
                val index = args?.getInt(0) ?: -1
                val newText = args?.getString(1) ?: ""
                view.replaceLine(index, newText)
            }
            4 -> view.jumpToTop()
            5 -> view.jumpToBottom()
            6 -> {
                val line = args?.getInt(0) ?: 0
                view.jumpToLine(line)
            }
            7 -> {
                val query = args?.getString(0) ?: ""
                val matchCase = args?.getBoolean(1) ?: false
                view.find(query, matchCase, false)
            }
            8 -> {
                val query = args?.getString(0) ?: ""
                val matchCase = args?.getBoolean(1) ?: false
                view.reverseSearchFromBottom(query, matchCase)
            }
            9 -> {
                val query = args?.getString(0) ?: ""
                val matchCase = args?.getBoolean(1) ?: false
                view.reverseSearch(query, matchCase)
            }
            10 -> {
                val index = args?.getInt(0) ?: -1
                val count = args?.getInt(1) ?: 1
                val linesArray = args?.getArray(2)
                val lines = mutableListOf<String>()
                if (linesArray != null) {
                    for (i in 0 until linesArray.size()) {
                        lines.add(linesArray.getString(i) ?: "")
                    }
                }
                view.replaceLines(index, count, lines)
            }
            11 -> view.syncFile()
            12 -> {
                val uri = args?.getString(0) ?: ""
                view.saveToUri(uri)
            }
            13 -> {
                val localPath = args?.getString(0) ?: ""
                val uriString = args?.getString(1) ?: ""
                copyLocalFileToUri(view.context, localPath, uriString)
            }
            14 -> view.clearSearch()
            15 -> {
                val lineIndices = args?.getArray(0)
                val list = mutableListOf<Int>()
                if (lineIndices != null) {
                    for (i in 0 until lineIndices.size()) {
                        list.add(lineIndices.getInt(i))
                    }
                }
                view.setSelectedLines(list)
            }
            16 -> {
                val start = args?.getInt(0) ?: 0
                val count = args?.getInt(1) ?: 1
                val text = view.getLinesText(start, count)
                val event = Arguments.createMap()
                event.putString("text", text)
                (view.context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(view.id, "onLinesText", event)
            }
            17 -> view.finishSearch()
            20 -> view.clearSelection()
            21 -> {
                val path = args?.getString(0) ?: ""
                view.createEmptyFile(path)
            }
            18 -> {
                val query = if (args != null && args.size() > 0) args.getString(0) else view.lastSearchQuery
                val matchCase = if (args != null && args.size() > 1) args.getBoolean(1) else view.lastSearchMatchCase
                view.find(query ?: "", matchCase, true)
            }
            19 -> {
                val query = if (args != null && args.size() > 0) args.getString(0) else view.lastSearchQuery
                val matchCase = if (args != null && args.size() > 1) args.getBoolean(1) else view.lastSearchMatchCase
                view.find(query ?: "", matchCase, false)
            }
            22 -> view.selectAllLines()
            23 -> {
                val start = args?.getInt(0) ?: 0
                val end = args?.getInt(1) ?: 0
                view.selectLineRange(start, end)
            }
            24 -> {
                val query = args?.getString(0) ?: ""
                val replacement = args?.getString(1) ?: ""
                val matchCase = args?.getBoolean(2) ?: false
                val applyLimit = args?.getBoolean(3) ?: false
                view.replaceAll(query, replacement, matchCase, applyLimit)
            }
            25 -> {
                val replacement = args?.getString(0) ?: ""
                view.replace(replacement)
            }
            26 -> view.jumpToLastSearchMatch()
            27 -> {
                val text = view.getSelectedTextForBridge()
                val event = Arguments.createMap()
                event.putString("text", text)
                (view.context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(view.id, "onLinesText", event)
            }
            28 -> {
                val line = args?.getInt(0) ?: -1
                val offset = args?.getInt(1) ?: -1
                val query = args?.getString(2)
                val matchCase = args?.getBoolean(3) ?: false
                view.setSearchState(line, offset, query, matchCase)
            }
            29 -> view.copySelectionToClipboard()
            30 -> view.reloadFile()
            31 -> {
                val query = args?.getString(0)
                val matchCase = if (args != null && args.size() > 1) args.getBoolean(1) else false
                view.requestFullSearchCount(query, matchCase)
            }
            32 -> {
                val line = args?.getInt(0) ?: 0
                val occurrence = args?.getInt(1) ?: 1
                val query = args?.getString(2) ?: ""
                val matchCase = args?.getBoolean(3) ?: false
                view.jumpToOccurrence(line, occurrence, query, matchCase)
            }
            33 -> {
                val path = args?.getString(0) ?: ""
                view.exportSelectionToFile(path)
            }
            else -> {}
        }
    }

    override fun receiveCommand(view: HugeTextView, commandId: String, args: com.facebook.react.bridge.ReadableArray?) {
        when (commandId) {
            "search" -> receiveCommand(view, 1, args)
            "generateSample" -> receiveCommand(view, 2, args)
            "replaceLine" -> receiveCommand(view, 3, args)
            "jumpToTop" -> receiveCommand(view, 4, args)
            "jumpToBottom" -> receiveCommand(view, 5, args)
            "jumpToLine" -> receiveCommand(view, 6, args)
            "findPrev" -> receiveCommand(view, 7, args)
            "reverseSearchFromBottom" -> receiveCommand(view, 8, args)
            "reverseSearch" -> receiveCommand(view, 9, args)
            "replaceLines" -> receiveCommand(view, 10, args)
            "syncFile" -> receiveCommand(view, 11, args)
            "saveToUri" -> receiveCommand(view, 12, args)
            "copyLocalToUri" -> receiveCommand(view, 13, args)
            "clearSearch" -> receiveCommand(view, 14, args)
            "setSelectedLines" -> receiveCommand(view, 15, args)
            "getLinesText" -> receiveCommand(view, 16, args)
            "finishSearch" -> receiveCommand(view, 17, args)
            "clearSelection" -> receiveCommand(view, 20, args)
            "createEmptyFile" -> receiveCommand(view, 21, args)
            "findNext" -> receiveCommand(view, 18, args)
            "findPrev" -> receiveCommand(view, 19, args)
            "selectAll" -> receiveCommand(view, 22, args)
            "selectRange" -> receiveCommand(view, 23, args)
            "replaceAll" -> receiveCommand(view, 24, args)
            "replace" -> receiveCommand(view, 25, args)
            "jumpToLastSearchMatch" -> receiveCommand(view, 26, args)
            "getSelectedTextForBridge" -> receiveCommand(view, 27, args)
            "setSearchState" -> receiveCommand(view, 28, args)
            "reloadFile" -> receiveCommand(view, 30, args)
            "requestSearchInfo" -> receiveCommand(view, 31, args)
            "jumpToOccurrence" -> receiveCommand(view, 32, args)
            "exportSelectionToFile" -> receiveCommand(view, 33, args)
        }
    }

    private fun copyLocalFileToUri(context: android.content.Context, localPath: String, uriString: String) {
        val uri = android.net.Uri.parse(uriString)
        val srcFile = java.io.File(localPath)
        Thread {
            try {
                context.contentResolver.openOutputStream(uri)?.use { output ->
                    srcFile.inputStream().use { input ->
                        input.copyTo(output)
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }.start()
    }

    private fun generateLargeFile(view: HugeTextView, path: String, sizeMb: Int) {
        val reactContext = view.context as? com.facebook.react.bridge.ReactContext ?: return
        val viewId = view.id
        
        Thread {
            try {
                val file = java.io.File(path)
                if (file.exists()) file.delete()
                file.parentFile?.mkdirs()
                
                val fos = java.io.FileOutputStream(file)
                val bos = java.io.BufferedOutputStream(fos, 1024 * 1024)
                
                val lineStr = "STRESS TEST LINE. Native TorqueNote Engine handles 1GB+. Line Index: "
                val lineTail = " | [MEMORY SAFE] [ULTRA FAST] [RELIABLE] \n"
                
                var currentSize = 0L
                val targetSize = sizeMb.toLong() * 1024 * 1024
                var lineCounter = 0
                
                while (currentSize < targetSize) {
                    val line = "$lineStr$lineCounter$lineTail"
                    val b = line.toByteArray(Charsets.UTF_8)
                    bos.write(b)
                    currentSize += b.size
                    lineCounter++
                }
                bos.flush()
                bos.close()
                fos.close()
                
                val map = com.facebook.react.bridge.Arguments.createMap()
                map.putString("status", "complete")
                map.putString("path", path)
                
                reactContext.getJSModule(com.facebook.react.uimanager.events.RCTEventEmitter::class.java)
                    .receiveEvent(viewId, "onGenerateComplete", map)
                
            } catch (e: Exception) {
                e.printStackTrace()
                val map = com.facebook.react.bridge.Arguments.createMap()
                map.putString("status", "error")
                map.putString("error", e.message)
                reactContext.getJSModule(com.facebook.react.uimanager.events.RCTEventEmitter::class.java)
                    .receiveEvent(viewId, "onGenerateComplete", map)
            }
        }.start()
    }
}
