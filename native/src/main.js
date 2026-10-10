import {Capacitor, CapacitorHttp} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {Preferences} from '@capacitor/preferences';
import {Filesystem,Directory} from '@capacitor/filesystem';
import {FileTransfer} from '@capacitor/file-transfer';
import {Share} from '@capacitor/share';
import {brandId,publicLogo,brandPage,deepLink} from './safety.mjs';
import './style.css';
const $=id=>document.getElementById(id);let saved={},rows=[],selected=null,mode='all',searchSeq=0,hasMore=false,loading=false,activeQuery="";
const assetHeaders={Referer:'https://semologo.com/',Origin:'https://semologo.com'};
const imageCache=new Map();let imageWorkers=0;const imageQueue=[];
async function imageData(b){const url=logo(b);if(imageCache.has(url))return imageCache.get(url);if(!Capacitor.isNativePlatform())return url;const job=(async()=>{if(imageWorkers>=4)await new Promise(resolve=>imageQueue.push(resolve));imageWorkers++;try{const r=await CapacitorHttp.get({url,headers:assetHeaders,responseType:'arraybuffer',connectTimeout:10000,readTimeout:15000});if(r.status!==200||typeof r.data!=='string'||r.data.length>12_000_000||!r.data.startsWith('iVBORw0KGgo'))throw Error('invalid PNG');return 'data:image/png;base64,'+r.data;}finally{imageWorkers--;imageQueue.shift()?.();}})();imageCache.set(url,job);if(imageCache.size>64)imageCache.delete(imageCache.keys().next().value);try{return await job;}catch(e){imageCache.delete(url);throw e;}}
const imageTokens=new WeakMap();
async function showImage(el,b){const token=Symbol();imageTokens.set(el,token);el.classList.toggle('dark-logo',b.presentation?.bg==='dark'||b.light===true||b.light_logo===true);el.hidden=false;el.removeAttribute('src');try{const src=await imageData(b);if(el.isConnected&&imageTokens.get(el)===token)el.src=src;}catch{if(imageTokens.get(el)===token)el.hidden=true;}}
const status=message=>{$('status').textContent=message;};
const name=b=>b.name_ko||b.name_en||b.id;
function logo(b){return [b.preview_png,b.logo_png].map(publicLogo).find(u=>u&&new URL(u).pathname.endsWith('.png'))|| (brandId(b.id)?`https://semologo.com/api/logo-preview/?id=${encodeURIComponent(b.id)}`:null);}
async function load(append=false){append=append===true;if(append&&loading)return;if(!append)activeQuery=$("query").value.trim();const seq=++searchSeq;loading=true;$('more').disabled=true;status('로고를 불러오고 있어요.');$('retry').hidden=true;
 try {const url=`https://semologo.com/api/catalog/?limit=24&offset=${append?rows.length:0}&q=${encodeURIComponent(activeQuery)}`;const r=Capacitor.isNativePlatform()?await CapacitorHttp.get({url,connectTimeout:10000,readTimeout:15000}):await fetch(url).then(async r=>({status:r.status,data:await r.json()}));if(r.status!==200||!Array.isArray(r.data.brands))throw Error();if(seq!==searchSeq)return;const incoming=r.data.brands.filter(b=>brandId(b.id));rows=append?[...rows,...incoming.filter(b=>!rows.some(old=>old.id===b.id))]:incoming;hasMore=r.data.hasMore===true;render();}
 catch {if(seq!==searchSeq)return;status('로고를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.');$('retry').hidden=false;}
 finally{if(seq===searchSeq){loading=false;$('more').disabled=false;}}}
function render(){const shown=mode==='saved'?Object.values(saved):rows;$('more').hidden=mode==='saved'||!hasMore;$('grid').replaceChildren();status(shown.length?`${shown.length}개 로고`:(mode==='saved'?'저장한 로고가 아직 없어요. 브랜드를 열어 내 기기에 저장해 보세요.':'검색 결과가 없어요. 다른 브랜드 이름으로 찾아보세요.'));
 for(const b of shown){const button=document.createElement('button');button.className='card';const image=document.createElement('img');showImage(image,b);image.alt='';image.loading='lazy';image.addEventListener('error',()=>{image.hidden=true;});const label=document.createElement('span');label.textContent=name(b);button.append(image,label);button.onclick=()=>detail(b);$('grid').append(button);}}
function detail(b){selected=b;$('title').textContent=name(b);showImage($('preview'),b);$('preview').alt=name(b)+' 로고';$('detail-status').textContent='';$('favorite').textContent=saved[b.id]?'내 기기에서 제거':'내 기기에 저장';if(!$('detail').open)$('detail').showModal();}
let busy=false;
async function act(fn){if(busy)return;busy=true;for(const button of document.querySelectorAll('.actions button'))button.disabled=true;try{$('detail-status').textContent='처리하고 있어요.';await fn();$('detail-status').textContent='';}catch{$('detail-status').textContent='완료하지 못했어요. 연결을 확인하고 다시 시도해 주세요.';}finally{busy=false;for(const button of document.querySelectorAll('.actions button'))button.disabled=false;}}
$('search').onsubmit=e=>{e.preventDefault();mode='all';toggle();load();};$('retry').onclick=load;
function toggle(){$('all').setAttribute('aria-pressed',String(mode==='all'));$('saved').setAttribute('aria-pressed',String(mode==='saved'));}
$('all').onclick=()=>{mode='all';toggle();render();};$('saved').onclick=()=>{mode='saved';toggle();render();};
$('more').onclick=()=>load(true);
$('privacy').onclick=()=>Browser.open({url:'https://semologo.com/privacy/'});
$('terms').onclick=()=>Browser.open({url:'https://semologo.com/terms/'});
$('close').onclick=()=>$('detail').close();$('website').onclick=()=>Browser.open({url:'https://semologo.com/'});
$('favorite').onclick=()=>act(async()=>{const b=selected;if(saved[b.id])delete saved[b.id];else saved[b.id]={id:b.id,name_ko:name(b),preview_png:publicLogo(b.preview_png)||undefined,light:b.light===true,light_logo:b.light_logo===true,presentation:{bg:b.presentation?.bg==='dark'?'dark':'light'}};await Preferences.set({key:'semologo-saved-v1',value:JSON.stringify(saved)});detail(b);render();});
$('share').onclick=()=>act(()=>Share.share({title:name(selected),url:brandPage(selected.id)}));
$('open').onclick=()=>act(()=>Browser.open({url:brandPage(selected.id)}));
$('download').onclick=()=>act(async()=>{const b=selected;const url=logo(b);if(!url)throw Error('missing PNG');if(!Capacitor.isNativePlatform()){await Browser.open({url});return;}const path=`semologo-${brandId(b.id)}.png`;const {uri}=await Filesystem.getUri({directory:Directory.Cache,path});try{await FileTransfer.downloadFile({url,path:uri,headers:assetHeaders});const stat=await Filesystem.stat({directory:Directory.Cache,path});if(stat.size>9_000_000)throw Error('PNG too large');const bytes=await Filesystem.readFile({directory:Directory.Cache,path});if(typeof bytes.data!=='string'||!bytes.data.startsWith('iVBORw0KGgo'))throw Error('invalid PNG');await Share.share({title:name(b),files:[uri]});}finally{await Filesystem.deleteFile({directory:Directory.Cache,path}).catch(()=>{});}});
try{const {value}=await Preferences.get({key:'semologo-saved-v1'});const parsed=JSON.parse(value||'{}');for(const [id,b] of Object.entries(parsed))if(brandId(id)&&b&&b.id===id)saved[id]=b;}catch{status('저장한 목록을 읽지 못했어요.');}
if(Capacitor.isNativePlatform())await App.addListener('appUrlOpen',({url})=>{const id=deepLink(url);if(id)Browser.open({url:brandPage(id)});});
if(Capacitor.getPlatform()==='android')await App.addListener('backButton',({canGoBack})=>{if($('detail').open)$('detail').close();else if(canGoBack)history.back();else App.exitApp();});
load();
