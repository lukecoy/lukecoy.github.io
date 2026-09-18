import createTetris from './tetris.js';
const canvas=document.querySelector('canvas'), status=document.querySelector('#status');
const ctx=canvas.getContext('2d',{alpha:false});
const now=()=>performance.now()/1000;
let game, audio, gain, ambience, unlocked=false, unlocking=false, focused=true, stopped=false;
const buffers=new Map();
function fit(){
  const box=canvas.parentElement.getBoundingClientRect(), dpr=devicePixelRatio||1;
  const available=Math.min((box.width-24)*dpr/800,(box.height-24)*dpr/572);
  const scale=available>=1?Math.floor(available):Math.max(.01,available);
  canvas.style.width=`${800*scale/dpr}px`;canvas.style.height=`${572*scale/dpr}px`;
}
new ResizeObserver(fit).observe(canvas.parentElement);addEventListener('resize',fit);
function syncAudio(){if(gain)gain.gain.value=focused&&!stopped&&!game._web_muted()?1:0;}
function play(name){if(!unlocked||!buffers.has(name)||game._web_muted())return;
  const source=audio.createBufferSource();source.buffer=buffers.get(name);source.connect(gain);source.start();}
async function unlock(){
  if(!audio||unlocked||unlocking||!buffers.has("ambience"))return;
  unlocking=true;
  try{await audio.resume();unlocked=true;
    ambience=audio.createBufferSource();ambience.buffer=buffers.get('ambience');ambience.loop=true;
    ambience.connect(gain);ambience.start();syncAudio();play('beep');
  }catch{status.textContent='Audio unavailable. The game can still be played.';}finally{unlocking=false;}
}
function effects(flags){
  if(flags&8)syncAudio();if(flags&4)play('beep');if(flags&2)play('space');
  if(flags&1)play(`key${1+Math.floor(Math.random()*4)}`);
  if(flags&16){stopped=true;syncAudio();status.textContent='Game ended. Type a level number or reload to play again.';}
}
function key(code,repeat=false){
  if(!game)return;
  if(stopped){if(code<48||code>57)return;stopped=false;game._web_init(now());syncAudio();}
  effects(game._web_key(code,repeat?1:0,now()));
}
function focus(){focused=!document.hidden&&document.hasFocus();if(game)game._web_focus(focused?1:0,now());syncAudio();}
addEventListener('blur',focus);addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
addEventListener('keydown',e=>{
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  const mapped={ArrowLeft:'7',ArrowRight:'9',ArrowUp:'8',Escape:'\x1b'};
  const k=mapped[e.key]||(e.key.length===1?e.key.toUpperCase():'');
  if(e.key==='ArrowDown'){e.preventDefault();return;}
  if(!k)return;e.preventDefault();void unlock();
  key(k.charCodeAt(0),e.repeat);
});
canvas.addEventListener('pointerdown',()=>{canvas.focus();void unlock();});
async function bytes(path){const r=await fetch(path);if(!r.ok)throw Error(`Could not load ${path}`);return r.arrayBuffer();}
try{
  game=await createTetris();
  const font=new Uint8Array(await bytes('graphics/chargen-15ie.bin'));
  if(font.length!==2048)throw Error('Invalid terminal font');
  game.HEAPU8.set(font,game._web_font());game._web_init(now());
  try{
    audio=new AudioContext();gain=audio.createGain();gain.connect(audio.destination);gain.gain.value=0;
    await Promise.all(['key1','key2','key3','key4','space','beep','ambience'].map(async name=>{
      buffers.set(name,await audio.decodeAudioData(await bytes(`assets/${name}.wav`)));}));
    status.textContent='Press a level 0–9 to start. M enables sound.';
  }catch{audio=null;status.textContent='Sound unavailable · Press 0–9 to play';}
  // Same two-stage session polling as macOS, with a separate event-loop turn
  // between polls. Browser timer scheduling is not original hardware timing.
  setInterval(()=>{if(!stopped)effects(game._web_tick(now()));},1000/120);
  function draw(){const ptr=game._web_frame();ctx.putImageData(new ImageData(new Uint8ClampedArray(game.HEAPU8.buffer,ptr,800*286*4),800,286),0,0);requestAnimationFrame(draw);}
  status.hidden=true;
  focus();fit();draw();
}catch(error){status.hidden=false;status.textContent=`Unable to load Tetris: ${error.message}. Serve web/dist over HTTP; see web/README.md.`;console.error(error);}
