package com.neoscribe

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.text.SpannableString
import android.text.Spanned
import android.text.style.BackgroundColorSpan
import android.text.style.ForegroundColorSpan
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import android.animation.ValueAnimator
import android.graphics.DashPathEffect
import android.graphics.LinearGradient
import android.graphics.Shader
import android.view.animation.LinearInterpolator
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import java.io.File
import java.io.RandomAccessFile
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

class HugeTextView(context: Context) : RecyclerView(context) {

    private val SPARSE_STEP = 500
    private val MAX_LINE_BYTES = 8000 // 🚀 VIRTUAL BREAK: Slightly smaller for even smoother UI measurement
    @Volatile private var sparseIndex = LongArray(100000) 
    @Volatile private var currentLineCount = 0
    @Volatile private var currentFile: File? = null
    
    companion object {
        private val instances = java.util.concurrent.ConcurrentHashMap<Int, java.lang.ref.WeakReference<HugeTextView>>()
        fun getInstance(id: Int): HugeTextView? = instances[id]?.get()
    }
    private val linesPerBlock = 100 
    
    private var raf: RandomAccessFile? = null
    private var rafSearch: RandomAccessFile? = null
    private val isSwapping = AtomicBoolean(false)
    private val isIndexing = AtomicBoolean(false)
    private val isSearching = AtomicBoolean(false)
    private var pendingFindNextAfterLoad = false
    
    private val taskExecutor = Executors.newSingleThreadExecutor()
    private val searchExecutor = Executors.newSingleThreadExecutor()
    private val countExecutor = Executors.newSingleThreadExecutor()
    private val currentTaskId = AtomicInteger(0)
    private val mainHandler = Handler(Looper.getMainLooper())

    internal var lastSearchQuery: String? = null
    internal var lastSearchMatchCase = false
    private var lastSearchLine = -1
    private var lastSearchOffsetInLine = -1
    private var highlightedLine = -1
    private val selectedLines = java.util.BitSet() // GROW DYNAMICALLY
    internal var lastTargetLine = -1
    private var lastJumpWasExplicit = false
    private var lastJumpWasFromSearch = false
    private var lastJumpOffset = -1
    var selectionModeActive = false

    private var windowStartLine = 0
    private val windowSize = 10000
    private var syntaxExtension = ""
    private var fontSize = 14f
    private var bgThemeColor = Color.WHITE
    private var textThemeColor = Color.parseColor("#333333")
    private var selectionThemeColor = Color.parseColor("#E3F2FD")
    private var lineNumberThemeColor = Color.parseColor("#8899AA")

    // Line Cache for UI performance
    private val lineCache = java.util.concurrent.ConcurrentHashMap<Int, String>()
    private val MAX_CACHE_SIZE = 500

    private var lastScrollToken = 0L 
    private var isSelectingWithRect = false
    private var selectionRectStart = android.graphics.PointF()
    private var selectionRectEnd = android.graphics.PointF()
    private val selectionRectPaint = android.graphics.Paint().apply {
        color = Color.parseColor("#4285F4")
        alpha = 80
        style = android.graphics.Paint.Style.FILL
    }
    private val selectionRectBorderPaint = android.graphics.Paint().apply {
        color = Color.parseColor("#1976D2")
        strokeWidth = 10f
        style = android.graphics.Paint.Style.STROKE
        isAntiAlias = true
    }
    private var selectionDashPhase = 0f
    
    // Localization
    var msgEnterSearchTerm = "Enter a search term first"
    var msgAnalyzing = "Analyzing document... This may take a moment for large files."
    var msgMaxSelectionLimit = "Maximum selection reached: 1 million lines"
    var msgNothingSelected = "Nothing selected"
    var msgCopiedLines = "Copied {{count}} lines to clipboard"
    var msgCopyFailed = "Copy failed: {{message}}"
    private var selectionAnimator: ValueAnimator? = null
    private var currentScrubLine = -1
    
    // Regex Patterns
    private val PATTERN_NUMBERS = java.util.regex.Pattern.compile("\\b(\\d+)\\b")
    private val PATTERN_QUOTES = java.util.regex.Pattern.compile("\"([^\"]*)\"|'([^']*)'")
    private val PATTERN_KEYWORDS_PY = java.util.regex.Pattern.compile("\\b(def|class|if|else|elif|return|import|from|while|for|in|try|except|print|None|True|False|and|or|not|as|with|pass|break|continue)\\b")
    private val PATTERN_KEYWORDS_JS = java.util.regex.Pattern.compile("\\b(function|const|let|var|if|else|return|import|export|from|class|extends|new|this|try|catch|async|await|switch|case|break|continue|typeof|instanceof|void|delete)\\b")
    private val PATTERN_KEYWORDS_JAVA = java.util.regex.Pattern.compile("\\b(public|private|protected|class|interface|enum|extends|implements|new|this|super|return|if|else|switch|case|break|continue|while|for|try|catch|finally|throw|throws|static|final|abstract|native|synchronized|volatile|transient|boolean|int|long|float|double|char|byte|short|void)\\b")
    private val PATTERN_KEYWORDS_C_CPP = java.util.regex.Pattern.compile("\\b(auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|int|long|register|return|short|signed|sizeof|static|struct|switch|typedef|union|unsigned|void|volatile|while)\\b")
    private val PATTERN_TAGS = java.util.regex.Pattern.compile("<[^>]+>")
    private val PATTERN_COMMENTS_SHARP = java.util.regex.Pattern.compile("#.*")
    private val PATTERN_COMMENTS_SLASH = java.util.regex.Pattern.compile("//.*|/\\*.*?\\*/")
    private val PATTERN_OPERATORS = java.util.regex.Pattern.compile("[+\\-*/%=!<>|&^~?:;]")
    private val PATTERN_BRACKETS = java.util.regex.Pattern.compile("[()\\[\\]{}]")
    private val PATTERN_ANNOTATIONS = java.util.regex.Pattern.compile("@\\w+")
    private val PATTERN_FUNCTIONS = java.util.regex.Pattern.compile("\\b\\w+(?=\\s*\\()")
    private val PATTERN_TYPES = java.util.regex.Pattern.compile("\\b[A-Z]\\w*\\b")

    var isRainbowTheme = false
    
    fun setRainbowMode(enable: Boolean) {
        if (isRainbowTheme != enable) {
            isRainbowTheme = enable
            isVerticalScrollBarEnabled = !enable 
            if (enable) {
                ensureAnimationStarted()
            }
            invalidate()
        }
    }

    private fun ensureAnimationStarted() {
        if (selectionAnimator == null || !selectionAnimator!!.isRunning) {
            selectionAnimator?.cancel()
            selectionAnimator = ValueAnimator.ofFloat(selectionDashPhase, selectionDashPhase + 30000f).apply {
                duration = 300000 
                repeatCount = ValueAnimator.INFINITE
                interpolator = LinearInterpolator()
                addUpdateListener { animator ->
                    selectionDashPhase = animator.animatedValue as Float
                    invalidate() 
                }
                start()
            }
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        ensureAnimationStarted()
    }

    init {
        layoutManager = LinearLayoutManager(context)
        adapter = HugeTextAdapter()
        setBackgroundColor(bgThemeColor)
        setHasFixedSize(true)
        isVerticalScrollBarEnabled = true
        setItemViewCacheSize(25)
        setWillNotDraw(false) // IMPORTANT: Allow custom drawing
        
        // Add even more bottom padding to ensure last line can reach top/center
        val dm = context.resources.displayMetrics
        setPadding(0, 0, 0, (dm.heightPixels * 0.8).toInt())
        clipToPadding = false
        clipChildren = true
        
        // Add ItemDecoration to draw selection rectangle on top of all children
        addItemDecoration(object : RecyclerView.ItemDecoration() {
            override fun onDrawOver(c: android.graphics.Canvas, parent: RecyclerView, state: RecyclerView.State) {
                try {
                    // Standardized rainbow parameters
                    val rainbowCycleSize = 600f
                    val rainbowColors = intArrayOf(
                        0xFFE63946.toInt(), 0xFFF77F00.toInt(), 0xFFFCBF49.toInt(), 
                        0xFF06D6A0.toInt(), 0xFF118AB2.toInt(), 0xFF073B4C.toInt(), 0xFF9D4EDD.toInt(),
                        0xFFE63946.toInt()
                    )
                    
                    // Use ValueAnimator's selectionDashPhase directly
                    val phase = (selectionDashPhase % rainbowCycleSize) / rainbowCycleSize
                    
                    if (isSelectingWithRect && selectionModeActive) {
                        try {
                            c.save()
                            c.clipRect(0, 0, parent.width, parent.height)
                            
                            val left = Math.min(selectionRectStart.x, selectionRectEnd.x)
                            val right = Math.max(selectionRectStart.x, selectionRectEnd.x)
                            val top = Math.min(selectionRectStart.y, selectionRectEnd.y)
                            val bottom = Math.max(selectionRectStart.y, selectionRectEnd.y)
                            
                            selectionRectBorderPaint.pathEffect = if (isRainbowTheme) null else DashPathEffect(floatArrayOf(20f, 10f), selectionDashPhase)
                            
                            if (isRainbowTheme) {
                                val offset = rainbowCycleSize * phase
                                // Horizontal moving rainbow
                                val borderShader = android.graphics.LinearGradient(
                                    -offset, 0f, rainbowCycleSize - offset, 0f,
                                    rainbowColors, null, android.graphics.Shader.TileMode.REPEAT
                                )
                                selectionRectBorderPaint.shader = borderShader
                                selectionRectBorderPaint.alpha = 255
                                
                                val fillShader = android.graphics.LinearGradient(
                                    -offset, 0f, rainbowCycleSize - offset, 0f,
                                    rainbowColors, null, android.graphics.Shader.TileMode.REPEAT
                                )
                                selectionRectPaint.shader = fillShader
                                selectionRectPaint.alpha = 40
                            } else {
                                selectionRectBorderPaint.shader = null
                                selectionRectBorderPaint.color = selectionThemeColor
                                selectionRectBorderPaint.alpha = 255
                                selectionRectPaint.shader = null
                                selectionRectPaint.color = selectionThemeColor
                                selectionRectPaint.alpha = 80
                            }
                            
                            val halfStroke = selectionRectBorderPaint.strokeWidth / 2f
                            c.drawRect(left, top, right, bottom, selectionRectPaint)
                            c.drawRect(left + halfStroke, top + halfStroke, right - halfStroke, bottom - halfStroke, selectionRectBorderPaint)
                            c.restore()
                        } catch (e: Exception) {
                            Log.e("HugeTextView", "onDrawOver: Error drawing selection rect", e)
                        }
                    }

                    // --- Unified Borders for Permanent Selections ---
                    if (selectionModeActive) {
                        try {
                            synchronized(selectedLines) {
                                if (!selectedLines.isEmpty) {
                                    c.save()
                                    c.clipRect(0, 0, parent.width, parent.height)
                                    
                                    var blockStartTop = -1f
                                    var blockBottom = -1f
                                    val totalLines = currentLineCount
                                    
                                    for (i in 0 until parent.childCount) {
                                        try {
                                            val child = parent.getChildAt(i) ?: continue
                                            val childPos = parent.getChildAdapterPosition(child)
                                            if (childPos == RecyclerView.NO_POSITION) continue
                                            
                                            val absolutePos = windowStartLine + childPos
                                            if (absolutePos < 0 || absolutePos >= totalLines) continue
                                            
                                            val isLineSelected = selectedLines.get(absolutePos)
                                            
                                            if (isLineSelected) {
                                                if (blockStartTop == -1f) {
                                                    blockStartTop = child.top.toFloat()
                                                }
                                                blockBottom = child.bottom.toFloat()
                                                
                                                val nextAbsolutePos = absolutePos + 1
                                                val nextIsSelected = if (nextAbsolutePos < totalLines) {
                                                    selectedLines.get(nextAbsolutePos)
                                                } else false
                                                
                                                if (!nextIsSelected || i == (parent.childCount - 1)) {
                                                    selectionRectBorderPaint.pathEffect = if (isRainbowTheme) null else DashPathEffect(floatArrayOf(30f, 15f), selectionDashPhase)
                                                    
                                                    if (isRainbowTheme) {
                                                        val offset = rainbowCycleSize * phase
                                                        val borderShader = android.graphics.LinearGradient(
                                                            -offset, 0f, rainbowCycleSize - offset, 0f,
                                                            rainbowColors, null, android.graphics.Shader.TileMode.REPEAT
                                                        )
                                                        selectionRectBorderPaint.shader = borderShader
                                                        selectionRectBorderPaint.alpha = 255
                                                    } else {
                                                        selectionRectBorderPaint.shader = null
                                                        selectionRectBorderPaint.color = selectionThemeColor
                                                        selectionRectBorderPaint.alpha = 255
                                                    }
                                                    
                                                    val sw = 10f
                                                    selectionRectBorderPaint.strokeWidth = sw
                                                    val hs = sw / 2f
                                                    
                                                    c.drawRect(hs, blockStartTop + hs, parent.width.toFloat() - hs, blockBottom - hs, selectionRectBorderPaint)
                                                    
                                                    blockStartTop = -1f
                                                }
                                            }
                                        } catch (e: Exception) {
                                            Log.e("HugeTextView", "onDrawOver: Error processing child $i", e)
                                        }
                                    }
                                    c.restore()
                                }
                            }
                        } catch (e: Exception) {
                           Log.e("HugeTextView", "onDrawOver: Error drawing selection borders", e)
                        }
                    }

                    // Always request next frame if something animated is visible
                    if (isRainbowTheme || (selectionModeActive && (isSelectingWithRect || synchronized(selectedLines) { !selectedLines.isEmpty() }))) {
                        postInvalidateOnAnimation()
                    } else if (selectionAnimator?.isRunning == true) {
                        // Keep invalidating if animator is running but we are not in rainbow/selection mode
                        // to keep selectionDashPhase updated, but only if selectionModeActive might be triggered
                        postInvalidateOnAnimation()
                    }

                    // --- Custom Rainbow Scrollbar ---
                    if (isRainbowTheme) {
                        try {
                            val lm = parent.layoutManager as? LinearLayoutManager
                            if (lm != null) {
                                val range = lm.computeVerticalScrollRange(state)
                                val offset = lm.computeVerticalScrollOffset(state)
                                val extent = lm.computeVerticalScrollExtent(state)
                                
                                if (range > extent && extent > 0) {
                                    val scrollbarWidth = 12f 
                                    val trackHeight = parent.height.toFloat()
                                    val thumbHeight = Math.max(80f, (extent.toFloat() / range.toFloat()) * trackHeight)
                                    val thumbTop = (offset.toFloat() / (range - extent).toFloat()) * (trackHeight - thumbHeight)
                                    
                                    val scrollbarPaint = android.graphics.Paint().apply {
                                        val shift = rainbowCycleSize * phase
                                        // Vertical moving rainbow
                                        shader = android.graphics.LinearGradient(
                                            0f, -shift, 0f, rainbowCycleSize - shift,
                                            rainbowColors, null, android.graphics.Shader.TileMode.REPEAT
                                        )
                                        style = android.graphics.Paint.Style.FILL
                                        isAntiAlias = true
                                    }
                                    
                                    val left = parent.width.toFloat() - scrollbarWidth
                                    val right = parent.width.toFloat()
                                    val radius = scrollbarWidth / 2f
                                    
                                    val rectF = android.graphics.RectF(left, thumbTop, right, thumbTop + thumbHeight)
                                    c.drawRoundRect(rectF, radius, radius, scrollbarPaint)
                                }
                            }
                        } catch (e: Exception) {
                            Log.e("HugeTextView", "onDrawOver: Error drawing scrollbar", e)
                        }
                    }
                } catch (e: Exception) {
                    Log.e("HugeTextView", "onDrawOver: General Error", e)
                }
            }
        })


        // Initialize selection border animator with a large range for continuous movement
        selectionAnimator = ValueAnimator.ofFloat(0f, 30000f).apply {
            duration = 300000 // 5 minutes slow scroll (was 1 minute - now much slower)
            repeatCount = ValueAnimator.INFINITE
            interpolator = LinearInterpolator()
            addUpdateListener { animator ->
                selectionDashPhase = animator.animatedValue as Float
                // Force a redraw of the decoration
                invalidate() 
            }
            start()
        }

        addOnItemTouchListener(object : RecyclerView.OnItemTouchListener {
            private var isDraggingScrollBar = false
            private var selectionPointerId = -1
            private var scrollPointerId = -1
            private var lastScrollY = 0f
            private var startX = 0f
            private var startY = 0f
            private val touchSlop = android.view.ViewConfiguration.get(context).scaledTouchSlop
            
            private val handler = Handler(Looper.getMainLooper())
            private val longPressRunnable = Runnable {
                if (!isDraggingScrollBar && !isSelectingWithRect) {
                    isSelectingWithRect = true
                    // selectionPointerId is already set in ACTION_DOWN
                    selectionRectStart.set(startX, startY)
                    selectionRectEnd.set(startX, startY)
                    invalidate()
                    
                    // Immediately select the line under the finger BEFORE notifying that we've entered selection mode.
                    // This ensures bindingAdapterPosition is still valid before the adapter resets.
                    selectItemsInRect()
                    
                    if (!selectionModeActive) {
                        selectionModeActive = true
                        val event = Arguments.createMap()
                        event.putBoolean("active", true)
                        (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)
                            ?.receiveEvent(id, "onSelectionModeChanged", event)
                        adapter?.notifyDataSetChanged()
                        invalidate()
                    }
                    
                    // 🚀 ANTI-HIJACK FIX: Prevent parent (Tabs/Pager) from stealing the gesture
                    parent?.requestDisallowInterceptTouchEvent(true)
                }
            }

            override fun onInterceptTouchEvent(rv: RecyclerView, e: android.view.MotionEvent): Boolean {
                val x = e.x
                val y = e.y
                
                when (e.actionMasked) {
                    android.view.MotionEvent.ACTION_DOWN -> {
                        startX = x
                        startY = y
                        isDraggingScrollBar = false
                        scrollPointerId = -1
                        lastScrollY = 0f
                        selectionPointerId = e.getPointerId(0)

                        // Right edge scrollbar jump
                        if (x > width - 120) {
                            isDraggingScrollBar = true
                            currentScrubLine = -1
                            handleScrollBarJump(y)
                            return true
                        }
                        
                        // Immediate gutter trigger
                        if (x < 150) {
                             isSelectingWithRect = true
                             selectionRectStart.set(x, y)
                             selectionRectEnd.set(x, y)
                             invalidate()
                             
                             // Select immediately before notifying adapter to avoid NO_POSITION during rebind
                             selectItemsInRect()

                             if (!selectionModeActive) {
                                 selectionModeActive = true
                                 val event = Arguments.createMap()
                                 event.putBoolean("active", true)
                                 (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)
                                     ?.receiveEvent(id, "onSelectionModeChanged", event)
                                 adapter?.notifyDataSetChanged()
                             }
                             invalidate()
                             
                             // 🚀 ANTI-HIJACK FIX: Prevent parent from stealing the gutter gesture
                             parent?.requestDisallowInterceptTouchEvent(true)
                             
                             return true // Intercept gutter immediately
                        } else {
                            // Tap and hold anywhere else (Long Press trigger - reduced delay)
                            handler.postDelayed(longPressRunnable, 200)
                        }
                    }
                    android.view.MotionEvent.ACTION_POINTER_DOWN -> {
                        if (isSelectingWithRect && scrollPointerId == -1) {
                            val idx = e.actionIndex
                            if (e.getPointerId(idx) != selectionPointerId) {
                                scrollPointerId = e.getPointerId(idx)
                                lastScrollY = e.getY(idx)
                            }
                        }
                    }
                    android.view.MotionEvent.ACTION_MOVE -> {
                        if (Math.abs(x - startX) > touchSlop || Math.abs(y - startY) > touchSlop) {
                            handler.removeCallbacks(longPressRunnable)
                        }

                        if (isSelectingWithRect) {
                            selectionRectEnd.set(x, y)
                            invalidate()
                            selectItemsInRect()
                            
                            val dx = Math.abs(x - startX)
                            val dy = Math.abs(y - startY)
                            if (dx > touchSlop || dy > touchSlop || e.pointerCount > 1) {
                                return true
                            }
                        }
                    }
                    android.view.MotionEvent.ACTION_UP, android.view.MotionEvent.ACTION_CANCEL -> {
                        handler.removeCallbacks(longPressRunnable)
                        if (isSelectingWithRect) {
                            isSelectingWithRect = false
                            selectionRectStart.set(-1f, -1f)
                            selectionRectEnd.set(-1f, -1f)
                            notifySelectionChanged()
                            invalidate()
                        }
                    }
                }
                
                return isDraggingScrollBar || isSelectingWithRect
            }

            override fun onTouchEvent(rv: RecyclerView, e: android.view.MotionEvent) {
                 if (isSelectingWithRect) {
                     when (e.actionMasked) {
                         android.view.MotionEvent.ACTION_POINTER_DOWN -> {
                             if (scrollPointerId == -1) {
                                 val idx = e.actionIndex
                                 if (e.getPointerId(idx) != selectionPointerId) {
                                     scrollPointerId = e.getPointerId(idx)
                                     lastScrollY = e.getY(idx)
                                 }
                             }
                         }
                         android.view.MotionEvent.ACTION_MOVE -> {
                             val selIdx = e.findPointerIndex(selectionPointerId)
                             if (selIdx != -1) {
                                 selectionRectEnd.set(e.getX(selIdx), e.getY(selIdx))
                                 invalidate()
                                 selectItemsInRect()
                             }

                             val scrIdx = e.findPointerIndex(scrollPointerId)
                             if (scrIdx != -1) {
                                 val currentY = e.getY(scrIdx)
                                 if (lastScrollY != 0f) {
                                     // Increased sensitivity (1.5x) for smoother, longer scrolls
                                     val deltaY = (lastScrollY - currentY) * 1.5f
                                     if (Math.abs(deltaY) > 0.5f) {
                                         scrollBy(0, deltaY.toInt())
                                     }
                                 }
                                 lastScrollY = currentY
                             } else if (e.pointerCount > 1) {
                                 for (i in 0 until e.pointerCount) {
                                     val pid = e.getPointerId(i)
                                     if (pid != selectionPointerId) {
                                         scrollPointerId = pid
                                         lastScrollY = e.getY(i)
                                         break
                                     }
                                 }
                             }
                         }
                         android.view.MotionEvent.ACTION_POINTER_UP -> {
                             val pid = e.getPointerId(e.actionIndex)
                             if (pid == selectionPointerId) {
                                 isSelectingWithRect = false
                                 selectionPointerId = -1
                                 invalidate()
                             } else if (pid == scrollPointerId) {
                                 scrollPointerId = -1
                                 lastScrollY = 0f
                             }
                         }
                         android.view.MotionEvent.ACTION_UP, android.view.MotionEvent.ACTION_CANCEL -> {
                             isSelectingWithRect = false
                             selectionPointerId = -1
                             scrollPointerId = -1
                             lastScrollY = 0f
                             
                             // Force immediate visual update of selection borders
                             invalidateItemDecorations()
                             adapter?.notifyDataSetChanged()
                             
                             // Tiny scroll nudge to force RecyclerView to redraw decorations
                             post {
                                 scrollBy(0, 1)
                                 post {
                                     scrollBy(0, -1)
                                 }
                             }
                             
                             notifySelectionChanged()
                             invalidate()
                         }
                     }
                 } else if (isDraggingScrollBar) {
                     handleScrollBarJump(e.y)
                     if (e.action == android.view.MotionEvent.ACTION_UP || e.action == android.view.MotionEvent.ACTION_CANCEL) {
                         isDraggingScrollBar = false
                     }
                 }
            }

            override fun onRequestDisallowInterceptTouchEvent(disallowIntercept: Boolean) {}
        })

        // Add scroll listener to refresh selection and report scroll position
        addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                try {
                    if (isSelectingWithRect) {
                        Log.d("HugeTextView", "onScrolled: Calling selectItemsInRect (dx=$dx, dy=$dy)")
                        selectItemsInRect()
                    }
                    
                    // Report current top visible line to React Native
                    val firstPos = (layoutManager as? LinearLayoutManager)?.findFirstVisibleItemPosition() ?: 0
                    val event = Arguments.createMap()
                    event.putInt("line", firstPos)
                    (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)
                        ?.receiveEvent(id, "onScroll", event)
                } catch (e: Exception) {
                    Log.e("HugeTextView", "onScrolled: ERROR", e)
                }
            }
        })
    }

    private fun notifySelectionChanged() {
        val selectedCount = synchronized(selectedLines) { selectedLines.cardinality() }
        val event = Arguments.createMap()
        val indicesArray = Arguments.createArray()
        
        // 🚀 BRIDGE SAFETY: Only send indices if count is reasonable
        if (selectedCount in 1..25000) {
            synchronized(selectedLines) {
                var i = selectedLines.nextSetBit(0)
                while (i != -1) {
                    indicesArray.pushInt(i)
                    i = selectedLines.nextSetBit(i + 1)
                }
            }
        }
        
        val range = getSelectedRange()
        if (selectedCount in 1..2000) {
             event.putString("text", getSelectedLinesText())
        } else if (selectedCount > 2000) {
             event.putString("text", "[MASSIVE_SELECTION]")
        } else {
             event.putString("text", "")
        }

        if (range != null) {
            event.putInt("rangeStartIndex", range.first)
            event.putInt("rangeCount", range.second)
        }

        event.putArray("indices", indicesArray)
        event.putInt("count", selectedCount)
        event.putInt("totalLineCount", currentLineCount)
        
        (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(id, "onSelectionChanged", event)
    }

    private fun handleScrollBarJump(y: Float) {
        val total = synchronized(this@HugeTextView) { currentLineCount }
        if (total <= 0) return
        val percentage = (y / height).coerceIn(0f, 1f)
        val targetLine = (percentage * (total - 1)).toInt()
        if (targetLine != currentScrubLine) {
            currentScrubLine = targetLine
            jumpToLine(targetLine)
        }
    }

    private fun forceRefreshJiggle() {
        post {
            try {
                scrollBy(0, 1)
                scrollBy(0, -1)
            } catch (e: Exception) {}
        }
    }

    internal fun megaRefresh() {
        post {
            adapter?.notifyDataSetChanged()
            requestLayout()
            invalidate()
            forceRefreshJiggle()
            notifySelectionChanged()
        }
    }

    private fun growIndex() {
        val newSize = (sparseIndex.size * 1.5).toInt()
        sparseIndex = sparseIndex.copyOf(newSize)
    }

    private fun addSparseOffset(index: Int, offset: Long) {
        synchronized(this) {
            val sparseIdx = index / SPARSE_STEP
            if (sparseIdx >= sparseIndex.size) growIndex()
            sparseIndex[sparseIdx] = offset
        }
    }

    private fun getLineOffset(targetIndex: Int, r: RandomAccessFile? = null): Long {
        val sparseIdx = targetIndex / SPARSE_STEP
        val startLine = sparseIdx * SPARSE_STEP
        var offset = synchronized(this) {
            if (sparseIdx < sparseIndex.size) sparseIndex[sparseIdx] else -1L
        }
        
        if (offset == -1L) return 0L
        if (startLine == targetIndex) return offset
        
        val tempRaf = r ?: raf ?: return offset
        synchronized(tempRaf) {
            tempRaf.seek(offset)
            var linesToSkip = targetIndex - startLine
            var bytesInCurrentLine = 0
            val buffer = ByteArray(32768)
            while (linesToSkip > 0) {
                val read = tempRaf.read(buffer)
                if (read == -1) break
                for (i in 0 until read) {
                    bytesInCurrentLine++
                    if (buffer[i] == '\n'.code.toByte() || bytesInCurrentLine >= MAX_LINE_BYTES) {
                        linesToSkip--
                        bytesInCurrentLine = 0
                        if (linesToSkip == 0) {
                            return offset + i + 1
                        }
                    }
                }
                offset += read
            }
        }
        return offset
    }

    fun loadFile(path: String, targetLine: Int = -1) {
        val cleanPath = path.replace("file://", "")
        val file = File(cleanPath)
        if (!file.exists()) {
            // If file doesn't exist, create an empty one if possible
            try {
                file.createNewFile()
            } catch (e: Exception) {
                return
            }
        }

        val taskId = currentTaskId.incrementAndGet()
        isIndexing.set(true)
        
        val isPathSame = synchronized(this) { currentFile?.absolutePath == file.absolutePath }
        currentFile = file
        
        synchronized(this) {
            lineCache.clear()
            if (!isPathSame) {
                sparseIndex = LongArray(1000) 
                currentLineCount = 0
                windowStartLine = 0
                highlightedLine = -1
                lastSearchQuery = null
                synchronized(selectedLines) { selectedLines.clear() }
            } else {
                // 🚀 SCROLL PRESERVATION: Don't wipe sparseIndex or lineCount immediately
                // This keeps the RecyclerView at its current scroll position while we re-index
                lastTargetLine = targetLine
            }
        }
        megaRefresh()

        // Notify bridge that we are loading
        if (id != -1 && isAttachedToWindow) {
            try {
                val event = Arguments.createMap()
                event.putString("status", "loading")
                event.putString("path", cleanPath)
                event.putDouble("fileSize", file.length().toDouble())
                (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(id, "onFileLoaded", event)
            } catch (e: Exception) {}
        }

        taskExecutor.execute {
            try {
                // 🚀 NUCLEAR SPEED: Open File Handles IMMEDIATELY so UI isn't blocked during 5GB scan
                synchronized(this@HugeTextView) {
                    try { raf?.close() } catch (e: Exception) {}
                    try { rafSearch?.close() } catch (e: Exception) {}
                    raf = RandomAccessFile(file, "r")
                    rafSearch = RandomAccessFile(file, "r")
                }

                val indexRaf = RandomAccessFile(file, "r")
                var offset = 0L
                var totalLines = 0
                
                addSparseOffset(0, 0)
                
                val buffer = ByteArray(1024 * 512) 
                var bytesInCurrentLine = 0

                // 🚀 SPRINT INDEXING: Quickly index the first ~2000 lines for immediate UI responsiveness
                val sprintLimit = 2000
                var sprintLines = 0
                var sprintBytesRead = indexRaf.read(buffer)
                while (sprintBytesRead != -1 && sprintLines < sprintLimit) {
                    for (i in 0 until sprintBytesRead) {
                        bytesInCurrentLine++
                        if (buffer[i] == '\n'.code.toByte() || bytesInCurrentLine >= MAX_LINE_BYTES) {
                            sprintLines++
                            totalLines++
                            bytesInCurrentLine = 0
                            if (totalLines % SPARSE_STEP == 0) addSparseOffset(totalLines, offset + i + 1)
                            if (sprintLines >= sprintLimit) {
                                offset += (i + 1)
                                break 
                            }
                        }
                    }
                    if (sprintLines < sprintLimit) offset += sprintBytesRead
                    if (sprintLines >= sprintLimit) break
                    sprintBytesRead = indexRaf.read(buffer)
                }

                // Update UI after sprint
                val sprintTotal = totalLines
                post {
                    synchronized(this@HugeTextView) {
                        // Only update count if we aren't in Preservation Mode
                        if (!isPathSame || currentLineCount < sprintTotal) {
                            currentLineCount = sprintTotal
                        }
                        adapter?.notifyDataSetChanged()
                        
                        // If we have a target line, jump to it as soon as the sprint confirms its existence
                        if (lastTargetLine in 0 until currentLineCount) {
                            jumpToLine(lastTargetLine)
                        }
                    }
                }

                var lastNotifyTime = System.currentTimeMillis()
                indexRaf.seek(offset)
                
                while (taskId == currentTaskId.get()) {
                    val bytesRead = indexRaf.read(buffer)
                    if (bytesRead == -1) break
                    
                    for (i in 0 until bytesRead) {
                        bytesInCurrentLine++
                        if (buffer[i] == '\n'.code.toByte() || bytesInCurrentLine >= MAX_LINE_BYTES) {
                            totalLines++
                            bytesInCurrentLine = 0
                            if (totalLines % SPARSE_STEP == 0) {
                                addSparseOffset(totalLines, offset + i + 1)
                            }
                        }
                    }
                    offset += bytesRead
                    
                    val now = System.currentTimeMillis()
                    if (now - lastNotifyTime > 500) {
                        val currentTotal = totalLines
                        post {
                            synchronized(this@HugeTextView) { 
                                // Grow the count if we found more lines than before, or if not same-path
                                if (!isPathSame || currentTotal > currentLineCount) {
                                    currentLineCount = currentTotal 
                                }
                                adapter?.notifyDataSetChanged()
                            }
                        }
                        lastNotifyTime = now
                    }
                }
                
                if (offset > 0 && taskId == currentTaskId.get()) {
                    indexRaf.seek(offset - 1)
                    val lastChar = indexRaf.read()
                    if (lastChar != '\n'.code) {
                        totalLines++
                        Log.d("HugeTextView", "Incrementing totalLines because last char index is not newline. LastChar: $lastChar, Offset: $offset, totalLines: $totalLines")
                    } else {
                        Log.d("HugeTextView", "Last char is newline. Offset: $offset, totalLines: $totalLines")
                    }
                } else {
                    Log.d("HugeTextView", "No lines found or offset is 0. Offset: $offset, taskId: $taskId")
                }
                
                Log.d("HugeTextView", "Load complete. Path: $cleanPath, final totalLines: $totalLines, offset: $offset")
                
                if (totalLines == 0) {
                    addSparseOffset(0, 0)
                }

                indexRaf.close()
                
                if (taskId == currentTaskId.get()) {
                    synchronized(this@HugeTextView) {
                        currentLineCount = totalLines
                    }
                    post {
                        isIndexing.set(false)
                        
                        // 🚀 AUTO-FIND NEXT: If we just replaced something, jump to the next match immediately
                        if (pendingFindNextAfterLoad && lastSearchQuery != null) {
                            pendingFindNextAfterLoad = false
                            find(lastSearchQuery!!, lastSearchMatchCase, true)
                        }

                        // Notify bridge indexing complete
                        if (id != -1) {
                            try {
                                val event = Arguments.createMap()
                                event.putString("status", "success")
                                event.putString("path", cleanPath)
                                event.putInt("totalLines", totalLines)
                                (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(id, "onFileLoaded", event)
                            } catch (e: Exception) {
                                Log.e("HugeTextView", "Failed to send success event", e)
                            }
                        }
                        
                        // Restore last target line if set
                        if (lastTargetLine >= 0) {
                            jumpToLine(lastTargetLine)
                        }
                    }
                    megaRefresh()
                }
            } catch (e: Exception) {
                post { isIndexing.set(false) }
            }
        }
    }

    fun createEmptyFile(path: String) {
        val cleanPath = path.replace("file://", "")
        val file = File(cleanPath)
        try {
            if (file.exists()) file.delete()
            file.createNewFile()
            loadFile(cleanPath)
        } catch (e: Exception) {
            Log.e("HugeTextView", "Failed to create empty file", e)
        }
    }

    private fun getLineText(index: Int): String {
        val cached = lineCache[index]
        if (cached != null) return cached

        try {
            synchronized(this) {
                val r = raf ?: return ""
                val count = currentLineCount
                if (index < 0 || index >= count) return ""
                
                val lineStart = getLineOffset(index)
                val lineEnd = if (index + 1 < count) getLineOffset(index + 1) else r.length()
                
                val length = (lineEnd - lineStart).toInt()
                if (length <= 0) return ""
                val readLen = Math.min(length, 1024 * 50) // Absolute safety cap for UI
                
                val bytes = ByteArray(readLen)
                r.seek(lineStart)
                r.readFully(bytes)
                
                var actualLen = readLen
                if (actualLen > 0 && bytes[actualLen - 1] == '\n'.code.toByte()) {
                    actualLen--
                    if (actualLen > 0 && bytes[actualLen - 1] == '\r'.code.toByte()) actualLen--
                }
                
                val text = if (actualLen <= 0) "" else String(bytes, 0, actualLen, Charsets.UTF_8)
                
                if (lineCache.size > MAX_CACHE_SIZE) lineCache.clear()
                lineCache[index] = text
                return text
            }
        } catch (e: Exception) { return "" }
    }

    private fun getLineTexts(startIndex: Int, count: Int, r: RandomAccessFile): List<String> {
        val result = mutableListOf<String>()
        try {
            val totalCount = synchronized(this) { currentLineCount }
            if (startIndex < 0 || startIndex >= totalCount) return result
            val actualCount = Math.min(count, totalCount - startIndex)
            
            val startOff = getLineOffset(startIndex, r)
            val endOff = if (startIndex + actualCount < totalCount) getLineOffset(startIndex + actualCount, r) else r.length()
            
            val len = (endOff - startOff).toInt()
            if (len <= 0) return result
            
            r.seek(startOff)
            val buffer = ByteArray(len)
            r.readFully(buffer)
            
            var lineStart = 0
            for (i in 0 until len) {
                if (buffer[i] == '\n'.code.toByte()) {
                    var lineLen = i - lineStart
                    if (lineLen > 0 && buffer[i-1] == '\r'.code.toByte()) lineLen--
                    result.add(if (lineLen <= 0) "" else String(buffer, lineStart, lineLen, Charsets.UTF_8))
                    lineStart = i + 1
                    if (result.size >= actualCount) break
                }
            }
            // Add trailing 
            if (result.size < actualCount && lineStart < len) {
                var lineLen = len - lineStart
                if (lineLen > 0 && buffer[len-1] == '\r'.code.toByte()) lineLen--
                result.add(if (lineLen <= 0) "" else String(buffer, lineStart, lineLen, Charsets.UTF_8))
            }
        } catch (e: Exception) {}
        return result
    }

    private fun decodeLineBytes(bos: java.io.ByteArrayOutputStream): String {
        val bytes = bos.toByteArray()
        var len = bytes.size
        if (len > 0 && bytes[len - 1] == '\r'.code.toByte()) len--
        return try {
            String(bytes, 0, len, Charsets.UTF_8)
        } catch (e: Exception) {
            String(bytes, 0, len, Charsets.ISO_8859_1)
        }
    }

    fun getLinesText(startIndex: Int, count: Int): String {
        try {
            val r = rafSearch ?: return ""
            synchronized(r) {
                val totalCount = synchronized(this) { currentLineCount }
                if (startIndex < 0 || startIndex >= totalCount) {
                    Log.e("HugeTextView", "getLinesText: Invalid start index $startIndex (total: $totalCount)")
                    return ""
                }
                val actualCount = Math.min(count, totalCount - startIndex)
                if (actualCount <= 0) return ""
                
                val startOffset = getLineOffset(startIndex)
                val endOffset = if (startIndex + actualCount < totalCount) {
                    getLineOffset(startIndex + actualCount)
                } else {
                    r.length()
                }
                
                val length = (endOffset - startOffset).toInt()
                if (length <= 0) return ""
                
                // Safety check: Don't try to pull more than 115MB into Sora at once to avoid OOM
                if (length > 115 * 1024 * 1024) {
                    Log.w("HugeTextView", "getLinesText: Selection too large ($length bytes), clipping to 115MB")
                }
                val safeLength = Math.min(length, 115 * 1024 * 1024)
                
                val buffer = ByteArray(safeLength)
                r.seek(startOffset)
                r.readFully(buffer)
                
                val res = String(buffer, Charsets.UTF_8)
                Log.d("HugeTextView", "getLinesText: Pulled $actualCount lines, $safeLength bytes")
                return res
            }
        } catch (e: Exception) { 
            Log.e("HugeTextView", "Error in getLinesText", e)
            return "" 
        }
    }

    fun getSelectedLinesText(): String {
        if (isSwapping.get() || isIndexing.get()) {
            return "Sync in progress..."
        }
        try {
            val limit = 100000 // Increased limit for batch editing
            val indices = mutableListOf<Int>()
            
            // Quickly snapshot the indices to avoid holding selection lock during I/O
            synchronized(selectedLines) {
                var i = selectedLines.nextSetBit(0)
                while (i != -1 && indices.size < limit) {
                    indices.add(i)
                    i = selectedLines.nextSetBit(i + 1)
                }
            }
            
            if (indices.isEmpty()) return ""
            
            val sb = StringBuilder(indices.size * 50) // Estimate 50 chars per line
            for (idx in indices) {
                sb.append(getLineText(idx)).append("\n")
            }
            return sb.toString()
        } catch (e: Exception) {
            return ""
        }
    }
    
    fun getSelectedTextForBridge(): String {
        return getSelectedLinesText()
    }

    fun setSearchState(line: Int, offset: Int, query: String?, matchCase: Boolean) {
        Log.d("HugeTextView", "Restoring search state: line=$line, offset=$offset, query=$query")
        lastSearchLine = line
        lastSearchOffsetInLine = offset
        lastSearchQuery = query
        lastSearchMatchCase = matchCase
        highlightedLine = line
        if (line >= 0) {
            jumpToLine(line, offset)
        }
        post { adapter?.notifyDataSetChanged() }
    }

    fun jumpToLine(line: Int, offsetInLine: Int = -1) {
        val targetRaw = if (line == -2) lastTargetLine else line
        val count = synchronized(this) { currentLineCount }
        
        // Update track-keeping even if we can't jump yet
        if (line != -2) {
            lastTargetLine = line
            lastJumpWasExplicit = (offsetInLine == -1)
            lastJumpWasFromSearch = (offsetInLine != -1)
            lastJumpOffset = offsetInLine
        }
        
        val target = targetRaw.coerceIn(0, (count - 1).coerceAtLeast(0))
        val prevLine = lastTargetLine
        
        val isExplicitJump = lastJumpWasExplicit
        val isSearchJump = lastJumpWasFromSearch
        val searchOffset = if (isSearchJump) (if (offsetInLine == -1) lastJumpOffset else offsetInLine) else -1
        
        val currentToken = System.currentTimeMillis()
        lastScrollToken = currentToken
        
        post {
            if (lastScrollToken != currentToken) return@post
            stopScroll()
            
            if (target >= 0 && target < count) {
                val lm = layoutManager as? LinearLayoutManager ?: return@post
                
                if (isExplicitJump || target < windowStartLine || target >= windowStartLine + windowSize) {
                    windowStartLine = (target - (windowSize / 2)).coerceIn(0, (count - windowSize).coerceAtLeast(0))
                    adapter?.notifyDataSetChanged()
                }

                val adapterPos = (target - windowStartLine).coerceIn(0, windowSize - 1)
                
                fun tryFinalCorrection(retryCount: Int = 0) {
                    if (lastScrollToken != currentToken) return
                    val vh = findViewHolderForAdapterPosition(adapterPos) as? HugeTextAdapter.LineViewHolder
                    val tv = vh?.itemView as? TextView
                    if (tv == null) {
                        if (retryCount < 5) postDelayed({ tryFinalCorrection(retryCount + 1) }, 50)
                        return
                    }
                    val layout = tv.layout ?: run {
                        if (retryCount < 5) postDelayed({ tryFinalCorrection(retryCount + 1) }, 50)
                        return
                    }
                    
                    if (searchOffset >= 0) {
                        val prefixLen = positionLinePrefixLength(target)
                        val charOffset = (searchOffset + prefixLen).coerceIn(0, tv.text.length)
                        val matchLine = layout.getLineForOffset(charOffset)
                        
                        // Vertical Position = Layout Top + Padding
                        val matchY = layout.getLineTop(matchLine) + tv.totalPaddingTop
                        
                        val viewTop = vh.itemView.top
                        val absoluteY = viewTop + matchY
                        
                        // Target position: 1/3 from top of screen
                        val targetY = height / 3
                        
                        Log.d("HugeTextView", "Search centering: matchY=$matchY, viewTop=$viewTop, absoluteY=$absoluteY, targetY=$targetY, isSearchJump=$isSearchJump")
                        
                        // ROCKSOLID: For search results, ALWAYS center at 1/3 height
                        // For non-search jumps, only adjust if outside safety zone
                        if (isSearchJump) {
                            // Calculate how much we need to scroll to center the match
                            val scrollDelta = absoluteY - targetY
                            if (Math.abs(scrollDelta) > 10) { // Only scroll if more than 10px off
                                smoothScrollBy(0, scrollDelta)
                                Log.d("HugeTextView", "Applied search centering scroll delta: $scrollDelta")
                            }
                        } else {
                            // Safety Zone: 15% to 85% for non-search jumps
                            val safetyMarginTop = height * 0.15
                            val safetyMarginBottom = height * 0.85
                            if (absoluteY < safetyMarginTop || absoluteY > safetyMarginBottom || target != prevLine) {
                                val scrollDelta = absoluteY - targetY
                                smoothScrollBy(0, scrollDelta)
                            }
                        }
                    }
                }

                // Initial Jump: Move the item into view immediately
                val vhInitial = findViewHolderForAdapterPosition(adapterPos)
                if (vhInitial == null || target != prevLine) {
                    lm.scrollToPositionWithOffset(adapterPos, height / 3)
                }

                // Secondary Correction: Refine alignment once TextView and Layout are ready
                val observer = viewTreeObserver
                observer.addOnGlobalLayoutListener(object : android.view.ViewTreeObserver.OnGlobalLayoutListener {
                    override fun onGlobalLayout() {
                        if (viewTreeObserver.isAlive) {
                            viewTreeObserver.removeOnGlobalLayoutListener(this)
                            tryFinalCorrection()
                            forceRefreshJiggle()
                        }
                    }
                })
                
                postDelayed({ tryFinalCorrection() }, 100)
            }
        }
    }

    private fun positionLinePrefixLength(position: Int): Int {
        return (position + 1).toString().length + 3 // matching "${position + 1}   "
    }

    fun jumpToTop() = jumpToLine(0)
    fun jumpToBottom() = jumpToLine(synchronized(this) { currentLineCount } - 1)


    fun clearSearch() {
        highlightedLine = -1
        lastSearchQuery = null
        lastSearchOffsetInLine = -1
        post { adapter?.notifyDataSetChanged() }
    }

    fun setSyntaxExtension(ext: String) {
        val clean = ext.lowercase().replace(".", "")
        if (syntaxExtension != clean) {
            syntaxExtension = clean
            post { 
                adapter?.notifyDataSetChanged() 
                requestLayout()
                invalidate()
            }
        }
    }

    fun setSelectedLines(indices: List<Int>) {
        synchronized(selectedLines) {
            selectedLines.clear()
            indices.forEach { selectedLines.set(it) }
        }
        post { 
            adapter?.notifyDataSetChanged() 
            requestLayout()
            invalidate()
            notifySelectionChanged()
        }
    }

    fun find(query: String, matchCase: Boolean, forward: Boolean = true) {
        if (query.isEmpty()) {
            clearSearch()
            return
        }
        if (currentFile == null) return
        
        val taskId = currentTaskId.incrementAndGet()
        isSearching.set(true)
        
        searchExecutor.execute {
            try {
                if (taskId != currentTaskId.get()) return@execute
                
                val totalCount = synchronized(this) { currentLineCount }
                if (totalCount == 0) {
                    mainHandler.post { isSearching.set(false) }
                    return@execute
                }

                // If query changed, start from beginning/end
                val queryChanged = (query != lastSearchQuery || matchCase != lastSearchMatchCase)
                
                // Starting line index
                var startLineIdx = if (queryChanged || lastSearchLine == -1) {
                    if (forward) 0 else totalCount - 1
                } else {
                    lastSearchLine
                }

                // Bounds check
                if (startLineIdx >= totalCount) startLineIdx = totalCount - 1
                if (startLineIdx < 0) startLineIdx = 0

                var foundLine = -1
                var foundOffset = -1
                
                var currentLine = startLineIdx
                var linesScanned = 0
                
                while (linesScanned < totalCount) {
                    if (taskId != currentTaskId.get()) return@execute
                    
                    val text = getLineText(currentLine)
                    val isStartingLine = (!queryChanged && currentLine == lastSearchLine)
                    
                    val matchIdx = if (forward) {
                        // If we are on the starting line of a "find next", skip the current match
                        val from = if (isStartingLine && lastSearchOffsetInLine >= 0) lastSearchOffsetInLine + 1 else 0
                        if (from < text.length) {
                            if (matchCase) text.indexOf(query, from) else text.indexOf(query, from, ignoreCase = true)
                        } else -1
                    } else {
                        // Reverse search
                        val upTo = if (isStartingLine && lastSearchOffsetInLine >= 0) lastSearchOffsetInLine - 1 else text.length - 1
                        if (upTo >= 0) {
                            if (matchCase) text.lastIndexOf(query, upTo) else text.lastIndexOf(query, upTo, ignoreCase = true)
                        } else -1
                    }
                    
                    if (matchIdx != -1) {
                        foundLine = currentLine
                        foundOffset = matchIdx
                        break
                    }
                    
                    // Move to next/prev line with wrap-around
                    if (forward) {
                        currentLine++
                        if (currentLine >= totalCount) currentLine = 0
                    } else {
                        currentLine--
                        if (currentLine < 0) currentLine = totalCount - 1
                    }
                    linesScanned++
                    
                    if (linesScanned % 1000 == 0) {
                        Thread.sleep(1) // Keep UI responsive and allow preemption
                    }
                }
                
                if (taskId != currentTaskId.get()) return@execute
                
                post {
                    if (taskId == currentTaskId.get()) {
                        isSearching.set(false)
                        lastSearchQuery = query
                        lastSearchMatchCase = matchCase
                        
                        if (foundLine != -1) {
                            lastSearchLine = foundLine
                            lastSearchOffsetInLine = foundOffset
                            highlightedLine = foundLine
                            
                            // 🚀 FORCE JUMP: This must override any preservation scroll
                            megaRefresh() 
                            adapter?.notifyDataSetChanged()
                            jumpToLine(foundLine, foundOffset)
                            notifySearchProgressReport(foundLine)
                        } else {
                            // No matches found - toast handled in React if desired or just clear highlights
                            highlightedLine = -1
                            adapter?.notifyDataSetChanged()
                        }
                    }
                }
            } catch (e: Exception) {
                mainHandler.post { isSearching.set(false) }
            }
        }
    }

    private fun notifySearchProgressReport(currentSearchLine: Int) {
        val query = lastSearchQuery ?: return
        val matchCase = lastSearchMatchCase
        val taskId = currentTaskId.get()
        
        countExecutor.execute {
            if (taskId != currentTaskId.get()) return@execute
            
            val totalCount = synchronized(this) { currentLineCount }
            var occurrencesOnLine = 0
            var rankInLine = 0
            
            val lineText = getLineText(currentSearchLine)
            if (query.isNotEmpty() && lineText.isNotEmpty()) {
                val searchText = if (matchCase) lineText else lineText.lowercase()
                val searchQuery = if (matchCase) query else query.lowercase()
                var pos = searchText.indexOf(searchQuery)
                var index = 0
                while (pos != -1) {
                    index++
                    occurrencesOnLine++
                    if (pos == lastSearchOffsetInLine) {
                        rankInLine = index
                    }
                    pos = searchText.indexOf(searchQuery, pos + query.length)
                }
            }
            
            if (taskId != currentTaskId.get()) return@execute
            
            mainHandler.post {
                if (taskId == currentTaskId.get()) {
                    val event = Arguments.createMap()
                    event.putInt("total", occurrencesOnLine) 
                    event.putInt("current", if (rankInLine > 0) rankInLine else 1)
                    event.putInt("line", currentSearchLine)
                    event.putInt("offset", lastSearchOffsetInLine)
                    event.putInt("totalLines", totalCount)
                    (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)
                        ?.receiveEvent(id, "onSearchProgress", event)
                }
            }
        }
    }

    fun requestFullSearchCount(queryOverride: String? = null, matchCaseOverride: Boolean? = null) {
        val query = queryOverride ?: lastSearchQuery 
        if (query.isNullOrEmpty()) {
            mainHandler.post { 
                android.widget.Toast.makeText(context, msgEnterSearchTerm, android.widget.Toast.LENGTH_SHORT).show()
            }
            return
        }
        
        mainHandler.post {
            android.widget.Toast.makeText(context, msgAnalyzing, android.widget.Toast.LENGTH_LONG).show()
        }

        val matchCase = matchCaseOverride ?: lastSearchMatchCase
        val currentSearchLine = lastSearchLine
        val currentOffset = lastSearchOffsetInLine
        val taskId = currentTaskId.get()
        val file = currentFile ?: return

        searchExecutor.execute {
            if (taskId != currentTaskId.get()) return@execute
            
            var totalMatchesInFile = 0
            var matchesInCurrentLine = 0
            var rankInCurrentLine = 0
            
            try {
                // 1. Count in current line (if valid)
                val lineTotal = synchronized(this) { currentLineCount }
                if (currentSearchLine in 0 until lineTotal) {
                    val lineText = getLineText(currentSearchLine)
                    if (lineText.isNotEmpty()) {
                        val searchText = if (matchCase) lineText else lineText.lowercase()
                        val searchQuery = if (matchCase) query else query.lowercase()
                        var pos = searchText.indexOf(searchQuery)
                        var indexInLine = 0
                        while (pos != -1) {
                            indexInLine++
                            matchesInCurrentLine++
                            if (pos == currentOffset) {
                                rankInCurrentLine = indexInLine
                            }
                            pos = searchText.indexOf(searchQuery, pos + query.length)
                        }
                    }
                }

                // 2. Count in whole file (Background task)
                val fis = java.io.FileInputStream(file)
                val inChannel = fis.channel
                val bufferSize = 1024 * 1024 // 1MB buffer for faster disk I/O
                val buffer = java.nio.ByteBuffer.allocateDirect(bufferSize)
                val queryBytes = query.toByteArray(Charsets.UTF_8)
                val qLen = queryBytes.size
                
                if (qLen == 0) { fis.close(); return@execute }

                val head = queryBytes[0]
                val headL = if (!matchCase && head in 'A'.code.toByte()..'Z'.code.toByte()) (head + 32).toByte() else head
                val headU = if (!matchCase && head in 'a'.code.toByte()..'z'.code.toByte()) (head - 32).toByte() else head

                var bytesRead = inChannel.read(buffer)
                var currentGlobalOffset = 0L
                val targetOffsetStart = if (currentSearchLine >= 0) getLineOffset(currentSearchLine) + currentOffset else -2L
                var globalRankOfCurrent = -1
                
                while (bytesRead != -1 || buffer.position() > 0) {
                    if (taskId != currentTaskId.get()) break
                    buffer.flip()
                    val limit = buffer.limit()
                    var i = 0
                    
                    if (limit < qLen && bytesRead == -1) {
                        // EOF reached and remaining buffer is too small to contain query
                        i = limit
                    } else {
                        while (i <= limit - qLen) {
                            val b = buffer.get(i)
                            val potential = if (matchCase) {
                                b == head
                            } else {
                                if (head in 'a'.code.toByte()..'z'.code.toByte() || head in 'A'.code.toByte()..'Z'.code.toByte()) {
                                    b == headL || b == headU
                                } else {
                                    b == head
                                }
                            }

                            if (potential) {
                                var match = true
                                for (j in 1 until qLen) {
                                    val bIn = buffer.get(i + j)
                                    val bPat = queryBytes[j]
                                    if (matchCase) {
                                        if (bIn != bPat) { match = false; break }
                                    } else {
                                        val bInNorm = if (bIn in 'A'.code.toByte()..'Z'.code.toByte()) (bIn + 32).toByte() else bIn
                                        val bPatNorm = if (bPat in 'A'.code.toByte()..'Z'.code.toByte()) (bPat + 32).toByte() else bPat
                                        if (bInNorm != bPatNorm) { match = false; break }
                                    }
                                }
                                if (match) {
                                    totalMatchesInFile++
                                    if (targetOffsetStart >= 0 && currentGlobalOffset + i <= targetOffsetStart) {
                                        globalRankOfCurrent = totalMatchesInFile
                                    }
                                    i += qLen
                                    continue
                                }
                            }
                            i++
                        }
                    }
                    
                    currentGlobalOffset += i
                    buffer.position(i)
                    buffer.compact()
                    bytesRead = try { inChannel.read(buffer) } catch (e: Exception) { -1 }
                }
                
                inChannel.close()
                fis.close()

                Log.d("HugeTextView", "Search Results: $totalMatchesInFile found for \"$query\"")

                if (taskId == currentTaskId.get()) {
                    mainHandler.post {
                        if (totalMatchesInFile == 0) {
                            android.widget.Toast.makeText(context, "No results found for \"$query\"", android.widget.Toast.LENGTH_SHORT).show()
                            return@post
                        }
                        
                        val event = Arguments.createMap()
                        event.putInt("totalMatchesInFile", totalMatchesInFile)
                        event.putInt("globalRank", if (globalRankOfCurrent > 0) globalRankOfCurrent else (if (totalMatchesInFile > 0) 1 else 0))
                        event.putInt("matchesInLine", matchesInCurrentLine)
                        event.putInt("rankInLine", rankInCurrentLine)
                        event.putInt("totalLines", synchronized(this@HugeTextView) { currentLineCount })
                        event.putString("query", query)
                        event.putBoolean("isFullReport", true)
                        // Compatibility fields
                        event.putInt("total", matchesInCurrentLine)
                        event.putInt("current", if (rankInCurrentLine > 0) rankInCurrentLine else 1)
                        event.putInt("line", currentSearchLine)

                        (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)
                            ?.receiveEvent(id, "onSearchProgress", event)
                    }
                }
            } catch (e: Exception) {
                Log.e("HugeTextView", "Error counting search results", e)
                mainHandler.post {
                    android.widget.Toast.makeText(context, "Search Analysis failed: ${e.message}", android.widget.Toast.LENGTH_SHORT).show()
                }
            }
        }
    }



    fun jumpToOccurrence(line: Int, occurrenceIndex: Int, query: String, matchCase: Boolean) {
        if (line < 0 || line >= synchronized(this) { currentLineCount }) {
             mainHandler.post { android.widget.Toast.makeText(context, "Invalid line number", android.widget.Toast.LENGTH_SHORT).show() }
             return
        }
        
        taskExecutor.execute {
            val text = getLineText(line)
            if (text.isEmpty()) {
                val event = Arguments.createMap()
                event.putBoolean("success", false)
                event.putBoolean("isEmpty", true)
                event.putInt("line", line)
                event.putInt("occurrenceIndex", occurrenceIndex)
                event.putInt("totalLineMatches", 0)
                
                mainHandler.post {
                    (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)
                        ?.receiveEvent(id, "onJumpResult", event)
                    android.widget.Toast.makeText(context, "Line ${line + 1} is empty", android.widget.Toast.LENGTH_SHORT).show()
                }
                return@execute
            }

            val searchText = if (matchCase) text else text.lowercase()
            val searchQuery = if (matchCase) query else query.lowercase()
            
            var pos = searchText.indexOf(searchQuery)
            var count = 0
            var foundPos = -1
            
            while (pos != -1) {
                count++
                if (count == occurrenceIndex) {
                    foundPos = pos
                    break
                }
                pos = searchText.indexOf(searchQuery, pos + searchQuery.length)
            }

            val totalLineMatches = count
            val event = Arguments.createMap()
            event.putBoolean("success", foundPos != -1)
            event.putInt("line", line)
            event.putInt("occurrenceIndex", occurrenceIndex)
            event.putInt("totalLineMatches", totalLineMatches)
            
            mainHandler.post {
                (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)
                    ?.receiveEvent(id, "onJumpResult", event)
            }

            if (foundPos != -1) {
                mainHandler.post {
                    lastSearchQuery = query
                    lastSearchMatchCase = matchCase
                    lastSearchLine = line
                    lastSearchOffsetInLine = foundPos
                    highlightedLine = line
                    
                    lastJumpWasFromSearch = true
                    lastTargetLine = line
                    lastJumpOffset = foundPos
                    
                    jumpToLine(line)
                    adapter?.notifyDataSetChanged()
                    
                    // Trigger a result report to update the UI
                    requestFullSearchCount(query, matchCase)
                    android.widget.Toast.makeText(context, "Jumped to match #$occurrenceIndex on line ${line + 1}", android.widget.Toast.LENGTH_SHORT).show()
                }
            } else {
                mainHandler.post {
                    android.widget.Toast.makeText(context, "Match #$occurrenceIndex not found. (Line ${line + 1} has $totalLineMatches matches)", android.widget.Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    fun replaceAll(query: String, replacement: String, matchCase: Boolean, applyLimit: Boolean = false) {
        if (query.isEmpty()) return
        val file = currentFile ?: return
        if (isSwapping.get()) return

        taskExecutor.execute {
            try {
                isSwapping.set(true)
                val MAX_LIMIT = if (applyLimit) 50000 else Int.MAX_VALUE
                
                val tempFile = File(file.parent, file.name + ".replace.tmp")
                
                // Storage Check
                val stat = android.os.StatFs(file.parent)
                val availableSpace = stat.availableBlocksLong * stat.blockSizeLong
                if (availableSpace < file.length()) {
                     mainHandler.post {
                        isSwapping.set(false)
                        val event = Arguments.createMap()
                        event.putString("status", "error")
                        event.putString("detail", "Insufficient storage! Replace-All requires free space equal to the file size.")
                        (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(id, "onReplaceEnd", event)
                     }
                     return@execute
                }

                var totalReplaced = 0
                val queryBytes = query.toByteArray(Charsets.UTF_8)
                val replacementBytes = replacement.toByteArray(Charsets.UTF_8)
                val qLen = queryBytes.size
                
                // Nuclear Engine: Raw Byte Stream Processing
                // 1. Large Buffers to maximize IO throughput
                // 2. No line-by-line String reification (saves GBs of allocations)
                // 3. One-pass search for both Pattern and EOL
                
                val inChannel = file.inputStream().channel
                val outChannel = tempFile.outputStream().channel
                
                val inBuf = java.nio.ByteBuffer.allocateDirect(1024 * 1024 * 2) // 2MB Input
                val outBuf = java.nio.ByteBuffer.allocateDirect(1024 * 1024 * 4) // 4MB Output
                
                var bytesRead = inChannel.read(inBuf)
                var currentLineLen = 0
                val searchHead = queryBytes[0]
                val searchHeadL = if (!matchCase) Character.toLowerCase(searchHead.toInt().toChar()).code.toByte() else searchHead
                val searchHeadU = if (!matchCase) Character.toUpperCase(searchHead.toInt().toChar()).code.toByte() else searchHead

                while (bytesRead != -1 || inBuf.position() > 0) {
                    inBuf.flip()
                    val limit = inBuf.limit()
                    
                    var i = 0
                    while (i < limit) {
                        // Pattern split check
                        if (i + qLen > limit && bytesRead != -1) {
                            break // Refill to get whole pattern
                        }

                        val b = inBuf.get(i)
                        val isEol = b == '\n'.code.toByte()
                        val isPatternPotential = (b == searchHead || (!matchCase && b == searchHeadU) || (!matchCase && b == searchHeadL))
                        
                        if (currentLineLen >= MAX_LINE_BYTES && !isEol) {
                            if (outBuf.remaining() < 1) { outBuf.flip(); outChannel.write(outBuf); outBuf.clear() }
                            outBuf.put('\n'.code.toByte())
                            currentLineLen = 0
                        }

                        if (isEol) {
                            if (outBuf.remaining() < 1) { outBuf.flip(); outChannel.write(outBuf); outBuf.clear() }
                            outBuf.put('\n'.code.toByte())
                            currentLineLen = 0
                            i++
                            continue
                        }

                        if (isPatternPotential && totalReplaced < MAX_LIMIT) {
                            var match = true
                            if (i + qLen > limit) {
                                match = false 
                            } else {
                                for (j in 1 until qLen) {
                                    val bIn = inBuf.get(i + j)
                                    val bPat = queryBytes[j]
                                    if (matchCase) {
                                        if (bIn != bPat) { match = false; break }
                                    } else {
                                        if (Character.toLowerCase(bIn.toInt().toChar()) != Character.toLowerCase(bPat.toInt().toChar())) {
                                            match = false; break
                                        }
                                    }
                                }
                            }

                            if (match) {
                                if (outBuf.remaining() < replacementBytes.size) { outBuf.flip(); outChannel.write(outBuf); outBuf.clear() }
                                outBuf.put(replacementBytes)
                                totalReplaced++
                                currentLineLen += replacementBytes.size
                                i += qLen
                                continue
                            }
                        }

                        if (outBuf.remaining() < 1) { outBuf.flip(); outChannel.write(outBuf); outBuf.clear() }
                        outBuf.put(b)
                        currentLineLen++
                        i++
                    }
                    
                    inBuf.position(i)
                    inBuf.compact()
                    bytesRead = inChannel.read(inBuf)
                }

                outBuf.flip()
                outChannel.write(outBuf)
                
                inChannel.close()
                outChannel.close()
                
                synchronized(this@HugeTextView) {
                    try { raf?.close() } catch (e: Exception) {}
                    try { rafSearch?.close() } catch (e: Exception) {}
                    raf = null
                    rafSearch = null
                    
                    if (!tempFile.renameTo(file)) {
                        if (file.delete()) {
                            tempFile.renameTo(file)
                        }
                    }
                }
                
                mainHandler.post {
                    val lm = layoutManager as? LinearLayoutManager
                    val pos = lm?.findFirstVisibleItemPosition() ?: -1
                    loadFile(file.absolutePath, pos)
                    isSwapping.set(false)
                    val event = Arguments.createMap()
                    event.putString("status", "success")
                    event.putInt("processedCount", totalReplaced)
                    (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(id, "onReplaceEnd", event)
                }
                
            } catch (e: Exception) {
                Log.e("HugeTextView", "Critical replaceAll error", e)
                isSwapping.set(false)
                mainHandler.post {
                     val event = Arguments.createMap()
                     event.putString("status", "error")
                     event.putString("detail", e.message ?: "Unknown error")
                     (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(id, "onReplaceEnd", event)
                }
            }
        }
    }

    fun reloadFile() {
        val path = currentFile?.absolutePath ?: return
        
        post {
            // 1. VIOLENT RESET - Wipe everything
            highlightedLine = -1
            lastSearchQuery = null
            lastSearchOffsetInLine = -1
            synchronized(selectedLines) { selectedLines.clear() }
            selectionModeActive = false
            
            lastTargetLine = -1
            lastJumpWasExplicit = false
            lastJumpWasFromSearch = false
            lastJumpOffset = -1
            
            // Reset Font Size
            fontSize = 14f
            
            // Cancel any pending background work
            currentTaskId.incrementAndGet()
            isSearching.set(false)
            isIndexing.set(false)
            
            // Internal Index & Cache wipe
            synchronized(this@HugeTextView) {
                currentLineCount = 0
                sparseIndex = LongArray(1000)
                lineCache.clear()
            }
            
            // UI Update
            adapter?.notifyDataSetChanged()
            stopScroll()
            jumpToLine(0)
            notifySelectionChanged()
            
            // Notify bridge for the "Tabs/UI Cleanup"
            try {
                val event = Arguments.createMap()
                event.putBoolean("reset", true)
                (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)
                    ?.receiveEvent(id, "onHardReset", event)
            } catch (e: Exception) {}

            // 2. Perform fresh load
            loadFile(path, -1)
        }
    }

    private fun indexOfByteArray(data: ByteArray, pattern: ByteArray, ignoreCase: Boolean): Int {
        if (pattern.isEmpty()) return 0
        val n = data.size
        val m = pattern.size
        if (n < m) return -1
        
        for (i in 0..n - m) {
            var found = true
            for (j in 0 until m) {
                val b1 = data[i + j]
                val b2 = pattern[j]
                if (ignoreCase) {
                    if (Character.toLowerCase(b1.toInt().toChar()) != Character.toLowerCase(b2.toInt().toChar())) {
                        found = false
                        break
                    }
                } else {
                    if (b1 != b2) {
                        found = false
                        break
                    }
                }
            }
            if (found) return i
        }
        return -1
    }

    fun replace(replacement: String) {
        val query = lastSearchQuery ?: return
        val lineIdx = highlightedLine
        val offset = lastSearchOffsetInLine
        if (lineIdx < 0 || offset < 0) return

        val originalLine = getLineText(lineIdx)
        val matchCase = lastSearchMatchCase
        
        // Find if the match is actually at that offset
        val foundOffset = if (matchCase) {
             originalLine.indexOf(query, offset)
        } else {
             originalLine.indexOf(query, offset, ignoreCase = true)
        }
        
        if (foundOffset == offset) {
            val sb = StringBuilder()
            sb.append(originalLine.substring(0, offset))
            sb.append(replacement)
            sb.append(originalLine.substring(offset + query.length))
            val newLine = sb.toString()
            
            // Flag that we want to find the next occurrence after the file reloads
            pendingFindNextAfterLoad = true
            
            replaceLine(lineIdx, newLine)
        }
    }

    fun replaceSelectedSpecificLines(newLines: List<String>) {
        val indices = getSelectedIndices()
        
        if (indices.isEmpty()) {
            val count = synchronized(this) { currentLineCount }
            if (count == 0) {
                // SPECIAL CASE: Empty file, treat as inserting at the beginning (index 0)
                val replacements = mutableMapOf<Int, List<String>>()
                replacements[0] = newLines
                replaceBatchIndices(replacements)
                return
            } else {
                // If the file is NOT empty but we have no selection, it might be a malformed request.
                // At minimum, we MUST signal success to the bridge so the UI doesn't hang forever.
                mainHandler.post {
                    val event = Arguments.createMap()
                    event.putString("status", "success")
                    event.putString("detail", "No selection found; nothing to replace.")
                    (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)
                        ?.receiveEvent(id, "onSaveComplete", event)
                }
                return
            }
        }
        
        // Distribution Logic:
        // We map editor lines back to selected indices.
        // If the number of lines matches exactly, it's 1:1.
        // If the editor has more lines, we append the extras to the last selected line's group.
        // If it has fewer, the remaining selected lines are cleared (deleted).
        val replacements = mutableMapOf<Int, List<String>>()
        if (newLines.size >= indices.size) {
            for (i in 0 until indices.size - 1) {
                replacements[indices[i]] = listOf(newLines[i])
            }
            // All remaining editor lines go to the last selected index
            replacements[indices.last()] = newLines.subList(indices.size - 1, newLines.size)
        } else {
            for (i in newLines.indices) {
                replacements[indices[i]] = listOf(newLines[i])
            }
            for (i in newLines.size until indices.size) {
                // These lines were removed in the editor
                replacements[indices[i]] = emptyList()
            }
        }
        
        replaceBatchIndices(replacements)
    }

    private fun replaceBatchIndices(replacements: Map<Int, List<String>>) {
        if (isSwapping.get()) return
        val file = currentFile ?: return
        val sortedIndices = replacements.keys.sorted()
        
        taskExecutor.execute {
            try {
                isSwapping.set(true)
                val tempFile = java.io.File(file.parent, file.name + ".tmp")
                val src = java.io.RandomAccessFile(file, "r")
                val dst = java.io.RandomAccessFile(tempFile, "rw")
                
                val srcChannel = src.channel
                val dstChannel = dst.channel
                var currentPos = 0L
                
                var i = 0
                while (i < sortedIndices.size) {
                    val blockStartLine = sortedIndices[i]
                    var blockEndLine = blockStartLine
                    
                    // Group contiguous indices into a single block
                    val startIndexInList = i
                    while (i + 1 < sortedIndices.size && sortedIndices[i + 1] == sortedIndices[i] + 1) {
                        i++
                        blockEndLine = sortedIndices[i]
                    }
                    
                    val lineStartOffset = getLineOffset(blockStartLine, src)
                    
                    // 1. Zero-copy transfer up to the start of this block
                    val bytesToCopy = lineStartOffset - currentPos
                    if (bytesToCopy > 0) {
                        srcChannel.transferTo(currentPos, bytesToCopy, dstChannel)
                    }
                    
                    // 2. Write ALL replacement lines for this whole block
                    for (j in startIndexInList..i) {
                        val replacementLines = replacements[sortedIndices[j]] ?: emptyList()
                        for (newLine in replacementLines) {
                            dst.write((newLine + "\n").toByteArray(Charsets.UTF_8))
                        }
                    }
                    
                    // 3. Skip the entire block of old lines in the source file
                    val blockEndOffset = getLineOffset(blockEndLine + 1, src)
                    currentPos = blockEndOffset
                    src.seek(currentPos)
                    dstChannel.position(dst.length()) 
                    
                    i++
                }
                
                // 4. Zero-copy transfer the remainder
                val remainder = src.length() - currentPos
                if (remainder > 0) {
                    srcChannel.transferTo(currentPos, remainder, dstChannel)
                }
                
                src.close()
                dst.close()
                
                synchronized(this@HugeTextView) {
                    try { raf?.close() } catch (e: Exception) {}
                    try { rafSearch?.close() } catch (e: Exception) {}
                    raf = null
                    rafSearch = null
                    
                    if (!tempFile.renameTo(file)) {
                        if (file.delete()) {
                            tempFile.renameTo(file)
                        }
                    }
                }
                
                android.os.Handler(android.os.Looper.getMainLooper()).post {
                    val lm = layoutManager as? androidx.recyclerview.widget.LinearLayoutManager
                    val pos = lm?.findFirstVisibleItemPosition() ?: -1
                    loadFile(file.absolutePath, pos)
                    isSwapping.set(false)
                    val event = com.facebook.react.bridge.Arguments.createMap()
                    event.putString("status", "success")
                    (context as? com.facebook.react.bridge.ReactContext)?.getJSModule(com.facebook.react.uimanager.events.RCTEventEmitter::class.java)
                        ?.receiveEvent(id, "onSaveComplete", event)
                }
                
            } catch (e: Exception) {
                Log.e("HugeTextView", "Critical error in batch replace", e)
                isSwapping.set(false)
                android.os.Handler(android.os.Looper.getMainLooper()).post {
                    val event = com.facebook.react.bridge.Arguments.createMap()
                    event.putString("status", "error")
                    event.putString("detail", e.message ?: "Unknown error in batch replace")
                    (context as? com.facebook.react.bridge.ReactContext)?.getJSModule(com.facebook.react.uimanager.events.RCTEventEmitter::class.java)
                        ?.receiveEvent(id, "onSaveComplete", event)
                }
            }
        }
    }

    fun replaceLines(startIndex: Int, lineCount: Int, newLines: List<String>) {
        if (isSwapping.get()) return
        val file = currentFile ?: return
        
        taskExecutor.execute {
            try {
                isSwapping.set(true)
                val tempFile = File(file.parent, file.name + ".tmp")
                val src = RandomAccessFile(file, "r")
                val dst = RandomAccessFile(tempFile, "rw")
                
                val startSparseIdx = startIndex / SPARSE_STEP
                src.seek(sparseIndex[startSparseIdx])
                
                // Scan to exact start line
                val linesToSkip = startIndex - (startSparseIdx * SPARSE_STEP)
                for (i in 0 until linesToSkip) {
                    src.readLine()
                }
                val startOffset = src.filePointer
                
                // 🚀 Zero-copy prefix
                val srcChannel = src.channel
                val dstChannel = dst.channel
                srcChannel.transferTo(0, startOffset, dstChannel)
                dstChannel.position(startOffset) // Ensure alignment
                
                for (line in newLines) {
                    dst.write((line + "\n").toByteArray(Charsets.UTF_8))
                }
                
                src.seek(startOffset)
                for (i in 0 until lineCount) {
                    src.readLine()
                }
                
                val endOffset = src.filePointer
                dstChannel.position(dst.length()) // Sync with RAF writes
                val remainder = src.length() - endOffset
                if (remainder > 0) {
                    srcChannel.transferTo(endOffset, remainder, dstChannel)
                }
                
                src.close()
                dst.close()
                
                synchronized(this) {
                    try { raf?.close() } catch (e: Exception) {}
                    try { rafSearch?.close() } catch (e: Exception) {}
                    raf = null
                    rafSearch = null
                    
                    if (!tempFile.renameTo(file)) {
                        if (file.delete()) {
                            tempFile.renameTo(file)
                        }
                    }
                }
                
                mainHandler.post {
                    val lm = layoutManager as? LinearLayoutManager
                    val pos = lm?.findFirstVisibleItemPosition() ?: -1
                    loadFile(file.absolutePath, pos)
                    isSwapping.set(false)
                    val event = Arguments.createMap()
                    event.putString("status", "success")
                    event.putInt("startIndex", startIndex)
                    (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(id, "onSaveComplete", event)
                }
                
            } catch (e: Exception) {
                isSwapping.set(false)
            }
        }
    }

    fun replaceLine(index: Int, text: String) = replaceLines(index, 1, listOf(text))

    fun syncFile() {
        taskExecutor.execute {
            synchronized(this) {
                try {
                    raf?.getFD()?.sync()
                    val event = Arguments.createMap()
                    event.putString("status", "success")
                    (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(id, "onSaveComplete", event)
                } catch (e: Exception) {}
            }
        }
    }

    fun saveToUri(uriString: String) {
        val srcFile = currentFile ?: return
        val uri = android.net.Uri.parse(uriString)
        taskExecutor.execute {
            try {
                context.contentResolver.openOutputStream(uri)?.use { output ->
                    srcFile.inputStream().use { input ->
                        input.copyTo(output)
                    }
                }
                val event = Arguments.createMap()
                event.putString("mode", "uri")
                event.putString("status", "success")
                event.putString("detail", uriString)
                (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)?.receiveEvent(id, "onSaveComplete", event)
            } catch (e: Exception) {}
        }
    }

    fun reverseSearch(query: String, matchCase: Boolean) = find(query, matchCase, false)
    fun reverseSearchFromBottom(query: String, matchCase: Boolean) = find(query, matchCase, false)

    inner class HugeTextAdapter : RecyclerView.Adapter<HugeTextAdapter.LineViewHolder>() {
        private var selectableResId = 0

        init {
            val out = android.util.TypedValue()
            context.theme.resolveAttribute(android.R.attr.selectableItemBackground, out, true)
            selectableResId = out.resourceId
        }

        override fun getItemCount(): Int {
            val count = synchronized(this@HugeTextView) { currentLineCount }
            if (count <= 0) return 0
            return (count - windowStartLine).coerceIn(0, windowSize)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): LineViewHolder {
            val tv = TextView(context).apply {
                layoutParams = RecyclerView.LayoutParams(-1, -2)
                setPadding(32, 12, 32, 12)
                typeface = Typeface.MONOSPACE
                setBackgroundResource(selectableResId)
                
                // Force Word Wrap and Fast Layout for massive virtual lines
                setHorizontallyScrolling(false)
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    breakStrategy = android.text.Layout.BREAK_STRATEGY_SIMPLE
                    hyphenationFrequency = android.text.Layout.HYPHENATION_FREQUENCY_NONE
                }
            }
            return LineViewHolder(tv)
        }

        override fun onBindViewHolder(holder: LineViewHolder, position: Int) {
            holder.bind(windowStartLine + position)
        }

        inner class LineViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
            private val tv = itemView as TextView
            fun bind(position: Int) {
                tv.textSize = fontSize
                tv.setBackgroundColor(Color.TRANSPARENT)
                val lineText = getLineText(position)
                val isSelected = selectionModeActive && position >= 0 && synchronized(selectedLines) { selectedLines.get(position) }
                
                if (isSelected) {
                    val fillAlpha = (0x1A shl 24) or (selectionThemeColor and 0x00FFFFFF)
                    tv.setBackgroundColor(fillAlpha)
                } else {
                    tv.setBackgroundColor(Color.TRANSPARENT)
                }

                // Set text color (Consistent with theme)
                tv.setTextColor(textThemeColor)
                
                // Update highlight color (handles and text selection background)
                // Use higher opacity (0xCC) version of selection color for the active handle/box
                val highlightAlpha = (0xCC shl 24) or (selectionThemeColor and 0x00FFFFFF)
                tv.highlightColor = highlightAlpha
                
                val prefix = "${position + 1}   "
                val fullText = prefix + lineText
                
                if (position == highlightedLine && lastSearchQuery != null) {
                    val ss = SpannableString(fullText)
                    ss.setSpan(BackgroundColorSpan(Color.parseColor("#FFF9C4")), 0, fullText.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    ss.setSpan(ForegroundColorSpan(Color.BLACK), 0, fullText.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    val q = lastSearchQuery!!
                    val matchStart = prefix.length + lastSearchOffsetInLine
                    val matchEnd = (matchStart + q.length).coerceAtMost(fullText.length)
                    if (matchStart >= 0 && matchStart < fullText.length && matchEnd > matchStart) {
                        // ROCKSOLID MATCH: Vibrant orange background with black text for maximum contrast
                        ss.setSpan(BackgroundColorSpan(Color.parseColor("#FF9800")), matchStart, matchEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                        ss.setSpan(ForegroundColorSpan(Color.BLACK), matchStart, matchEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    }
                    tv.text = ss
                } else {
                    val ss = SpannableString(fullText)
                    ss.setSpan(ForegroundColorSpan(lineNumberThemeColor), 0, prefix.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    tv.text = ss
                }
                
                tv.setOnClickListener {
                    val isAnySelected = synchronized(selectedLines) { !selectedLines.isEmpty }
                    if (isAnySelected || selectionModeActive) {
                        synchronized(selectedLines) {
                            if (selectedLines.get(position)) {
                                selectedLines.clear(position)
                            } else {
                                if (selectedLines.cardinality() >= 1000000) {
                                    post { android.widget.Toast.makeText(context, msgMaxSelectionLimit, android.widget.Toast.LENGTH_SHORT).show() }
                                    return@synchronized
                                }
                                selectedLines.set(position)
                            }
                        }
                        megaRefresh()
                    } else {
                        val event = Arguments.createMap()
                        event.putInt("index", position)
                        event.putString("item", lineText)
                        (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)
                            ?.receiveEvent(id, "onLineClicked", event)
                    }
                }

                // Disable Long Click Selection
                tv.setOnLongClickListener(null)
            }
        }
    }

    // Unified notification is now at the top for visibility and internal access

    fun getSelectedRange(): Pair<Int, Int>? {
        val totalCount = synchronized(this) { currentLineCount }
        if (totalCount <= 0) return null
        
        val first = synchronized(selectedLines) { selectedLines.nextSetBit(0) }
        if (first == -1) return null
        
        val last = synchronized(selectedLines) { selectedLines.previousSetBit(totalCount) }
        if (last == -1) return null
        
        return Pair(first, last - first + 1)
    }
    
    fun getSelectedIndices(): IntArray {
        val list = mutableListOf<Int>()
        synchronized(selectedLines) {
            var i = selectedLines.nextSetBit(0)
            while (i != -1) {
                list.add(i)
                i = selectedLines.nextSetBit(i + 1)
            }
        }
        return list.toIntArray()
    }

    fun selectAllLines() {
        val count = synchronized(this) { currentLineCount }
        if (count <= 0) return
        
        synchronized(selectedLines) {
            selectedLines.clear()
            if (count > 1000000) {
                selectedLines.set(0, 1000000)
                post { android.widget.Toast.makeText(context, msgMaxSelectionLimit, android.widget.Toast.LENGTH_LONG).show() }
            } else {
                selectedLines.set(0, count)
            }
        }
        megaRefresh()
        notifySelectionChanged()
    }

    fun selectLineRange(startIdx: Int, endIdx: Int) {
        val total = synchronized(this) { currentLineCount }
        val start = Math.max(0, startIdx)
        val end = Math.min(total - 1, endIdx)
        if (start > end) return
        
        val requestedCount = end - start + 1
        if (requestedCount > 1000000) {
            post { android.widget.Toast.makeText(context, msgMaxSelectionLimit, android.widget.Toast.LENGTH_LONG).show() }
            return
        }

        synchronized(selectedLines) {
            selectedLines.set(start, end + 1)
        }
        megaRefresh()
        notifySelectionChanged()
    }

    fun clearSelection() {
        synchronized(selectedLines) {
            selectedLines.clear()
        }
        megaRefresh()
        notifySelectionChanged()
    }

    fun finishSearch() {
        val lineToKeep = lastSearchLine
        clearSearch()
        if (lineToKeep >= 0) jumpToLine(lineToKeep)
    }

    fun jumpToLastSearchMatch() {
        if (lastSearchLine >= 0) {
             jumpToLine(lastSearchLine, lastSearchOffsetInLine)
        }
    }

    fun copySelectionToClipboard() {
        Executors.newSingleThreadExecutor().execute {
            try {
                val text = getSelectedLinesText()
                if (text.isEmpty()) {
                    post { android.widget.Toast.makeText(context, msgNothingSelected, android.widget.Toast.LENGTH_SHORT).show() }
                    return@execute
                }
                
                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                val clip = android.content.ClipData.newPlainText("TorqueNote Selection", text)
                clipboard.setPrimaryClip(clip)
                
                val count = synchronized(selectedLines) { selectedLines.cardinality() }
                post { 
                    val msg = msgCopiedLines.replace("{{count}}", count.toString())
                    android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show() 
                }
            } catch (e: Exception) {
                Log.e("HugeTextView", "Copy failed", e)
                post { 
                    val msg = msgCopyFailed.replace("{{message}}", e.message ?: "Unknown error")
                    android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show() 
                }
            }
        }
    }

    private fun selectItemsInRect() {
        try {
            Log.d("HugeTextView", "selectItemsInRect: START")
            val start = selectionRectStart
            val end = selectionRectEnd
            
            // Defensive copy of coordinates to avoid race conditions with drawing thread
            val l = Math.min(start.x, end.x)
            val r = Math.max(start.x, end.x)
            val t = Math.min(start.y, end.y)
            val b = Math.max(start.y, end.y)
            
            Log.d("HugeTextView", "selectItemsInRect: Rect bounds l=$l r=$r t=$t b=$b")
            
            val buffer = 20f
            val rect = android.graphics.RectF(l - buffer, t - buffer, r + buffer, b + buffer)
            var changed = false
            
            var minPos = Int.MAX_VALUE
            var maxPos = Int.MIN_VALUE
            
            try {
                synchronized(selectedLines) {
                    val totalLines = currentLineCount
                    Log.d("HugeTextView", "selectItemsInRect: totalLines=$totalLines")
                    if (totalLines <= 0) {
                        Log.d("HugeTextView", "selectItemsInRect: No lines, returning")
                        return
                    }
                    
                    val count = childCount
                    Log.d("HugeTextView", "selectItemsInRect: childCount=$count")
                    
                    for (i in 0 until count) {
                        try {
                            // Defensive null check for child views during rapid recycling
                            val child = getChildAt(i)
                            if (child == null) {
                                Log.d("HugeTextView", "selectItemsInRect: child[$i] is null, skipping")
                                continue
                            }
                            
                            val holder = getChildViewHolder(child) as? HugeTextAdapter.LineViewHolder
                            if (holder == null) {
                                Log.d("HugeTextView", "selectItemsInRect: holder[$i] is null, skipping")
                                continue
                            }
                            
                            // 🚀 RESILIENCE FIX: Use getChildLayoutPosition instead of bindingAdapterPosition
                            // This ensures the position is found even if the adapter is currently rebinding (due to notifyDataSetChanged)
                            val adapterPos = getChildLayoutPosition(child)
                            if (adapterPos == RecyclerView.NO_POSITION) {
                                Log.d("HugeTextView", "selectItemsInRect: adapterPos[$i] is still NO_POSITION, skipping")
                                continue
                            }
                            
                            val itemRect = android.graphics.RectF(
                                child.left.toFloat(), child.top.toFloat(),
                                child.right.toFloat(), child.bottom.toFloat()
                            )
                            
                            if (android.graphics.RectF.intersects(rect, itemRect)) {
                                val pos = windowStartLine + adapterPos
                                Log.d("HugeTextView", "selectItemsInRect: Intersection found at pos=$pos (windowStart=$windowStartLine, adapterPos=$adapterPos)")
                                
                                if (pos >= 0 && pos < totalLines) {
                                    if (!selectedLines.get(pos)) {
                                        val currentCardinality = selectedLines.cardinality()
                                        Log.d("HugeTextView", "selectItemsInRect: Current cardinality=$currentCardinality")
                                        
                                        if (currentCardinality < 1000000) {
                                            selectedLines.set(pos)
                                            minPos = Math.min(minPos, adapterPos)
                                            maxPos = Math.max(maxPos, adapterPos)
                                            changed = true
                                            Log.d("HugeTextView", "selectItemsInRect: Selected line $pos")
                                        } else {
                                            Log.w("HugeTextView", "selectItemsInRect: Max selection reached")
                                        }
                                    }
                                } else {
                                    Log.w("HugeTextView", "selectItemsInRect: pos=$pos out of bounds [0, $totalLines)")
                                }
                            }
                        } catch (e: Exception) {
                            Log.e("HugeTextView", "selectItemsInRect: Error processing child $i", e)
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("HugeTextView", "selectItemsInRect: Error in synchronized block", e)
            }

            if (changed && minPos != Int.MAX_VALUE) {
                Log.d("HugeTextView", "selectItemsInRect: Posting UI update for range [$minPos, $maxPos]")
                // 🚀 CRASH FIX: Defer notification to avoid "Cannot call this method while RecyclerView is computing a layout or scrolling"
                post {
                    try {
                        if (isAttachedToWindow) {
                            Log.d("HugeTextView", "selectItemsInRect: Notifying adapter of range change")
                            adapter?.notifyItemRangeChanged(minPos, maxPos - minPos + 1)
                        } else {
                            Log.w("HugeTextView", "selectItemsInRect: Not attached to window, skipping notification")
                        }
                    } catch (e: Exception) {
                        Log.e("HugeTextView", "selectItemsInRect: Error in post block", e)
                    }
                }
            }
            
            try {
                invalidateItemDecorations()
            } catch (e: Exception) {
                Log.e("HugeTextView", "selectItemsInRect: Error invalidating decorations", e)
            }
            
            Log.d("HugeTextView", "selectItemsInRect: END")
        } catch (e: Exception) {
            Log.e("HugeTextView", "selectItemsInRect: FATAL ERROR", e)
        }
    }

    override fun setId(id: Int) {
        super.setId(id)
        instances[id] = java.lang.ref.WeakReference(this)
        Log.d("HugeTextView", "Registered viewport instance with ID: $id")
    }

    fun setCustomFontSize(size: Float) {
        if (fontSize != size) {
            fontSize = size
            megaRefresh()
        }
    }

    fun updateBackgroundColor(color: String) {
        try {
            bgThemeColor = Color.parseColor(color)
            if (Looper.myLooper() == Looper.getMainLooper()) {
                setBackgroundColor(bgThemeColor)
            } else {
                post { setBackgroundColor(bgThemeColor) }
            }
            megaRefresh()
        } catch (e: Exception) {}
    }

    fun updateTextColor(color: String) {
        try {
            textThemeColor = Color.parseColor(color)
            megaRefresh()
        } catch (e: Exception) {}
    }

    fun updateSelectionColor(color: String) {
        try {
            selectionThemeColor = Color.parseColor(color)
            selectionRectPaint.color = selectionThemeColor
            selectionRectPaint.alpha = 80
            selectionRectBorderPaint.color = selectionThemeColor
            megaRefresh()
        } catch (e: Exception) {}
    }

    fun updateLineNumberColor(color: String) {
        try {
            lineNumberThemeColor = Color.parseColor(color)
            megaRefresh()
        } catch (e: Exception) {}
    }
    
    fun exportSelectionToFile(outputPath: String) {
        val file = currentFile ?: return
        val taskId = currentTaskId.get()
        
        taskExecutor.execute {
            try {
                val tempFile = File(outputPath)
                if (tempFile.exists()) tempFile.delete()
                
                val src = RandomAccessFile(file, "r")
                val dst = RandomAccessFile(tempFile, "rw")
                val dstChannel = dst.channel
                
                val range = getSelectedRange()
                if (range != null) {
                    val startIdx = range.first
                    val lineCount = range.second
                    
                    // 🚀 OPTIMIZATION: If ONLY the range is selected (most common for Select All or Rect),
                    // we can use ultra-fast Channel Transfer for massive blocks.
                    val isContiguousOnly = synchronized(selectedLines) {
                        selectedLines.cardinality() == lineCount
                    }
                    
                    if (isContiguousOnly) {
                        try {
                            val startOffset = getLineOffset(startIdx, src)
                            val endPos = startIdx + lineCount
                            val totalLines = synchronized(this@HugeTextView) { currentLineCount }
                            val endOffset = if (endPos < totalLines) getLineOffset(endPos, src) else src.length()
                            
                            val bytesToCopy = endOffset - startOffset
                            if (bytesToCopy > 0) {
                                src.channel.transferTo(startOffset, bytesToCopy, dstChannel)
                            }
                        } catch (e: Exception) {
                            Log.e("HugeTextView", "Fast transfer failed, falling back to line-by-line", e)
                            // Fallback to line-by-line write (slower but safe)
                            val indices = getSelectedIndices()
                            for (idx in indices) {
                                if (taskId != currentTaskId.get()) break
                                dst.write((getLineText(idx) + "\n").toByteArray(Charsets.UTF_8))
                            }
                        }
                    } else {
                        // Sparse selection: Line-by-line
                        val indices = getSelectedIndices()
                        for (idx in indices) {
                            if (taskId != currentTaskId.get()) break
                            dst.write((getLineText(idx) + "\n").toByteArray(Charsets.UTF_8))
                        }
                    }
                }
                
                src.close()
                dst.close()
                
                mainHandler.post {
                    val event = Arguments.createMap()
                    event.putString("status", "success")
                    event.putString("path", outputPath)
                    (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)
                        ?.receiveEvent(id, "onSaveComplete", event)
                }
            } catch (e: Exception) {
                Log.e("HugeTextView", "Export selection failed", e)
                mainHandler.post {
                    val event = Arguments.createMap()
                    event.putString("status", "error")
                    event.putString("detail", e.message ?: "Unknown error")
                    (context as? ReactContext)?.getJSModule(RCTEventEmitter::class.java)
                        ?.receiveEvent(id, "onSaveComplete", event)
                }
            }
        }
    }

    fun close() {
        instances.remove(id)
        taskExecutor.shutdownNow()
        searchExecutor.shutdownNow()
        try { raf?.close() } catch (e: Exception) {}
        try { rafSearch?.close() } catch (e: Exception) {}
    }
}
