package com.prismacaja.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.text.NumberFormat;
import java.util.Date;
import java.text.SimpleDateFormat;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/** PDF interno vinculado a la boleta registrada por El Kiosquito. No es documento tributario. */
public final class ReceiptPdfShare {
    private ReceiptPdfShare() {}
    private static String money(long n) {
        return "$" + NumberFormat.getIntegerInstance(new Locale("es", "CL")).format(n);
    }
    private static long whole(double n) { return Math.round(n); }
    private static String safe(String text) {
        return text == null ? "" : text.replaceAll("[\\r\\n\\t]", " ").trim();
    }
    private static String shorten(String text, int max) {
        String s = safe(text);
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }
    private static void print(Canvas canvas, Paint paint, String text, float x, float y, int size, boolean bold) {
        paint.setTextSize(size);
        paint.setTypeface(bold ? Typeface.create(Typeface.DEFAULT, Typeface.BOLD) : Typeface.DEFAULT);
        canvas.drawText(safe(text), x, y, paint);
    }
    public static void share(Activity activity, String json) {
        try {
            JSONObject sale = new JSONObject(json);
            String client = safe(sale.optString("clientName", ""));
            if (client.isEmpty()) throw new IllegalArgumentException("La boleta no tiene cliente");
            JSONArray items = sale.optJSONArray("items");
            if (items == null || items.length() == 0) throw new IllegalArgumentException("Boleta sin productos");
            File dir = new File(activity.getCacheDir(), "receipts");
            if (!dir.exists() && !dir.mkdirs()) throw new Exception("No se pudo crear carpeta de boletas");
            String number = safe(String.valueOf(sale.opt("boletaNumber")));
            if (number.isEmpty() || "null".equals(number)) number = "pendientes";
            String safeNumber = number.replaceAll("[^a-zA-Z0-9-]", "_");
            String safeClient = client.replaceAll("[^a-zA-Z0-9-]", "_");
            if (safeClient.length() > 30) safeClient = safeClient.substring(0, 30);
            File file = new File(dir, "comprobante_" + safeNumber + "_" + safeClient + ".pdf");

            PdfDocument pdf = new PdfDocument();
            try {
                Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
                p.setColor(Color.BLACK);
                int pageNum = 0;
                int index = 0;
                do {
                    pageNum++;
                    PdfDocument.Page page = pdf.startPage(new PdfDocument.PageInfo.Builder(595, 842, pageNum).create());
                    Canvas c = page.getCanvas();
                    c.drawColor(Color.WHITE);
                    int y = 55;
                    print(c,p,"EL KIOSQUITO",42,y,25,true); y += 29;
                    print(c,p,"COMPROBANTE INTERNO - NO TRIBUTARIO",42,y,12,true); y += 26;
                    print(c,p,"Boleta: " + number + "    Pagina: " + pageNum,42,y,14,true); y += 24;
                    print(c,p,"Cliente: " + shorten(client,47),42,y,14,false); y += 23;
                    String phone = safe(sale.optString("clientPhone", ""));
                    if (!phone.isEmpty()) { print(c,p,"WhatsApp: " + shorten(phone,35),42,y,12,false); y+=22; }
                    String when = safe(sale.optString("createdAt", ""));
                    print(c,p,"Fecha: " + shorten(when.replace('T',' '),44),42,y,12,false); y+=27;
                    c.drawLine(42,y,550,y,p); y+=25;
                    print(c,p,"PRODUCTO",42,y,13,true);
                    print(c,p,"CANT.",365,y,13,true);
                    print(c,p,"TOTAL",445,y,13,true); y += 27;
                    while (index < items.length() && y < 695) {
                        JSONObject it = items.optJSONObject(index++);
                        if (it == null) continue;
                        int qty = Math.max(1,it.optInt("qty",1));
                        long price = whole(it.optDouble("price",0));
                        long sum = whole(it.optDouble("total",qty*price));
                        print(c,p,shorten(it.optString("name","Producto"),38),42,y,12,false);
                        print(c,p,String.valueOf(qty),365,y,12,false);
                        print(c,p,money(sum),445,y,12,false);
                        y+=19;
                        print(c,p,money(price)+" por unidad",42,y,10,false);
                        y+=29;
                    }
                    if (index >= items.length()) {
                        y = Math.max(y+16,710);
                        c.drawLine(42,y,550,y,p); y+=25;
                        print(c,p,"Total: " + money(whole(sale.optDouble("total",0))),42,y,17,true); y+=25;
                        print(c,p,"Abonado: " + money(whole(sale.optDouble("amountPaid",0))) +
                          "   Pendiente: " + money(whole(sale.optDouble("remaining",0))),42,y,12,false); y+=22;
                        print(c,p,"Estado: " + shorten(sale.optString("status", ""),40),42,y,12,true);
                    } else {
                        print(c,p,"Continua en pagina " + (pageNum + 1),42,766,12,false);
                    }
                    print(c,p,"Comprobante de control interno. No reemplaza boleta electronica del SII.",42,807,10,false);
                    pdf.finishPage(page);
                } while (index < items.length());
                try (FileOutputStream stream = new FileOutputStream(file)) { pdf.writeTo(stream); }
            } finally { pdf.close(); }

            Uri uri = FileProvider.getUriForFile(activity,
                    activity.getPackageName() + ".fileprovider", file);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("application/pdf");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.putExtra(Intent.EXTRA_TEXT, "Comprobante " + number + " de " + client);
            send.setClipData(ClipData.newRawUri("Comprobante PDF",uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(Intent.createChooser(send, "Compartir boleta por WhatsApp u otra app"));
        } catch (Exception e) {
            Toast.makeText(activity,"No se pudo generar el PDF: "+e.getMessage(),Toast.LENGTH_LONG).show();
        }
    }
}
