package com.neoscribe

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.Promise
import com.facebook.react.modules.core.DeviceEventManagerModule
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebSettings
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.os.ParcelFileDescriptor
import android.os.Handler
import android.os.Looper
import android.os.Build
import android.app.Activity
import java.io.File
import java.io.FileOutputStream
import java.io.InputStreamReader
import java.io.BufferedReader
import android.net.Uri
import android.graphics.pdf.PdfDocument
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Rect
import android.graphics.Paint
import android.graphics.Color
import android.graphics.Canvas
import android.text.StaticLayout
import android.text.TextPaint
import android.text.Layout
import android.util.Base64

class FastPdfModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "FastPdfModule"
    }

    private fun sendProgress(progress: Float, status: String) {
        if (getReactApplicationContext().hasActiveCatalystInstance()) {
            val params = com.facebook.react.bridge.Arguments.createMap()
            params.putDouble("progress", progress.toDouble())
            params.putString("status", status)
            getReactApplicationContext()
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onPdfProgress", params)
        }
    }

    @ReactMethod
    fun createPdf(text: String, outputPath: String, promise: Promise) {
        Thread {
            try {
                sendProgress(0.1f, "Initializing...")
                val document = PdfDocument()

                // Render Text with pagination
                renderTextToPdf(document, text, 12f)

                saveAndClose(document, outputPath, promise)
            } catch (e: Exception) {
                promise.reject("CREATE_PDF_FAILED", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun createPdfFromFile(filePath: String, outputPath: String, options: ReadableMap, promise: Promise) {
        Thread {
            try {
                sendProgress(0.05f, "Preparing file...")
                val file = File(filePath)
                if (!file.exists()) {
                    promise.reject("FILE_NOT_FOUND", "Source file not found at $filePath")
                    return@Thread
                }

                val fontSize = if (options.hasKey("fontSize")) options.getDouble("fontSize").toFloat() else 12f

                val document = PdfDocument()
                val A4_WIDTH = 595
                val A4_HEIGHT = 842
                val margin = 50f
                val contentWidth = (A4_WIDTH - (margin * 2)).toInt()
                val pageHeightLimit = (A4_HEIGHT - (margin * 2)).toInt()

                val textPaint = TextPaint()
                textPaint.isAntiAlias = true
                textPaint.color = Color.BLACK
                textPaint.textSize = fontSize

                var pageIndex = 1
                var totalLinesProcessed = 0
                
                val reader = BufferedReader(InputStreamReader(file.inputStream()))
                var currentBatchText = StringBuilder()
                var line: String? = reader.readLine()
                
                while (line != null) {
                    currentBatchText.append(line).append("\n")
                    totalLinesProcessed++
                    
                    // Process in batches of 500 lines to avoid massive StaticLayouts
                    if (totalLinesProcessed % 500 == 0) {
                        renderChunkToPdf(document, currentBatchText.toString(), textPaint, contentWidth, pageHeightLimit, margin, A4_WIDTH, A4_HEIGHT, pageIndex)
                        currentBatchText = StringBuilder()
                        pageIndex = document.pages.size + 1
                        
                        // Update progress (estimate based on file size if possible, or just line count)
                        sendProgress(0.1f + (totalLinesProcessed.toFloat() / 100000f).coerceAtMost(0.8f), "Processed $totalLinesProcessed lines...")
                    }
                    
                    if (pageIndex > 10000) break // Safety limit for PDF pages
                    line = reader.readLine()
                }
                
                // Final chunk
                if (currentBatchText.isNotEmpty()) {
                    renderChunkToPdf(document, currentBatchText.toString(), textPaint, contentWidth, pageHeightLimit, margin, A4_WIDTH, A4_HEIGHT, pageIndex)
                }
                
                reader.close()
                saveAndClose(document, outputPath, promise)
                
            } catch (e: Exception) {
                promise.reject("STREAM_PDF_FAILED", e.message, e)
            }
        }.start()
    }

    private fun renderChunkToPdf(document: PdfDocument, text: String, paint: TextPaint, width: Int, pageLimit: Int, margin: Float, a4W: Int, a4H: Int, startPageIndex: Int) {
        val layout = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            StaticLayout.Builder.obtain(text, 0, text.length, paint, width)
                .setAlignment(Layout.Alignment.ALIGN_NORMAL)
                .setLineSpacing(0f, 1.1f)
                .build()
        } else {
            @Suppress("DEPRECATION")
            StaticLayout(text, paint, width, Layout.Alignment.ALIGN_NORMAL, 1.1f, 0f, false)
        }

        var currentOffset = 0
        var localPageIdx = 0
        
        while (currentOffset < layout.height) {
            val pageInfo = PdfDocument.PageInfo.Builder(a4W, a4H, startPageIndex + localPageIdx).create()
            val page = document.startPage(pageInfo)
            val canvas = page.canvas

            // Footer
            val footerPaint = Paint()
            footerPaint.color = Color.LTGRAY
            footerPaint.textSize = 8f
            canvas.drawText("- ${startPageIndex + localPageIdx} -", (a4W / 2 - 10).toFloat(), (a4H - 25).toFloat(), footerPaint)

            canvas.save()
            canvas.translate(margin, margin)
            canvas.clipRect(0, 0, width, pageLimit)
            canvas.translate(0f, (-currentOffset).toFloat())
            layout.draw(canvas)
            canvas.restore()

            document.finishPage(page)
            currentOffset += pageLimit
            localPageIdx++
            
            if (startPageIndex + localPageIdx > 10000) break
        }
    }

    @ReactMethod
    fun createWebViewPdf(inputUri: String, outputPath: String, options: ReadableMap, promise: Promise) {
        promise.reject("NOT_IMPLEMENTED", "WebView PDF generation is currently disabled due to Android API restrictions.")
    }

    @ReactMethod
    fun createPdfFromImages(imagePaths: ReadableArray, outputPath: String, options: ReadableMap, promise: Promise) {
        Thread {
            try {
                val document = PdfDocument()
                val fitToPage = if (options.hasKey("fitToPage")) options.getBoolean("fitToPage") else true
                val A4_WIDTH = 595
                val A4_HEIGHT = 842

                for (i in 0 until imagePaths.size()) {
                    val progress = (i.toFloat() / imagePaths.size().toFloat()) * 0.9f
                    sendProgress(progress, "Image ${i + 1}...")
                    val path = imagePaths.getString(i)
                    if (path != null) {
                        val bitmap = loadBitmap(path)
                        if (bitmap != null) {
                            val pageInfo = PdfDocument.PageInfo.Builder(A4_WIDTH, A4_HEIGHT, i + 1).create()
                            val page = document.startPage(pageInfo)
                            val canvas = page.canvas

                            if (fitToPage) {
                                val scale = Math.min(A4_WIDTH.toFloat() / bitmap.width, A4_HEIGHT.toFloat() / bitmap.height)
                                val x = (A4_WIDTH - bitmap.width * scale) / 2
                                val y = (A4_HEIGHT - bitmap.height * scale) / 2
                                canvas.drawBitmap(bitmap, null, Rect(x.toInt(), y.toInt(), (x + bitmap.width * scale).toInt(), (y + bitmap.height * scale).toInt()), Paint(Paint.FILTER_BITMAP_FLAG))
                            } else {
                                canvas.drawBitmap(bitmap, 0f, 0f, null)
                            }
                            document.finishPage(page)
                            bitmap.recycle()
                        }
                    }
                }
                saveAndClose(document, outputPath, promise)
            } catch (e: Exception) { promise.reject("CREATE_IMAGES_PDF_FAILED", e.message, e) }
        }.start()
    }

    private fun renderTextToPdf(document: PdfDocument, text: CharSequence, fontSize: Float) {
        val A4_WIDTH = 595
        val A4_HEIGHT = 842
        val margin = 50f
        val contentWidth = (A4_WIDTH - (margin * 2)).toInt()

        val textPaint = TextPaint()
        textPaint.isAntiAlias = true
        textPaint.color = Color.BLACK
        textPaint.textSize = fontSize

        val layout = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            StaticLayout.Builder.obtain(text, 0, text.length, textPaint, contentWidth)
                .setAlignment(Layout.Alignment.ALIGN_NORMAL)
                .setLineSpacing(0f, 1.1f)
                .build()
        } else {
            @Suppress("DEPRECATION")
            StaticLayout(text, textPaint, contentWidth, Layout.Alignment.ALIGN_NORMAL, 1.1f, 0f, false)
        }

        val pageHeightLimit = (A4_HEIGHT - (margin * 2)).toInt()
        var currentOffset = 0
        var pageIndex = 1

        while (currentOffset < layout.height) {
            val progress = (currentOffset.toFloat() / layout.height.toFloat()) * 0.8f
            sendProgress(0.2f + progress, "Rendering page $pageIndex...")

            val page = document.startPage(PdfDocument.PageInfo.Builder(A4_WIDTH, A4_HEIGHT, pageIndex).create())
            val canvas = page.canvas

            // Footer
            val footerPaint = Paint()
            footerPaint.color = Color.LTGRAY
            footerPaint.textSize = 8f
            canvas.drawText("- $pageIndex -", (A4_WIDTH / 2 - 10).toFloat(), (A4_HEIGHT - 25).toFloat(), footerPaint)

            canvas.save()
            canvas.translate(margin, margin)
            canvas.clipRect(0, 0, contentWidth, pageHeightLimit)
            canvas.translate(0f, (-currentOffset).toFloat())
            layout.draw(canvas)
            canvas.restore()

            document.finishPage(page)
            currentOffset += pageHeightLimit
            pageIndex++
            if (pageIndex > 5000) break // Safety brake
        }
    }

    private fun loadBitmap(path: String): Bitmap? {
        return try {
            if (path.startsWith("data:image")) {
                val base64Data = path.substringAfter("base64,")
                val decodedString = Base64.decode(base64Data, Base64.DEFAULT)
                BitmapFactory.decodeByteArray(decodedString, 0, decodedString.size)
            } else if (path.startsWith("content://")) {
                BitmapFactory.decodeStream(getReactApplicationContext().contentResolver.openInputStream(Uri.parse(path)))
            } else {
                BitmapFactory.decodeFile(path.replace("file://", ""))
            }
        } catch (e: Exception) { null }
    }

    private fun saveAndClose(document: PdfDocument, outputPath: String, promise: Promise) {
        try {
            val file = File(outputPath)
            val os = FileOutputStream(file)
            document.writeTo(os)
            document.close()
            os.close()
            sendProgress(1.0f, "Complete!")
            promise.resolve(file.absolutePath)
        } catch (e: Exception) { promise.reject("SAVE_PDF_FAILED", e.message, e) }
    }
}
