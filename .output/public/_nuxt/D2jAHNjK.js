import{L as te,d as F,r as n,i as _,M as ne,o as O,N as V,v as S,x as t,O as oe,y as a,P as ae,Q as se,R as U,S as re,t as x,C as ie,D as ce,_ as le,z as ue}from"./8Xj-QhOb.js";const me=window.setInterval,de=te("/landscape.png"),pe=c=>(ie("data-v-154376cc"),c=c(),ce(),c),ge={class:"image-container"},ve=pe(()=>t("img",{src:de,alt:"Landscape"},null,-1)),fe=[ve],_e={class:"time-display"},he={class:"description-container"},we={key:0,class:"simulation-controls"},Te={key:1,class:"debug-info"},Se=F({__name:"LandscapeViewer",props:{currentTime:{}},emits:["update:currentTime"],async setup(c,{emit:h}){let w,l;const s=c,y=n("/images/default_seed_image.png"),$=n("");n(!1);const R=n(!1);n("");const k=n(0);n("");const m=n(!1),d=n(!1),p=n(100),T=n([]),A=_(()=>{const e=new Date(s.currentTime).getHours();return T.value[e]||"No description available"}),B=_(()=>y.value),H=_(()=>$.value),E=_(()=>new Date(s.currentTime).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:!0})),z=_(()=>new Date(s.currentTime).toISOString().split("T")[0]);function K(){const e=new Date(s.currentTime),r=(e.getHours()*3600+e.getMinutes()*60+e.getSeconds())/86400;k.value=r*100}let I=null;[w,l]=ne(()=>q()),await w,l();async function q(){try{const e="generated_descriptions.txt";console.log("Fetching descriptions from:",e);const o=await fetch(e);if(!o.ok)throw new Error(`HTTP error! status: ${o.status}`);const r=await o.text();T.value=r.split(`

`).map(g=>g.trim()),console.log("Fetched descriptions:",T.value)}catch(e){console.error("Error fetching descriptions:",e),T.value=[]}}function Q(){m.value=!m.value,m.value||M()}function X(){d.value?M():Y()}function Y(){d.value=!0,N()}function M(){d.value=!1}const j=h;function N(){if(!d.value)return;const e=new Date(s.currentTime.getTime()+1e3*p.value);j("update:currentTime",e),setTimeout(N,1e3/p.value)}O(()=>{console.log("Component mounted, current image:",y.value),P()}),V(()=>{I!==null&&cancelAnimationFrame(I)});const b=n(null);function G(){if(!b.value)return;const e=new Date(s.currentTime),o=e.getHours(),r=e.getMinutes(),g=(o+r/60)/24,i=[{time:0,color:{r:10,g:10,b:35}},{time:.25,color:{r:255,g:200,b:100}},{time:.5,color:{r:200,g:230,b:255}},{time:.75,color:{r:255,g:140,b:50}},{time:1,color:{r:10,g:10,b:35}}];let v=0;for(let f=0;f<i.length-1;f++)if(g>=i[f].time&&g<i[f+1].time){v=f;break}const u=i[v].color,D=i[v+1].color,L=i[v].time,J=i[v+1].time,C=(g-L)/(J-L),W=Math.round(u.r+C*(D.r-u.r)),Z=Math.round(u.g+C*(D.g-u.g)),ee=Math.round(u.b+C*(D.b-u.b));b.value.style.setProperty("--background-color",`rgb(${W}, ${Z}, ${ee})`)}function P(){K(),G(),I=requestAnimationFrame(P)}return(e,o)=>(x(),S("div",{class:"landscape-viewer",onKeydown:re(Q,["p"]),tabindex:"0",ref_key:"viewerRef",ref:b},[t("div",ge,[t("div",{class:"image-wrapper",style:oe({transform:`translateX(${-k.value}%)`})},fe,4)]),t("div",_e,a(E.value),1),t("div",he,[t("p",null,a(A.value),1)]),m.value?(x(),S("div",we,[t("button",{onClick:X},a(d.value?"Pause":"Start")+" Simulation",1),ae(t("input",{"onUpdate:modelValue":o[0]||(o[0]=r=>p.value=r),type:"range",min:"1",max:"1000"},null,512),[[se,p.value,void 0,{number:!0}]]),t("span",null,"Speed: "+a(p.value)+"x",1)])):U("",!0),m.value?(x(),S("div",Te,[t("p",null,"Current Image: "+a(B.value),1),t("p",null,"Next Image: "+a(H.value),1),t("p",null,"Pan Offset: "+a(e.panOffset.toFixed(2)),1),t("p",null,"Current Date: "+a(z.value),1),t("p",null,"Next Image Loading: "+a(R.value?"Yes":"No"),1)])):U("",!0)],544))}}),xe=le(Se,[["__scopeId","data-v-154376cc"]]),Ie=F({__name:"index",setup(c){const h=n(new Date);function w(){h.value=new Date}let l=null;return O(()=>{l=me(w,1e3)}),V(()=>{l&&clearInterval(l)}),(s,y)=>(x(),S("div",null,[ue(xe,{currentTime:h.value},null,8,["currentTime"])]))}});export{Ie as default};