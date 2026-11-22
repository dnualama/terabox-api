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
.controls{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.controls button{flex:1 1 30%;margin:0;background:#303744;color:var(--text);border:1px solid #414b5b}
.controls button.active{background:var(--accent);color:#071711;border-color:var(--accent)}
.now-playing{color:var(--muted);font-size:13px;margin:8px 0;overflow-wrap:anywhere}
.file{display:block;width:100%;text-align:left;background:#252b35;color:var(--text);margin:7px 0;padding:12px;overflow-wrap:anywhere}.file.active{outline:2px solid var(--accent)}
#files{max-height:42vh;overflow:auto}
@media(min-width:900px){
body{padding:24px}
main{max-width:1440px;padding:10px 0 40px}
h1{font-size:32px}
.sub{margin-bottom:24px}
.card:first-of-type{padding:22px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px 18px;align-items:end}
.card:first-of-type label{margin:0;align-self:end}
.card:first-of-type label[for="key"]{grid-column:1;grid-row:1}
.card:first-of-type #key{grid-column:1;grid-row:2}
.card:first-of-type label[for="link"]{grid-column:2;grid-row:1}
.card:first-of-type #link{grid-column:2;grid-row:2}
.card:first-of-type label[for="pwd"]{grid-column:2;grid-row:3}
.card:first-of-type #pwd{grid-column:2;grid-row:4}
.card:first-of-type #resolve{grid-column:1;grid-row:3}
.card:first-of-type #status{grid-column:1/-1}
.card:nth-of-type(2){display:grid;grid-template-columns:minmax(0,2.2fr) minmax(300px,1fr);grid-template-areas:"now files" "video files" "controls files";gap:14px;padding:18px;align-items:start}
#nowPlaying{grid-area:now;margin:0;font-size:15px;color:var(--text);font-weight:600}
video{grid-area:video;width:100%;max-height:none;aspect-ratio:16/9;object-fit:contain;margin:0}
.controls{grid-area:controls;margin:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
.controls button{padding:12px 8px}
#files{grid-area:files;max-height:calc(100vh - 270px);min-height:450px;overflow:auto;border-left:1px solid var(--line);padding-left:14px}
.file{margin:0 0 8px;padding:13px;background:#252b35;border:1px solid var(--line);font-size:14px}
.file.active{background:#203b36;border-color:var(--accent)}
}
@media(min-width:1200px){
.card:nth-of-type(2){grid-template-columns:minmax(0,2.5fr) minmax(340px,1fr)}
.controls{grid-template-columns:repeat(5,minmax(0,1fr))}
}
@media(max-width:899px){.card:first-of-type{display:block}}
</style>
</head><body><main>
<h1>CloudPlayer</h1><p class="sub">Reproduce vídeos compartidos de TeraBox</p>
<section class="card">
${authRequired ? '<label for="key">Clave API</label><input id="key" type="password" autocomplete="off" placeholder="Tu API key de Cloudflare">' : ''}
<label for="link">Enlace de TeraBox</label><input id="link" type="url" placeholder="Pega aquí el enlace de la carpeta o vídeo">
<label for="pwd">Código de extracción (si lo necesita)</label><input id="pwd" type="text" placeholder="Opcional">
<button id="resolve">Cargar vídeos</button><div id="status"></div>
</section>
<section class="card">
<div class="now-playing" id="nowPlaying">Ningún vídeo seleccionado</div>
<video id="video" controls playsinline preload="metadata"></video>
<div class="controls">
<button id="previous" type="button">⏮ Anterior</button>
<button id="next" type="button">Siguiente ⏭</button>
<button id="shuffle" type="button" aria-pressed="false">⇄ Aleatorio: OFF</button>
<button id="lucky" type="button">🍀 Voy a tener suerte</button>
<button id="repeat" type="button" aria-pressed="false">↻ Repetir: OFF</button>
</div>
<div id="files"></div></section>
<script>
const $=id=>document.getElementById(id);
// Remember the personal API key in this browser only; never persist TeraBox passwords.
const API_KEY_STORAGE='cloudplayer_api_key';
if($('key')){
  try{$('key').value=localStorage.getItem(API_KEY_STORAGE)||'';}catch{}
  $('key').addEventListener('input',()=>{
    try{const value=$('key').value.trim();if(value)localStorage.setItem(API_KEY_STORAGE,value);else localStorage.removeItem(API_KEY_STORAGE);}catch{}
  });
}
let hls=null,current=null,files=[],playlist=[],queue=[],shuffle=false,repeatMode='off',history=[],historyCursor=-1;
const videoFiles=()=>files.filter(f=>f.category==='video');
function addKey(params){const k=$('key')?.value.trim();if(k)params.set('key',k);return params}
function keyed(raw){const k=$('key')?.value.trim();if(!k)return raw;const u=new URL(raw);u.searchParams.set('key',k);return u.toString()}
function status(t){$('status').textContent=t}
function shuffleArray(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function refillQueue(){queue=shuffleArray(playlist.filter(f=>!current||f.fs_id!==current.fs_id))}
function updateControls(){
  $('shuffle').classList.toggle('active',shuffle);
  $('shuffle').textContent='⇄ Aleatorio: '+(shuffle?'ON':'OFF');
  $('shuffle').setAttribute('aria-pressed',String(shuffle));
  $('repeat').classList.toggle('active',repeatMode!=='off');
  $('repeat').textContent='↻ Repetir: '+({off:'OFF',one:'VÍDEO',all:'LISTA'}[repeatMode]);
  $('repeat').setAttribute('aria-pressed',String(repeatMode!=='off'));
}
function markCurrent(){
  document.querySelectorAll('.file').forEach(b=>b.classList.toggle('active',b.dataset.id===current?.fs_id));
  $('nowPlaying').textContent=current?current.file_name:'Ningún vídeo seleccionado';
}
function play(f,autoplay=true,record=true){
  if(!f)return;
  if(record){
    if(historyCursor<history.length-1)history=history.slice(0,historyCursor+1);
    if(history[history.length-1]?.fs_id!==f.fs_id)history.push(f);
    historyCursor=history.length-1;
  }
  current=f;
  if(hls){hls.destroy();hls=null}
  const v=$('video');v.pause();v.removeAttribute('src');v.load();
  markCurrent();
  const native=['video/mp4','video/webm','video/quicktime'].includes(f.mime_type);
  if(f.hls_url&&!native){
    const url=keyed(f.hls_url);
    if(v.canPlayType('application/vnd.apple.mpegurl'))v.src=url;
    else if(window.Hls&&Hls.isSupported()){hls=new Hls();hls.loadSource(url);hls.attachMedia(v)}
    else{v.src=keyed(f.stream_url);status('Este navegador no soporta HLS. Probando stream directo…')}
  }else v.src=keyed(f.stream_url);
  if(autoplay)v.play().catch(()=>status('Vídeo cargado. Pulsa ▶ para reproducir.'));
}
function nextVideo(manual=false){
  if(!playlist.length)return;
  if(repeatMode==='one'&&!manual&&current){play(current);return}
  let next=null;
  if(shuffle){
    if(!queue.length)refillQueue();
    next=queue.shift()||null;
  }else{
    const index=playlist.findIndex(f=>f.fs_id===current?.fs_id);
    if(index>=0&&index<playlist.length-1)next=playlist[index+1];
    else if(repeatMode==='all')next=playlist[0];
  }
  if(next)play(next);
  else if(!manual)status('Has llegado al final de la lista.');
}
function previousVideo(){
  if(historyCursor>0){historyCursor--;play(history[historyCursor],true,false);return}
  const index=playlist.findIndex(f=>f.fs_id===current?.fs_id);
  if(!shuffle&&index>0)play(playlist[index-1]);
  else if(!shuffle&&repeatMode==='all'&&playlist.length)play(playlist[playlist.length-1]);
}
function toggleShuffle(){
  shuffle=!shuffle;
  if(shuffle)refillQueue();else queue=[];
  updateControls();
}
function lucky(){
  playlist=videoFiles();
  if(!playlist.length){status('Primero carga una carpeta con vídeos.');return}
  shuffle=true;repeatMode='off';history=[];historyCursor=-1;refillQueue();
  const chosen=queue.shift()||playlist[Math.floor(Math.random()*playlist.length)];
  updateControls();play(chosen);
  status('¡A la suerte! Reproducción aleatoria activada, sin repetir hasta completar la lista.');
}
function render(){
  const box=$('files');box.innerHTML='';playlist=videoFiles();
  playlist.forEach(f=>{
    const b=document.createElement('button');b.className='file';b.type='button';
    b.textContent=f.file_name+' · '+f.file_size;b.dataset.id=f.fs_id;
    b.onclick=()=>{if(shuffle)queue=queue.filter(item=>item.fs_id!==f.fs_id);play(f)};
    box.appendChild(b);
  });
  if(!box.children.length)status('No se han encontrado vídeos en este enlace.');
  markCurrent();updateControls();
}
function cycleRepeat(){repeatMode=({off:'all',all:'one',one:'off'})[repeatMode];updateControls()}
async function resolve(){
  const link=$('link').value.trim();
  if(!link){status('Pega primero un enlace de TeraBox.');return}
  const p=new URLSearchParams({link});const pwd=$('pwd').value.trim();
  if(pwd)p.set('password',pwd);addKey(p);
  $('resolve').disabled=true;status('Buscando vídeos…');$('files').innerHTML='';
  try{
    const r=await fetch('/api/resolve?'+p);const data=await r.json();
    if(!r.ok){status('Error: '+(data.error?.message||data.error?.code||r.status));return}
    files=data.files||[];current=null;queue=[];shuffle=false;repeatMode='off';history=[];historyCursor=-1;
    status('Encontrados '+videoFiles().length+' vídeos.');render();
    if(playlist.length)play(playlist[0]);
  }catch(e){status('No se pudo conectar: '+e.message)}
  finally{$('resolve').disabled=false}
}
$('resolve').onclick=resolve;
$('link').addEventListener('keydown',e=>{if(e.key==='Enter')resolve()});
$('previous').onclick=previousVideo;$('next').onclick=()=>nextVideo(true);
$('shuffle').onclick=toggleShuffle;$('lucky').onclick=lucky;$('repeat').onclick=cycleRepeat;
$('video').addEventListener('ended',()=>nextVideo(false));
updateControls();
</script></main></body></html>`;
}
