/**
 * CloudPlayer — mobile-first playback UI served by the Worker at /player.
 */
export function playerPage(authRequired: boolean): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>CloudPlayer</title>
<script src="https://cdn.jsdelivr.net/npm/hls.js@1"></script>
<style>
:root{color-scheme:dark;--bg:#101217;--panel:#1b1f27;--line:#303744;--text:#f2f4f8;--muted:#9ca6b5;--accent:#55e6c1}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px system-ui,-apple-system,Segoe UI,sans-serif;padding:env(safe-area-inset-top) 14px env(safe-area-inset-bottom)}
main{max-width:850px;margin:auto;padding:18px 0 32px}h1{font-size:25px;margin:0}.sub{color:var(--muted);margin:5px 0 18px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px;margin:12px 0}
label{display:block;color:var(--muted);font-size:13px;margin:10px 0 5px}input{width:100%;padding:13px;border-radius:10px;border:1px solid var(--line);background:#101319;color:var(--text);font-size:16px}
button{border:0;border-radius:10px;background:var(--accent);color:#071711;font-weight:700;padding:13px 16px;font-size:15px;cursor:pointer;margin-top:10px}
button:disabled{opacity:.5}#status{white-space:pre-wrap;color:var(--muted);margin-top:10px;font-size:14px}
video{width:100%;background:#000;max-height:65vh;border-radius:10px;margin-top:10px}
.file{display:block;width:100%;text-align:left;background:#252b35;color:var(--text);margin:7px 0;padding:12px;overflow-wrap:anywhere}.file.active{outline:2px solid var(--accent)}
</style>
</head><body><main>
<h1>CloudPlayer</h1><p class="sub">Reproduce vídeos compartidos de TeraBox</p>
<section class="card">
${authRequired ? '<label for="key">Clave API</label><input id="key" type="password" autocomplete="off" placeholder="Tu API key de Cloudflare">' : ''}
<label for="link">Enlace de TeraBox</label><input id="link" type="url" placeholder="Pega aquí el enlace de la carpeta o vídeo">
<label for="pwd">Código de extracción (si lo necesita)</label><input id="pwd" type="text" placeholder="Opcional">
<button id="resolve">Cargar vídeos</button><div id="status"></div>
</section>
<section class="card"><video id="video" controls playsinline preload="metadata"></video><div id="files"></div></section>
<script>
const $=id=>document.getElementById(id);let hls=null,current=null,files=[];
function auth(){const k=$('key')?.value.trim();return k?{Authorization:'Bearer '+k}:{}}
function keyed(raw){const k=$('key')?.value.trim();if(!k)return raw;const u=new URL(raw);u.searchParams.set('key',k);return u.toString()}
function status(t){$('status').textContent=t}
function play(f){current=f;if(hls){hls.destroy();hls=null}const v=$('video');v.pause();v.removeAttribute('src');v.load();
document.querySelectorAll('.file').forEach(b=>b.classList.toggle('active',b.dataset.id===f.fs_id));
const native=['video/mp4','video/webm','video/quicktime'].includes(f.mime_type);
if(f.hls_url&&!native){const url=keyed(f.hls_url);if(v.canPlayType('application/vnd.apple.mpegurl'))v.src=url;else if(window.Hls&&Hls.isSupported()){hls=new Hls();hls.loadSource(url);hls.attachMedia(v)}else{v.src=keyed(f.stream_url);status('Este navegador no soporta HLS. Probando stream directo…')}}else v.src=keyed(f.stream_url);
v.play().catch(()=>status('Vídeo cargado. Pulsa ▶ para reproducir.'));
}
function render(){const box=$('files');box.innerHTML='';files.filter(f=>f.category==='video').forEach(f=>{const b=document.createElement('button');b.className='file';b.textContent=f.file_name+' · '+f.file_size;b.dataset.id=f.fs_id;b.onclick=()=>play(f);box.appendChild(b)});if(!box.children.length)status('No se han encontrado vídeos en este enlace.')}
async function resolve(){const link=$('link').value.trim();if(!link){status('Pega primero un enlace de TeraBox.');return}const p=new URLSearchParams({link});const pwd=$('pwd').value.trim();if(pwd)p.set('password',pwd);$('resolve').disabled=true;status('Buscando vídeos…');$('files').innerHTML='';
try{const r=await fetch('/api/resolve?'+p,{headers:auth()});const data=await r.json();if(!r.ok){status('Error: '+(data.error?.message||data.error?.code||r.status));return}files=data.files||[];status('Encontrados '+files.filter(f=>f.category==='video').length+' vídeos.');render();const first=files.find(f=>f.category==='video');if(first)play(first)}catch(e){status('No se pudo conectar: '+e.message)}finally{$('resolve').disabled=false}}
$('resolve').onclick=resolve;$('link').addEventListener('keydown',e=>{if(e.key==='Enter')resolve()});
</script></main></body></html>`;
}
