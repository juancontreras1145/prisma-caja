package com.prismacaja.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.TextView;

import java.util.Locale;
import java.util.WeakHashMap;

/**
 * Entrada visual al modulo Caja de Dulces desde la pantalla principal.
 * Compatible con menues nativos o HTML contenidos en WebView.
 * El boton se muestra cuando encuentra el titulo del inicio o las cuatro opciones de la pantalla.
 */
public final class MenuDulcesInjector {
    private static final WeakHashMap<Activity, Boolean> INSTALLED = new WeakHashMap<>();
    private static final String JS_EN_MENU =
            "(function(){try{" +
            "var t=(document.body&&document.body.innerText)||'';" +
            "return (t.includes('El Kiosquito') || ['Venta','Abono','Historial','Editar'].every(function(x){return t.includes(x);}));" +
            "}catch(e){return false;}})();";

    private MenuDulcesInjector() { }

    public static void attach(final Activity activity) {
        if (activity == null || INSTALLED.containsKey(activity)) return;
        INSTALLED.put(activity, Boolean.TRUE);
        final FrameLayout root = activity.findViewById(android.R.id.content);
        if (root == null) return;
        final TextView button = new TextView(activity);
        button.setText("▦  Caja de Dulces");
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        button.setTextColor(Color.WHITE);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setGravity(Gravity.CENTER);
        button.setContentDescription("Abrir Caja de Dulces para escanear y cobrar");
        button.setFocusable(true);
        button.setClickable(true);
        GradientDrawable bg = new GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                new int[]{Color.rgb(0, 194, 147), Color.rgb(2, 124, 202)});
        bg.setCornerRadius(dp(activity, 22));
        button.setBackground(bg);
        button.setElevation(dp(activity, 6));
        button.setVisibility(View.GONE);
        button.setOnClickListener(v -> activity.startActivity(
                new Intent(activity, CajaDulcesActivity.class)));

        final Handler handler = new Handler(Looper.getMainLooper());
        final Runnable refresh = new Runnable() {
            @Override public void run() {
                if (activity.isFinishing() || activity.isDestroyed()) return;
                if (activity.hasWindowFocus()) {
                    if (button.getParent() != root) {
                        if (button.getParent() instanceof ViewGroup) {
                            ((ViewGroup) button.getParent()).removeView(button);
                        }
                        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT, dp(activity, 64), Gravity.BOTTOM);
                        lp.leftMargin = dp(activity, 18);
                        lp.rightMargin = dp(activity, 18);
                        lp.bottomMargin = dp(activity, 20);
                        root.addView(button, lp);
                    }
                    boolean nativeHome = hasLabel(root, "El Kiosquito") || (hasLabel(root, "Venta")
                            && hasLabel(root, "Abono")
                            && hasLabel(root, "Historial")
                            && hasLabel(root, "Editar"));
                    if (nativeHome) {
                        button.setVisibility(View.VISIBLE);
                    } else {
                        WebView web = findWebView(root);
                        if (web == null) {
                            button.setVisibility(View.GONE);
                        } else {
                            // La interfaz HTML no utiliza TextViews; consultar el texto visible del DOM.
                            web.evaluateJavascript(JS_EN_MENU, result -> {
                                if (!activity.isFinishing() && !activity.isDestroyed()) {
                                    button.setVisibility("true".equals(result)
                                            ? View.VISIBLE : View.GONE);
                                }
                            });
                        }
                    }
                }
                // Se revisa tambien tras navegacion dinamica dentro de una sola WebView.
                handler.postDelayed(this, 1200);
            }
        };
        root.post(refresh);
    }

    private static WebView findWebView(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                WebView child = findWebView(group.getChildAt(i));
                if (child != null) return child;
            }
        }
        return null;
    }

    private static boolean hasLabel(View view, String sought) {
        if (view == null || !view.isShown()) return false;
        if (view instanceof TextView) {
            CharSequence value = ((TextView) view).getText();
            if (value != null && value.toString().trim().toLowerCase(Locale.ROOT)
                    .equals(sought.toLowerCase(Locale.ROOT))) return true;
        }
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                if (hasLabel(group.getChildAt(i), sought)) return true;
            }
        }
        return false;
    }

    private static int dp(Activity a, int value) {
        return Math.round(value * a.getResources().getDisplayMetrics().density);
    }
}
