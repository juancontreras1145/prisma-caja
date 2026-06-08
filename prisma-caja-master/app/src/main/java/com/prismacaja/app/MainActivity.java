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
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.net.URLEncoder;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int SAVE_JSON_REQUEST = 1002;
    private static final int SAVE_CSV_REQUEST = 1003;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private String pendingJsonContent;
    private String pendingCsvContent;

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

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleExternalUrl(url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleExternalUrl(request.getUrl().toString());
            }
        });

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
                intent.setType("*/*");
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

    private void setupBars() {
        getWindow().setStatusBarColor(Color.parseColor("#07111f"));
        getWindow().setNavigationBarColor(Color.parseColor("#07111f"));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    private boolean handleExternalUrl(String url) {
        if (url == null) return false;

        if (
                url.startsWith("https://wa.me/")
                        || url.startsWith("http://wa.me/")
                        || url.startsWith("https://api.whatsapp.com/")
                        || url.startsWith("whatsapp://")
        ) {
            openExternalWhatsapp(Uri.parse(url));
            return true;
        }

        return false;
    }

    private boolean tryOpenPackage(Uri uri, String packageName) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.setPackage(packageName);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            if (intent.resolveActivity(getPackageManager()) != null) {
                startActivity(intent);
                return true;
            }
        } catch (Exception ignored) {
        }

        return false;
    }

    private void openExternalWhatsapp(Uri uri) {
        if (tryOpenPackage(uri, "com.whatsapp")) return;
        if (tryOpenPackage(uri, "com.whatsapp.w4b")) return;

        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception e) {
            Toast.makeText(this, "No se pudo abrir WhatsApp", Toast.LENGTH_LONG).show();
        }
    }

    private String normalizePhone(String phone) {
        String digits = phone == null ? "" : phone.replaceAll("[^0-9]", "");

        if (digits.length() == 8) return "569" + digits;
        if (digits.length() == 9 && digits.startsWith("9")) return "56" + digits;
        if (digits.startsWith("56")) return digits;

        return digits;
    }

    private void openWhatsappNumber(String phone, String text) {
        try {
            String digits = normalizePhone(phone);
            if (digits.isEmpty()) {
                Toast.makeText(this, "Cliente sin WhatsApp", Toast.LENGTH_LONG).show();
                return;
            }

            String encoded = "";
            if (text != null && !text.trim().isEmpty()) {
                encoded = "?text=" + URLEncoder.encode(text, "UTF-8").replace("+", "%20");
            }

            openExternalWhatsapp(Uri.parse("https://wa.me/" + digits + encoded));
        } catch (Exception e) {
            Toast.makeText(this, "No se pudo abrir WhatsApp", Toast.LENGTH_LONG).show();
        }
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

    private boolean tryOpenImageToJid(Uri uri, String digits, String packageName) {
        try {
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("image/png");
            intent.putExtra(Intent.EXTRA_STREAM, uri);

            // Experimental/no oficial: algunas versiones de WhatsApp respetan este JID.
            intent.putExtra("jid", digits + "@s.whatsapp.net");

            intent.setPackage(packageName);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            grantUriPermission(packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);

            if (intent.resolveActivity(getPackageManager()) != null) {
                startActivity(intent);
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

        if (openShareTarget(baseIntent, uri, "com.whatsapp")) return;
        if (openShareTarget(baseIntent, uri, "com.whatsapp.w4b")) return;

        startActivity(Intent.createChooser(baseIntent, "Compartir boleta"));
    }

    private File writeCacheFile(String folderName, String fileName, String content) throws Exception {
        String safeName = fileName == null || fileName.trim().isEmpty()
                ? "respaldo-prisma.json"
                : fileName.replaceAll("[^a-zA-Z0-9._-]", "-");

        File dir = new File(getCacheDir(), folderName);
        if (!dir.exists()) dir.mkdirs();

        File file = new File(dir, safeName);
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(content.getBytes("UTF-8"));
        }

        return file;
    }

    private void shareJsonFile(String fileName, String json) {
        try {
            File file = writeCacheFile("json", fileName, json);

            Uri uri = FileProvider.getUriForFile(
                    this,
                    getPackageName() + ".fileprovider",
                    file
            );

            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("application/json");
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            startActivity(Intent.createChooser(intent, "Compartir respaldo JSON"));
        } catch (Exception e) {
            Toast.makeText(this, "No se pudo compartir el JSON", Toast.LENGTH_LONG).show();
        }
    }

    private void saveJsonFile(String fileName, String json) {
        try {
            pendingJsonContent = json;

            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/json");
            intent.putExtra(Intent.EXTRA_TITLE, fileName == null ? "respaldo-prisma.json" : fileName);

            startActivityForResult(intent, SAVE_JSON_REQUEST);
        } catch (Exception e) {
            Toast.makeText(this, "No se pudo abrir guardar JSON", Toast.LENGTH_LONG).show();
        }
    }

    private void saveCsvFile(String fileName, String csv) {
        try {
            pendingCsvContent = csv;

            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("text/csv");
            intent.putExtra(Intent.EXTRA_TITLE, fileName == null ? "prisma-historial.csv" : fileName);

            startActivityForResult(intent, SAVE_CSV_REQUEST);
        } catch (Exception e) {
            Toast.makeText(this, "No se pudo abrir guardar CSV", Toast.LENGTH_LONG).show();
        }
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
                    try {
                        getContentResolver().takePersistableUriPermission(
                                uri,
                                Intent.FLAG_GRANT_READ_URI_PERMISSION
                        );
                    } catch (Exception ignored) {
                    }
                }
            }

            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
            return;
        }

        if (requestCode == SAVE_JSON_REQUEST) {
            if (resultCode == Activity.RESULT_OK && dataIntent != null && dataIntent.getData() != null && pendingJsonContent != null) {
                try {
                    Uri uri = dataIntent.getData();
                    try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                        if (out != null) {
                            out.write(pendingJsonContent.getBytes("UTF-8"));
                            Toast.makeText(this, "JSON guardado", Toast.LENGTH_LONG).show();
                        }
                    }
                } catch (Exception e) {
                    Toast.makeText(this, "No se pudo escribir el JSON", Toast.LENGTH_LONG).show();
                }
            }

            pendingJsonContent = null;
            return;
        }

        if (requestCode == SAVE_CSV_REQUEST) {
            if (resultCode == Activity.RESULT_OK && dataIntent != null && dataIntent.getData() != null && pendingCsvContent != null) {
                try {
                    Uri uri = dataIntent.getData();
                    try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                        if (out != null) {
                            out.write(pendingCsvContent.getBytes("UTF-8"));
                            Toast.makeText(this, "CSV guardado", Toast.LENGTH_LONG).show();
                        }
                    }
                } catch (Exception e) {
                    Toast.makeText(this, "No se pudo escribir el CSV", Toast.LENGTH_LONG).show();
                }
            }

            pendingCsvContent = null;
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
                    // Prisma maneja atrás dentro de la app.
                }
        );
    }

    public static class AndroidBridge {
        private final MainActivity activity;

        AndroidBridge(MainActivity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public void openWhatsapp(String phone, String text) {
            activity.runOnUiThread(() -> activity.openWhatsappNumber(phone, text));
        }

        @JavascriptInterface
        public void saveJson(String fileName, String json) {
            activity.runOnUiThread(() -> activity.saveJsonFile(fileName, json));
        }

        @JavascriptInterface
        public void saveCsv(String fileName, String csv) {
            activity.runOnUiThread(() -> activity.saveCsvFile(fileName, csv));
        }

        @JavascriptInterface
        public void shareJson(String fileName, String json) {
            activity.runOnUiThread(() -> activity.shareJsonFile(fileName, json));
        }


        @JavascriptInterface
        public void shareImageToPhone(String dataUrl, String fileName, String phone) {
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

                    String digits = activity.normalizePhone(phone);

                    activity.runOnUiThread(() -> {
                        try {
                            if (!digits.isEmpty() && activity.tryOpenImageToJid(uri, digits, "com.whatsapp")) return;
                            if (!digits.isEmpty() && activity.tryOpenImageToJid(uri, digits, "com.whatsapp.w4b")) return;

                            activity.openImageShare(uri);
                        } catch (Exception e) {
                            activity.openImageShare(uri);
                        }
                    });
                } catch (Exception e) {
                    activity.runOnUiThread(() ->
                            Toast.makeText(activity, "No se pudo preparar la boleta", Toast.LENGTH_LONG).show()
                    );
                }
            }).start();
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
