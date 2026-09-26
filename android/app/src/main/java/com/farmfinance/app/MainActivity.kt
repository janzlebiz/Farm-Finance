package com.farmfinance.app

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebViewAssetLoader
import com.farmfinance.app.bridge.FarmFinanceNativeBridge
import com.farmfinance.app.data.local.FarmFinanceDatabase
import com.farmfinance.app.data.repository.FarmRepository
import com.farmfinance.app.security.KeystoreManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject

class MainActivity : ComponentActivity(), FarmFinanceNativeBridge.BackupRestoreHandler {

    private lateinit var webView: WebView
    private lateinit var database: FarmFinanceDatabase
    private lateinit var repository: FarmRepository
    private lateinit var keystoreManager: KeystoreManager
    private lateinit var nativeBridge: FarmFinanceNativeBridge

    private val exportDocumentLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK && result.data?.data != null) {
            val uri: Uri = result.data!!.data!!
            lifecycleScope.launch(Dispatchers.IO) {
                try {
                    val jsonContent = nativeBridge.exportBackup()
                    contentResolver.openOutputStream(uri)?.use { outputStream ->
                        outputStream.write(jsonContent.toByteArray(Charsets.UTF_8))
                        outputStream.flush()
                    }
                    dispatchWebEvent(
                        "farm-finance-backup-result",
                        JSONObject().apply {
                            put("success", true)
                            put("message", "Backup successfully exported to selected location.")
                        }
                    )
                } catch (e: Exception) {
                    dispatchWebEvent(
                        "farm-finance-backup-result",
                        JSONObject().apply {
                            put("success", false)
                            put("message", "Export failed: ${e.message ?: "Could not write file."}")
                        }
                    )
                }
            }
        } else {
            // User cancelled
            dispatchWebEvent(
                "farm-finance-backup-result",
                JSONObject().apply {
                    put("success", false)
                    put("cancelled", true)
                    put("message", "Backup export was cancelled.")
                }
            )
        }
    }

    private val restoreDocumentLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK && result.data?.data != null) {
            val uri: Uri = result.data!!.data!!
            lifecycleScope.launch(Dispatchers.IO) {
                try {
                    val backupJson = contentResolver.openInputStream(uri)?.use { inputStream ->
                        inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                    } ?: throw IllegalStateException("Could not read selected backup file.")

                    val restoreResultJson = nativeBridge.restoreBackup(backupJson)
                    val resultObj = JSONObject(restoreResultJson)
                    val success = resultObj.optBoolean("success", false)
                    val message = if (success) {
                        resultObj.optString("message", "Database successfully restored.")
                    } else {
                        resultObj.optString("error", "Restore failed: Invalid or altered backup file.")
                    }

                    dispatchWebEvent(
                        "farm-finance-restore-result",
                        JSONObject().apply {
                            put("success", success)
                            put("message", message)
                        }
                    )
                } catch (e: Exception) {
                    dispatchWebEvent(
                        "farm-finance-restore-result",
                        JSONObject().apply {
                            put("success", false)
                            put("message", "Restore failed: ${e.message ?: "Invalid file."}")
                        }
                    )
                }
            }
        } else {
            // User cancelled
            dispatchWebEvent(
                "farm-finance-restore-result",
                JSONObject().apply {
                    put("success", false)
                    put("cancelled", true)
                    put("message", "Restore was cancelled.")
                }
            )
        }
    }

    private fun dispatchWebEvent(eventName: String, payload: JSONObject) {
        if (::webView.isInitialized) {
            val js = "window.dispatchEvent(new CustomEvent('${eventName}', { detail: ${payload.toString()} }));"
            webView.post {
                webView.evaluateJavascript(js, null)
            }
        }
    }

    override fun launchExportBackup(suggestedFileName: String) {
        runOnUiThread {
            val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "application/json"
                putExtra(Intent.EXTRA_TITLE, suggestedFileName)
            }
            exportDocumentLauncher.launch(intent)
        }
    }

    override fun launchRestoreBackup() {
        runOnUiThread {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "*/*"
                putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/json", "application/octet-stream", "text/plain", "*/*"))
            }
            restoreDocumentLauncher.launch(intent)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize authoritative native Room persistence and security
        database = FarmFinanceDatabase.getDatabase(applicationContext)
        repository = FarmRepository(database)
        keystoreManager = KeystoreManager(applicationContext)
        nativeBridge = FarmFinanceNativeBridge(repository, database, keystoreManager, applicationContext)
        nativeBridge.backupRestoreHandler = this

        // Setup WebViewAssetLoader to securely serve local assets from https://appassets.androidplatform.net/
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/res/", WebViewAssetLoader.ResourcesPathHandler(this))
            .build()

        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.parseColor("#1b5e20"))

            // Register Authoritative Room Native Bridge
            addJavascriptInterface(nativeBridge, "FarmFinanceNative")

            // Hardened WebView settings
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = false // Deprecated Web SQL disabled
                allowFileAccess = false // Hardened: No raw file system access
                allowContentAccess = false // Hardened: No content provider access
                allowFileAccessFromFileURLs = false
                allowUniversalAccessFromFileURLs = false
                useWideViewPort = true
                loadWithOverviewMode = true
                setSupportZoom(false)
                displayZoomControls = false
                cacheMode = WebSettings.LOAD_DEFAULT
                mediaPlaybackRequiresUserGesture = true
            }

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? {
                    return assetLoader.shouldInterceptRequest(request.url)
                }

                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest
                ): Boolean {
                    val url = request.url
                    // Enforce origin lock: Only local bundled assets on appassets.androidplatform.net
                    if (url.scheme == "https" && url.host == "appassets.androidplatform.net") {
                        return false // Let WebView load local asset
                    }

                    // Open external links securely in external browser intent
                    if (url.scheme == "http" || url.scheme == "https") {
                        try {
                            val intent = Intent(Intent.ACTION_VIEW, url)
                            startActivity(intent)
                        } catch (_: Exception) {
                            // Suppress intent failure
                        }
                        return true
                    }
                    return true
                }
            }

            webChromeClient = WebChromeClient()

            // Load local bundled web application
            loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
        }

        setContentView(webView)

        // Handle native back button navigation
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (::webView.isInitialized && webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.destroy()
        }
        super.onDestroy()
    }
}

