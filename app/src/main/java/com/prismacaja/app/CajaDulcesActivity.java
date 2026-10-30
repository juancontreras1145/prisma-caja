package com.prismacaja.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.text.InputType;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Módulo POS independiente para Prisma Caja. Una lectura equivale a UNA unidad. */
public class CajaDulcesActivity extends Activity {
    private static final int AZUL = Color.rgb(22, 44, 80);
    private static final int VERDE = Color.rgb(15, 133, 102);
    private static final int FONDO = Color.rgb(246, 248, 252);
    private static final String PREF = "prisma_caja_dulces_v1";
    private final List<Producto> productos = new ArrayList<>();
    private final LinkedHashMap<String,Integer> carrito = new LinkedHashMap<>();
    private SharedPreferences prefs;
    private LinearLayout principal;
    private EditText entradaCodigo;
    private boolean continuo = false;
    private boolean leyendo = false;
    private final Handler handler = new Handler();

    private static class Producto {
        String id, nombre;
        int precio;
        ArrayList<String> codigos = new ArrayList<>();
        Producto(String i, String n, int p, String... barras) {
            id = i; nombre = n; precio = p; codigos.addAll(Arrays.asList(barras));
        }
        JSONObject json() throws JSONException {
            JSONObject v = new JSONObject(); v.put("id",id); v.put("nombre",nombre); v.put("precio",precio);
            JSONArray a = new JSONArray(); for(String c:codigos) a.put(c); v.put("codigos",a); return v;
        }
    }

    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        prefs = getSharedPreferences(PREF, MODE_PRIVATE);
        cargar();
        pintar();
    }
    private static int dp(float v) { return Math.round(v * android.content.res.Resources.getSystem().getDisplayMetrics().density); }
    private static String clp(long n) { return "$" + NumberFormat.getIntegerInstance(new Locale("es","CL")).format(n); }
    private static String fecha() { return new SimpleDateFormat("dd/MM/yyyy HH:mm",new Locale("es","CL")).format(new Date()); }
    private void aviso(String m) { Toast.makeText(this,m,Toast.LENGTH_SHORT).show(); }
    private Producto buscar(String id) { for(Producto p:productos) if(p.id.equals(id))return p; return null; }
    private Producto buscarCodigo(String b) { for(Producto p:productos) if(p.codigos.contains(b))return p; return null; }
    private static String limpiar(String s) { return s==null?"":s.trim().replace(" ",""); }

    private void cargar() {
        String[] nombres={"Super 8","Chokita","Maní confitado","Alfajor Premium","Nikolo","Kegol surtido","Turrón maní","Serranita","Chocman","Cerezas al coñac","Malva Choc","Bigtime refrescante","Inkat","Cuchuflí grande","Full","Rocklets maní"};
        int[] precios={400,500,650,700,500,100,550,400,350,400,150,600,400,200,300,600};
        // Sólo EAN individuales suficientemente contrastados: Super 8 (29g) y Chokita (30g).
        for(int i=0;i<nombres.length;i++) productos.add(new Producto("D"+String.format(Locale.US,"%02d",i+1),nombres[i],precios[i],
                i==0?new String[]{"7613030612339"}:i==1?new String[]{"7613287755810"}:new String[0]));
        try {
            String guardado=prefs.getString("catalogo",null);
            if(guardado!=null) {
                JSONArray a=new JSONArray(guardado);
                for(int i=0;i<a.length();i++) {
                    JSONObject o=a.getJSONObject(i); Producto p=buscar(o.getString("id"));
                    if(p!=null) {
                        p.precio=Math.max(0,o.optInt("precio",p.precio)); p.codigos.clear();
                        JSONArray cb=o.optJSONArray("codigos");
                        if(cb!=null) for(int j=0;j<cb.length();j++) p.codigos.add(cb.getString(j));
                    }
                }
            }
            JSONArray c=new JSONArray(prefs.getString("carrito","[]"));
            for(int i=0;i<c.length();i++) { JSONObject o=c.getJSONObject(i); if(buscar(o.getString("id"))!=null && o.getInt("cantidad")>0)carrito.put(o.getString("id"),o.getInt("cantidad")); }
        } catch(Exception e){ aviso("Aviso: no se pudo restaurar una parte de los datos"); }
    }
    private void guardar(){
        try {
            JSONArray cat=new JSONArray(); for(Producto p:productos) cat.put(p.json());
            JSONArray cart=new JSONArray(); for(Map.Entry<String,Integer> e:carrito.entrySet())cart.put(new JSONObject().put("id",e.getKey()).put("cantidad",e.getValue()));
            prefs.edit().putString("catalogo",cat.toString()).putString("carrito",cart.toString()).apply();
        }catch(JSONException e){aviso("Error al guardar catálogo");}
    }
    private long total(){ long suma=0; for(Map.Entry<String,Integer> e:carrito.entrySet()){ Producto p=buscar(e.getKey()); if(p!=null)suma+=(long)p.precio*e.getValue(); }return suma; }
    private int unidades(){ int n=0; for(int cant:carrito.values())n+=cant;return n; }
    private void agregar(Producto p){ if(p==null)return; carrito.put(p.id,carrito.containsKey(p.id)?carrito.get(p.id)+1:1); guardar(); pintar(); aviso(p.nombre+" +1 · "+clp(p.precio)); }
    private void cambiarCantidad(Producto p,int delta){int v=carrito.containsKey(p.id)?carrito.get(p.id)+delta:delta;if(v<=0)carrito.remove(p.id);else carrito.put(p.id,v);guardar();pintar();}

    private TextView texto(String t,int tam,boolean fuerte,int color){
        TextView v=new TextView(this);v.setText(t);v.setTextSize(tam);v.setTextColor(color);v.setPadding(dp(4),dp(5),dp(4),dp(5));
        if(fuerte)v.setTypeface(null,Typeface.BOLD);return v;
    }
    private Button boton(String t, View.OnClickListener accion){
        Button b=new Button(this);b.setText(t);b.setAllCaps(false);b.setTextSize(14);b.setOnClickListener(accion);return b;
    }
    private LinearLayout horizontal(){LinearLayout r=new LinearLayout(this);r.setOrientation(LinearLayout.HORIZONTAL);r.setGravity(Gravity.CENTER_VERTICAL);return r;}
    private void separador(){View v=new View(this);v.setBackgroundColor(0xffe2e7f0);LinearLayout.LayoutParams l=new LinearLayout.LayoutParams(-1,dp(1));l.setMargins(0,dp(8),0,dp(8));principal.addView(v,l);}
    private void pintar(){
        ScrollView sc=new ScrollView(this);sc.setFillViewport(true);sc.setBackgroundColor(FONDO);
        principal=new LinearLayout(this);principal.setOrientation(LinearLayout.VERTICAL);principal.setPadding(dp(16),dp(14),dp(16),dp(32));sc.addView(principal);setContentView(sc);
        principal.addView(texto("PRISMA  /  CAJA DULCES",13,true,VERDE));
        principal.addView(texto("El Kiosquito",30,true,AZUL));
        principal.addView(texto("Escanea un dulce o agrégalo tocando su nombre",14,false,0xff53657b));
        TextView valor=texto(clp(total()),35,true,AZUL);valor.setGravity(Gravity.CENTER);principal.addView(valor);
        TextView n=texto(unidades()+" unidades · "+carrito.size()+" productos diferentes",13,false,0xff607187);n.setGravity(Gravity.CENTER);principal.addView(n);
        LinearLayout r=horizontal();
        Button cam=boton("📷 Escanear cámara",v->iniciarEscaneo());r.addView(cam,new LinearLayout.LayoutParams(0,dp(55),1));
        principal.addView(r);
        Switch sw=new Switch(this);sw.setText("Continuar escaneando hasta cancelar");sw.setTextSize(13);sw.setChecked(continuo);sw.setOnCheckedChangeListener((v,c)->continuo=c);principal.addView(sw);
        LinearLayout inputRow=horizontal();entradaCodigo=new EditText(this);entradaCodigo.setSingleLine(true);entradaCodigo.setTextSize(15);
        entradaCodigo.setHint("Código EAN / pistola Bluetooth");entradaCodigo.setInputType(InputType.TYPE_CLASS_TEXT);
        entradaCodigo.setImeOptions(EditorInfo.IME_ACTION_DONE);
        entradaCodigo.setOnEditorActionListener((v,action,event)->{if(action==EditorInfo.IME_ACTION_DONE||(event!=null&&event.getKeyCode()==KeyEvent.KEYCODE_ENTER&&event.getAction()==KeyEvent.ACTION_DOWN)){procesarCodigo(entradaCodigo.getText().toString());entradaCodigo.setText("");return true;}return false;});
        inputRow.addView(entradaCodigo,new LinearLayout.LayoutParams(0,dp(52),1));
        inputRow.addView(boton("Agregar",v->{String s=entradaCodigo.getText().toString();entradaCodigo.setText("");procesarCodigo(s);}),new LinearLayout.LayoutParams(dp(100),dp(52)));principal.addView(inputRow);
        separador();principal.addView(texto("VENTA ACTUAL",20,true,AZUL));
        if(carrito.isEmpty())principal.addView(texto("El carrito está vacío. Cada lectura sumará 1 unidad.",14,false,0xff6b7280));
        else for(Map.Entry<String,Integer> e:new ArrayList<>(carrito.entrySet())){
            Producto p=buscar(e.getKey());if(p==null)continue;
            LinearLayout fila=horizontal();LinearLayout info=new LinearLayout(this);info.setOrientation(LinearLayout.VERTICAL);
            info.addView(texto(p.nombre,15,true,AZUL));info.addView(texto(clp(p.precio)+" × "+e.getValue()+" = "+clp((long)p.precio*e.getValue()),13,false,0xff475569));
            fila.addView(info,new LinearLayout.LayoutParams(0,-2,1));
            fila.addView(boton("−",v->cambiarCantidad(p,-1)),new LinearLayout.LayoutParams(dp(46),dp(52)));
            fila.addView(boton("+",v->cambiarCantidad(p,1)),new LinearLayout.LayoutParams(dp(46),dp(52)));
            principal.addView(fila);
        }
        Button terminar=boton("FINALIZAR VENTA · "+clp(total()),v->confirmarVenta());terminar.setEnabled(!carrito.isEmpty());principal.addView(terminar,new LinearLayout.LayoutParams(-1,dp(58)));
        LinearLayout acciones=horizontal();acciones.addView(boton("Historial / boletas",v->historial()),new LinearLayout.LayoutParams(0,dp(52),1));
        acciones.addView(boton("Vaciar carrito",v->new AlertDialog.Builder(this).setTitle("¿Vaciar venta?").setNegativeButton("Cancelar",null).setPositiveButton("Vaciar",(d,w)->{carrito.clear();guardar();pintar();}).show()),new LinearLayout.LayoutParams(0,dp(52),1));principal.addView(acciones);
        separador();principal.addView(texto("CATÁLOGO · TOCA PARA SUMAR",20,true,AZUL));
        principal.addView(texto("Mantén pulsado un producto para editar precio y asociar códigos de barras.",13,false,0xff64748b));
        for(Producto p:productos){
            LinearLayout fila=horizontal();LinearLayout nombre=new LinearLayout(this);nombre.setOrientation(LinearLayout.VERTICAL);
            nombre.addView(texto(p.nombre,15,true,AZUL));nombre.addView(texto(p.codigos.isEmpty()?"Sin código asignado":"EAN: "+p.codigos.get(0),11,false,0xff64748b));
            fila.addView(nombre,new LinearLayout.LayoutParams(0,dp(61),1));
            fila.addView(texto(clp(p.precio),16,true,VERDE));
            fila.setOnClickListener(v->agregar(p));fila.setOnLongClickListener(v->{editar(p);return true;});principal.addView(fila);
        }
        principal.addView(boton("Editar catálogo y códigos",v->seleccionarParaEditar()));
        principal.addView(texto("Comprobantes internos NO tributarios. No reemplazan la boleta electrónica del SII.",12,false,0xff9a5b24));
    }
    private void iniciarEscaneo(){
        if(leyendo)return;
        leyendo=true;
        GmsBarcodeScannerOptions opciones=new GmsBarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_EAN_13,Barcode.FORMAT_EAN_8,Barcode.FORMAT_UPC_A,Barcode.FORMAT_UPC_E,Barcode.FORMAT_CODE_128)
                .enableAutoZoom().build();
        GmsBarcodeScanner scan=GmsBarcodeScanning.getClient(this,opciones);
        scan.startScan().addOnSuccessListener(b->{
            leyendo=false;
            String codigo=b.getRawValue();
            boolean conocido=buscarCodigo(limpiar(codigo))!=null;
            procesarCodigo(codigo);
            if(continuo&&conocido)handler.postDelayed(()->{if(continuo&&!isFinishing())iniciarEscaneo();},650);
        }).addOnCanceledListener(()->{leyendo=false;continuo=false;aviso("Escaneo detenido");})
          .addOnFailureListener(ex->{leyendo=false;continuo=false;new AlertDialog.Builder(this).setTitle("No se pudo abrir la cámara")
                  .setMessage("Comprueba Google Play Services o usa una pistola Bluetooth / ingreso manual.\n"+ex.getMessage())
                  .setPositiveButton("Entendido",null).show();});
    }
    private void procesarCodigo(String crudo){
        String codigo=limpiar(crudo);if(codigo.isEmpty())return;
        Producto p=buscarCodigo(codigo);
        if(p!=null){agregar(p);return;}
        if(!codigoValido(codigo)){new AlertDialog.Builder(this).setTitle("Código no válido")
            .setMessage("No se reconoce un EAN/UPC válido. Revisa dígitos y vuelve a escanear: "+codigo)
            .setPositiveButton("Aceptar",null).show();return;}
        String[] opciones=new String[productos.size()];for(int i=0;i<productos.size();i++)opciones[i]=productos.get(i).nombre+" · "+clp(productos.get(i).precio);
        new AlertDialog.Builder(this).setTitle("Código nuevo: "+codigo)
                .setMessage("Confirma el producto que TIENES EN LA MANO. No asocies el código de una caja completa con un dulce individual.")
                .setItems(opciones,(d,which)->{
                    Producto seleccionado=productos.get(which);
                    if(!seleccionado.codigos.contains(codigo))seleccionado.codigos.add(codigo);
                    guardar();agregar(seleccionado);
                }).setNegativeButton("Cancelar",null).show();
    }
    private static boolean codigoValido(String c){
        if(!c.matches("[0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14}"))return false;
        int sum=0,m=3;for(int i=c.length()-2;i>=0;i--){sum+=(c.charAt(i)-'0')*m;m=(m==3?1:3);}
        return (10-sum%10)%10==c.charAt(c.length()-1)-'0';
    }
    private void seleccionarParaEditar(){String[] o=new String[productos.size()];for(int i=0;i<o.length;i++)o[i]=productos.get(i).nombre;
        new AlertDialog.Builder(this).setTitle("Editar producto").setItems(o,(d,i)->editar(productos.get(i))).setNegativeButton("Cancelar",null).show();}
    private void editar(Producto p){
        LinearLayout form=new LinearLayout(this);form.setOrientation(LinearLayout.VERTICAL);form.setPadding(dp(22),dp(4),dp(22),0);
        TextView ayuda=texto("Precio unitario (CLP) y códigos EAN separados por coma. Si no tiene código individual, puedes dejar el campo vacío.",13,false,AZUL);form.addView(ayuda);
        EditText precio=new EditText(this);precio.setHint("Precio de venta");precio.setInputType(InputType.TYPE_CLASS_NUMBER);precio.setText(String.valueOf(p.precio));form.addView(precio);
        EditText codigo=new EditText(this);codigo.setHint("Códigos de barra separados por coma");codigo.setSingleLine(false);codigo.setMinLines(2);codigo.setText(android.text.TextUtils.join(",",p.codigos));form.addView(codigo);
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Editar: "+p.nombre).setView(form).setNegativeButton("Cancelar",null)
          .setPositiveButton("Guardar",null).create();dialog.setOnShowListener(e->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{try{
                int nuevo=Integer.parseInt(precio.getText().toString().trim());if(nuevo<0||nuevo>10000000)throw new IllegalArgumentException("Precio fuera de rango");
                ArrayList<String> nuevos=new ArrayList<>();
                for(String c:codigo.getText().toString().split(",")){String s=limpiar(c);if(s.isEmpty())continue;
                    if(!codigoValido(s))throw new IllegalArgumentException("Código inválido: "+s);
                    Producto otro=buscarCodigo(s);if(otro!=null&&otro!=p)throw new IllegalArgumentException("Ese código ya pertenece a "+otro.nombre);
                    if(!nuevos.contains(s))nuevos.add(s);
                }
                p.precio=nuevo;p.codigos=nuevos;guardar();dialog.dismiss();pintar();
            }catch(Exception ex){new AlertDialog.Builder(this).setTitle("Revisar datos").setMessage(ex.getMessage()).setPositiveButton("Aceptar",null).show();}
        }));dialog.show();
    }
    private void confirmarVenta(){if(carrito.isEmpty())return;
        new AlertDialog.Builder(this).setTitle("¿Finalizar venta?")
          .setMessage(unidades()+" unidades\nTotal: "+clp(total())+"\n\nSe creará un comprobante PDF no tributario y la venta quedará guardada en el historial.")
          .setNegativeButton("Volver",null).setPositiveButton("Crear boleta",(d,w)->finalizar()).show();}
    private JSONObject hacerVenta(int numero) throws JSONException{
        JSONObject venta=new JSONObject();venta.put("numero",numero);venta.put("fecha",fecha());
        JSONArray items=new JSONArray();
        for(Map.Entry<String,Integer> e:carrito.entrySet()){Producto p=buscar(e.getKey());if(p!=null){
            items.put(new JSONObject().put("nombre",p.nombre).put("precio",p.precio).put("cantidad",e.getValue()));
        }}
        venta.put("items",items);venta.put("total",total());return venta;
    }
    private void finalizar(){
        try {
            int numero=prefs.getInt("numero",0)+1;
            JSONObject venta=hacerVenta(numero);
            File pdf=crearPdf(venta);
            JSONArray historia=new JSONArray(prefs.getString("historial","[]"));historia.put(venta);
            // commit sincrónico; no se borra el carrito si falla guardar la operación.
            if(!prefs.edit().putInt("numero",numero).putString("historial",historia.toString()).putString("carrito","[]").commit()) throw new Exception("No fue posible guardar la venta");
            carrito.clear();pintar();compartir(pdf);
        }catch(Exception e){new AlertDialog.Builder(this).setTitle("Venta no finalizada").setMessage(e.getMessage()).setPositiveButton("Aceptar",null).show();}
    }
    private void historial(){
        try{JSONArray h=new JSONArray(prefs.getString("historial","[]"));if(h.length()==0){aviso("Todavía no hay ventas");return;}
            String[] opciones=new String[h.length()];
            for(int i=0;i<h.length();i++){JSONObject v=h.getJSONObject(h.length()-1-i);opciones[i]="#"+v.getInt("numero")+" · "+v.getString("fecha")+" · "+clp(v.getLong("total"));}
            new AlertDialog.Builder(this).setTitle("Historial de ventas").setItems(opciones,(d,i)->{
                try{compartir(crearPdf(h.getJSONObject(h.length()-1-i)));}catch(Exception ex){aviso("Error al regenerar PDF: "+ex.getMessage());}
            }).setPositiveButton("Cerrar",null).show();
        }catch(Exception e){aviso("Error leyendo historial");}
    }
    private static void linea(Canvas c,Paint paint,String s,int x,int y,int tamaño,boolean negrita){paint.setTextSize(tamaño);paint.setTypeface(negrita?Typeface.create(Typeface.MONOSPACE,Typeface.BOLD):Typeface.MONOSPACE);c.drawText(s,x,y,paint);}
    private File crearPdf(JSONObject v) throws Exception{
        JSONArray items=v.getJSONArray("items");
        int ancho=420,alto=Math.max(580,390+items.length()*55);
        PdfDocument doc=new PdfDocument();PdfDocument.Page page=doc.startPage(new PdfDocument.PageInfo.Builder(ancho,alto,1).create());
        Canvas c=page.getCanvas();c.drawColor(Color.WHITE);Paint p=new Paint(3);p.setColor(Color.BLACK);
        int y=38;linea(c,p,"EL KIOSQUITO",26,y,25,true);y+=30;
        linea(c,p,"PRISMA CAJA - COMPROBANTE",26,y,14,true);y+=30;
        linea(c,p,"Venta #"+v.getInt("numero"),26,y,16,true);y+=24;
        linea(c,p,v.getString("fecha"),26,y,14,false);y+=25;
        c.drawLine(22,y,396,y,p);y+=23;
        linea(c,p,"PRODUCTO",24,y,14,true);linea(c,p,"CANT.   IMPORTE",215,y,13,true);y+=22;
        for(int i=0;i<items.length();i++){
            JSONObject it=items.getJSONObject(i);String nombre=it.getString("nombre");int cant=it.getInt("cantidad"),pr=it.getInt("precio");
            if(nombre.length()>26)nombre=nombre.substring(0,26);
            linea(c,p,nombre,24,y,14,true);y+=20;
            linea(c,p,clp(pr)+" c/u",24,y,13,false);
            linea(c,p,cant+" x   "+clp((long)cant*pr),231,y,13,false);y+=34;
        }
        c.drawLine(22,y,396,y,p);y+=28;
        linea(c,p,"TOTAL: "+clp(v.getLong("total")),24,y,22,true);y+=35;
        linea(c,p,"¡Gracias por tu compra!",24,y,14,false);y+=30;
        linea(c,p,"COMPROBANTE NO TRIBUTARIO",24,y,13,true);y+=20;
        linea(c,p,"No reemplaza boleta del SII",24,y,12,false);
        doc.finishPage(page);
        File dir=new File(getCacheDir(),"boletas");if(!dir.exists()&&!dir.mkdirs())throw new Exception("No se pudo preparar carpeta de boletas");
        File destino=new File(dir,"prisma_boleta_"+v.getInt("numero")+".pdf");
        try(FileOutputStream out=new FileOutputStream(destino)){doc.writeTo(out);}finally{doc.close();}
        return destino;
    }
    private void compartir(File archivo){
        try { Uri uri=FileProvider.getUriForFile(this,getPackageName()+".boletas.fileprovider",archivo);
            Intent in=new Intent(Intent.ACTION_SEND);in.setType("application/pdf");in.putExtra(Intent.EXTRA_STREAM,uri);
            in.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);startActivity(Intent.createChooser(in,"Compartir boleta PDF"));
        }catch(Exception e){aviso("PDF guardado, pero no se pudo compartir: "+e.getMessage());}
    }
}
