if(!self.define){let e,i={};const s=(s,d)=>(s=new URL(s+".js",d).href,i[s]||new Promise((i=>{if("document"in self){const e=document.createElement("script");e.src=s,e.onload=i,document.head.appendChild(e)}else e=s,importScripts(s),i()})).then((()=>{let e=i[s];if(!e)throw new Error(`Module ${s} didn’t register its module`);return e})));self.define=(d,n)=>{const r=e||("document"in self?document.currentScript.src:"")||location.href;if(i[r])return;let o={};const c=e=>s(e,r),a={module:{uri:r},exports:o,require:c};i[r]=Promise.all(d.map((e=>a[e]||c(e)))).then((e=>(n(...e),o)))}}define(["./workbox-256af046"],(function(e){"use strict";self.addEventListener("message",(e=>{e.data&&"SKIP_WAITING"===e.data.type&&self.skipWaiting()})),e.precacheAndRoute([{url:"assets/index.html",revision:"e9ff13035f91617b86c0dd45896d99af"},{url:"assets/manifest.json",revision:"b50adf7d01df60de5f7f5e5a7d654dac"},{url:"assets/maskable_icon_x192.png",revision:"35edd005e618125fc93108bddcc10680"},{url:"dist/icon_144.png",revision:"549b1702e603c3d3032b18549366d8af"},{url:"dist/icon_192.png",revision:"22634d508e81ae538a6db533544a1162"},{url:"dist/icon_48.png",revision:"c2c3b03d09f326b7594049168b37a668"},{url:"dist/icon_512.png",revision:"aa8d2ddb99ff256f266985c8b6503113"},{url:"dist/icon_72.png",revision:"19d6019506f8bf941e117638c3cb400a"},{url:"dist/icon_96.png",revision:"0c1ad1311e831169655090fa5d45e9cb"},{url:"dist/index.html",revision:"e9ff13035f91617b86c0dd45896d99af"},{url:"dist/manifest.json",revision:"b50adf7d01df60de5f7f5e5a7d654dac"},{url:"dist/maskable_icon_x192.png",revision:"35edd005e618125fc93108bddcc10680"},{url:"dist/script.js",revision:"aa411d76ed0e54fb6a4b0a3d2e210a39"},{url:"package-lock.json",revision:"21ee5ad2fe828906f770a4a800ffad68"},{url:"package.json",revision:"7c6dea9e502ba67669c5a560641180c5"},{url:"tsconfig.json",revision:"6e2b03cac339b574fc3136fdc4d9b459"}],{ignoreURLParametersMatching:[/^utm_/,/^fbclid$/]})}));
