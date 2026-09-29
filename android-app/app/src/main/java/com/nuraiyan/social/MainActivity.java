package com.nuraiyan.social;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private SwipeRefreshLayout swipeRefreshLayout;
    private ValueCallback<Uri[]> filePathCallback;
    private ActivityResultLauncher<String[]> fileChooserLauncher;

    // Splash / loading overlay
    private FrameLayout splashOverlay;
    private ProgressBar loadingSpinner;
    private TextView loadingText;

    private boolean pageLoadedOnce = false;

    private static final String APP_URL = "https://nu-raiyan.vercel.app";
    private static final int PERMISSION_REQ_CODE = 101;

    // Cold-start messages cycle so user knows app is waking up backend
    private static final String[] LOADING_MESSAGES = {
        "Nuraiyan লোড হচ্ছে…",
        "সার্ভার জেগে উঠছে, একটু অপেক্ষা করুন…",
        "প্রায় হয়ে গেছে…"
    };
    private int msgIndex = 0;
    private final Handler msgHandler = new Handler(Looper.getMainLooper());
    private final Runnable msgCycler = new Runnable() {
        @Override
        public void run() {
            if (loadingText != null && splashOverlay.getVisibility() == View.VISIBLE) {
                loadingText.setText(LOADING_MESSAGES[msgIndex % LOADING_MESSAGES.length]);
                msgIndex++;
                msgHandler.postDelayed(this, 4000);
            }
        }
    };

    @SuppressLint({"SetJavaScriptEnabled", "ObsoleteSdkInt"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // ── Full-screen & hardware acceleration ──────────────────────────
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        );

        // ── Root container ────────────────────────────────────────────────
        FrameLayout rootFrame = new FrameLayout(this);
        rootFrame.setBackgroundColor(Color.parseColor("#0F0F23")); // dark bg

        // ── SwipeRefresh + WebView ────────────────────────────────────────
        swipeRefreshLayout = new SwipeRefreshLayout(this);
        webView = new WebView(this);
        swipeRefreshLayout.addView(webView,
            new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        rootFrame.addView(swipeRefreshLayout,
            new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // ── Splash overlay (shown while loading) ──────────────────────────
        splashOverlay = new FrameLayout(this);
        splashOverlay.setBackgroundColor(Color.parseColor("#0F0F23"));
        splashOverlay.setVisibility(View.VISIBLE);

        LinearLayout splashContent = new LinearLayout(this);
        splashContent.setOrientation(LinearLayout.VERTICAL);
        splashContent.setGravity(Gravity.CENTER);

        // App title
        TextView appTitle = new TextView(this);
        appTitle.setText("নূরাইয়ান");
        appTitle.setTextSize(36f);
        appTitle.setTextColor(Color.parseColor("#F43F5E"));
        appTitle.setGravity(Gravity.CENTER);
        appTitle.setPadding(0, 0, 0, 32);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            appTitle.setLetterSpacing(0.05f);
        }
        splashContent.addView(appTitle);

        // Spinner
        loadingSpinner = new ProgressBar(this, null, android.R.attr.progressBarStyleLarge);
        loadingSpinner.getIndeterminateDrawable()
            .setColorFilter(Color.parseColor("#6366F1"), android.graphics.PorterDuff.Mode.SRC_IN);
        LinearLayout.LayoutParams spinnerParams = new LinearLayout.LayoutParams(80, 80);
        spinnerParams.gravity = Gravity.CENTER_HORIZONTAL;
        spinnerParams.bottomMargin = 28;
        splashContent.addView(loadingSpinner, spinnerParams);

        // Loading message
        loadingText = new TextView(this);
        loadingText.setText(LOADING_MESSAGES[0]);
        loadingText.setTextSize(14f);
        loadingText.setTextColor(Color.parseColor("#A0A0C0"));
        loadingText.setGravity(Gravity.CENTER);
        splashContent.addView(loadingText);

        FrameLayout.LayoutParams splashContentParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        splashContentParams.gravity = Gravity.CENTER;
        splashOverlay.addView(splashContent, splashContentParams);

        rootFrame.addView(splashOverlay,
            new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        setContentView(rootFrame);

        // ── Swipe to refresh ─────────────────────────────────────────────
        swipeRefreshLayout.setColorSchemeColors(0xFFF43F5E, 0xFF6366F1);
        swipeRefreshLayout.setOnRefreshListener(() -> webView.reload());

        // ── File chooser launcher ─────────────────────────────────────────
        fileChooserLauncher = registerForActivityResult(
            new ActivityResultContracts.OpenMultipleDocuments(),
            uris -> {
                if (filePathCallback != null) {
                    if (uris != null && !uris.isEmpty()) {
                        filePathCallback.onReceiveValue(uris.toArray(new Uri[0]));
                    } else {
                        filePathCallback.onReceiveValue(null);
                    }
                    filePathCallback = null;
                }
            }
        );

        // ── WebView settings ──────────────────────────────────────────────
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setUseWideViewPort(true);          // respect viewport meta tag
        settings.setLoadWithOverviewMode(true);     // fit page to screen width
        settings.setSupportZoom(false);             // disable pinch zoom (app-like feel)

        // ── Performance: aggressive caching ──────────────────────────────
        settings.setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            //noinspection deprecation
            settings.setAppCacheEnabled(true);
        }

        // ── Performance: render priority ──────────────────────────────────
        //noinspection deprecation
        settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
        settings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.TEXT_AUTOSIZING);

        // ── Hardware GPU layer for smooth scrolling ────────────────────────
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        // ── Custom UA ─────────────────────────────────────────────────────
        settings.setUserAgentString(settings.getUserAgentString() + " NuraiyanAndroidApp/2.0");

        // ── WebChromeClient: camera/mic + file chooser ────────────────────
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }

            @Override
            public boolean onShowFileChooser(WebView wv, ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = cb;
                String[] acceptTypes = params.getAcceptTypes();
                if (acceptTypes == null || acceptTypes.length == 0 || acceptTypes[0].isEmpty()) {
                    acceptTypes = new String[]{"*/*"};
                }
                fileChooserLauncher.launch(acceptTypes);
                return true;
            }
        });

        // ── WebViewClient: splash hide + viewport inject ───────────────────
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                // Start cycling loading messages
                if (!pageLoadedOnce) {
                    msgHandler.post(msgCycler);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                swipeRefreshLayout.setRefreshing(false);

                // ── Fix 1: Inject / enforce responsive viewport meta ──────
                view.evaluateJavascript(
                    "(function() {" +
                    "  var meta = document.querySelector('meta[name=\"viewport\"]');" +
                    "  var content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';" +
                    "  if (meta) { meta.setAttribute('content', content); }" +
                    "  else {" +
                    "    var m = document.createElement('meta');" +
                    "    m.name = 'viewport'; m.content = content;" +
                    "    document.head.appendChild(m);" +
                    "  }" +
                    "})();", null
                );

                // ── Fix 2: Hide splash overlay once page is loaded ────────
                if (!pageLoadedOnce) {
                    pageLoadedOnce = true;
                    msgHandler.removeCallbacks(msgCycler);
                    // Slight delay so content renders before splash fades
                    new Handler(Looper.getMainLooper()).postDelayed(() -> {
                        splashOverlay.animate()
                            .alpha(0f)
                            .setDuration(400)
                            .withEndAction(() -> splashOverlay.setVisibility(View.GONE))
                            .start();
                    }, 300);
                }
            }
        });

        // ── Permissions + load URL ────────────────────────────────────────
        checkAndRequestPermissions();
        webView.loadUrl(APP_URL);
    }

    private void checkAndRequestPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            String[] permissions = {
                Manifest.permission.CAMERA,
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.MODIFY_AUDIO_SETTINGS
            };
            boolean needsRequest = false;
            for (String p : permissions) {
                if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
                    needsRequest = true;
                    break;
                }
            }
            if (needsRequest) {
                ActivityCompat.requestPermissions(this, permissions, PERMISSION_REQ_CODE);
            }
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        webView.resumeTimers();
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
        webView.pauseTimers();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        msgHandler.removeCallbacksAndMessages(null);
        webView.stopLoading();
        webView.destroy();
    }
}
