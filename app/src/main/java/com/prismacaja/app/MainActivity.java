package com.prismacaja.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebChromeClient.FileChooserParams;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 1001;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);

        webView = new WebView(this);
        setContentView(webView);
        setupBars();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        webView.setWebViewClient(new WebViewClient());

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams
            ) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }

                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                        "application/json",
                        "text/json",
                        "text/plain",
                        "*/*"
                });

                try {
                    startActivityForResult(Intent.createChooser(intent, "Seleccionar respaldo JSON"), FILE_CHOOSER_REQUEST);
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    Toast.makeText(MainActivity.this, "No se pudo abrir el selector de archivos", Toast.LENGTH_LONG).show();
                    return false;
                }

                return true;
            }
        });

        webView.addJavascriptInterface(new AndroidBridge(this), "AndroidBridge");
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onResume() {
        super.onResume();
        setupBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) setupBars();
    }

    private void setupBars() {
        // Dejamos visible la barra inferior de Android.
        getWindow().setStatusBarColor(Color.parseColor("#07111f"));
        getWindow().setNavigationBarColor(Color.parseColor("#07111f"));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent dataIntent) {
        super.onActivityResult(requestCode, resultCode, dataIntent);

        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (filePathCallback == null) return;

            Uri[] results = null;

            if (resultCode == Activity.RESULT_OK && dataIntent != null) {
                Uri uri = dataIntent.getData();
                if (uri != null) {
                    results = new Uri[]{uri};
                    getContentResolver().takePersistableUriPermission(
                            uri,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION
                    );
                }
            }

            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }

        webView.evaluateJavascript(
                "(window.appBack ? window.appBack() : 'handled')",
                value -> {
                    // Por seguridad, Prisma no se cierra con un toque accidental en Atrás.
                    // La navegación interna la maneja appBack() en JavaScript.
                }
        );
    }

    private boolean openShareTarget(Intent baseIntent, Uri uri, String packageName) {
        try {
            Intent target = new Intent(baseIntent);
            target.setPackage(packageName);
            target.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            grantUriPermission(packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);

            if (target.resolveActivity(getPackageManager()) != null) {
                startActivity(target);
                return true;
            }
        } catch (Exception ignored) {
        }

        return false;
    }

    private void openImageShare(Uri uri) {
        Intent baseIntent = new Intent(Intent.ACTION_SEND);
        baseIntent.setType("image/png");
        baseIntent.putExtra(Intent.EXTRA_STREAM, uri);
        baseIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        // Evita el panel inferior genérico: primero intenta WhatsApp directo.
        if (openShareTarget(baseIntent, uri, "com.whatsapp")) return;

        // Si usa WhatsApp Business.
        if (openShareTarget(baseIntent, uri, "com.whatsapp.w4b")) return;

        // Último recurso: panel normal de Android.
        startActivity(Intent.createChooser(baseIntent, "Compartir boleta"));
    }

    public static class AndroidBridge {
        private final MainActivity activity;

        AndroidBridge(MainActivity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public void shareImage(String dataUrl, String fileName) {
            new Thread(() -> {
                try {
                    String safeName = fileName == null || fileName.trim().isEmpty()
                            ? "boleta.png"
                            : fileName.replaceAll("[^a-zA-Z0-9._-]", "-");

                    String base64 = dataUrl;
                    int comma = dataUrl.indexOf(",");
                    if (comma >= 0) {
                        base64 = dataUrl.substring(comma + 1);
                    }

                    byte[] bytes = Base64.decode(base64, Base64.DEFAULT);

                    File dir = new File(activity.getCacheDir(), "receipts");
                    if (!dir.exists()) dir.mkdirs();

                    File file = new File(dir, safeName);
                    try (FileOutputStream out = new FileOutputStream(file)) {
                        out.write(bytes);
                    }

                    Uri uri = FileProvider.getUriForFile(
                            activity,
                            activity.getPackageName() + ".fileprovider",
                            file
                    );

                    activity.runOnUiThread(() -> {
                        try {
                            activity.openImageShare(uri);
                        } catch (Exception e) {
                            Toast.makeText(activity, "No se pudo abrir WhatsApp", Toast.LENGTH_LONG).show();
                        }
                    });
                } catch (Exception e) {
                    activity.runOnUiThread(() ->
                            Toast.makeText(activity, "No se pudo preparar la boleta", Toast.LENGTH_LONG).show()
                    );
                }
            }).start();
        }
    }
}
