const fs = require('fs');
const path = require('path');

const dir = path.join(process.cwd(), 'dashboard-designs');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

const tabs = ['Profile', 'Security', 'Edit World', 'Billing', 'Analytics'];

const designs = [
  // 1. Classic Sidebar (Hanging Wooden Signs)
  `<!DOCTYPE html><html><head><title>01-Cozy</title><script src='https://cdn.tailwindcss.com'></script><style>body{background:#A3B18A;font-family:cursive;} .plank{background:#DDA15E; border:4px solid #BC6C25; border-radius:8px;}</style></head><body class='p-8 flex gap-8 h-screen w-full max-w-6xl mx-auto'>
    <nav class='w-64 flex flex-col gap-4'>
      <div class='plank p-4 text-center font-bold text-2xl mb-8 text-white rotate-[-2deg] shadow-lg'>FARM HUB</div>
      ${tabs.map(t => `<div class='plank p-3 text-center cursor-pointer hover:rotate-2 transition-transform text-orange-950'>${t}</div>`).join('')}
    </nav>
    <main class='flex-1 plank p-8 bg-[#FEFAE0] text-[#283618] shadow-2xl relative'>
      <h1 class='text-4xl border-b-4 border-[#BC6C25] pb-4 mb-8'>${tabs[0]}</h1>
      <div class='grid grid-cols-2 gap-8'><div class='plank bg-white p-4'>Status: Farmer</div><div class='plank bg-white p-4'>Crops: 100</div></div>
    </main>
  </body></html>`,

  // 2. Classic JRPG (Top Nav, Blue boxes)
  `<!DOCTYPE html><html><head><title>02-JRPG</title><script src='https://cdn.tailwindcss.com'></script><style>body{background:#000;font-family:monospace;color:white;} .jrpg-box{background:linear-gradient(to bottom, #000080, #000030); border:4px solid white; border-radius:8px; box-shadow: 4px 4px 0 #555;}</style></head><body class='p-8 h-screen w-full max-w-4xl mx-auto flex flex-col gap-6'>
    <header class='jrpg-box p-6 flex justify-between items-center'>
      <h1 class='text-2xl font-bold tracking-widest'>MAIN MENU</h1>
      <div class='text-yellow-400'>LVL 99</div>
    </header>
    <nav class='jrpg-box p-4'><ul class='flex justify-between px-8'>
      ${tabs.map(t => `<li class='cursor-pointer hover:text-yellow-300'>▶ ${t}</li>`).join('')}
    </ul></nav>
    <main class='flex-1 jrpg-box p-8'>
      <h2 class='text-3xl mb-8'>HP: 9999 / 9999</h2>
      <div class='h-64 border-2 border-white/30 flex items-center justify-center'>Content Area</div>
    </main>
  </body></html>`,

  // 3. Tile / Console Dashboard
  `<!DOCTYPE html><html><head><title>03-Console</title><script src='https://cdn.tailwindcss.com'></script><style>body{background:#111;color:white;font-family:sans-serif;} .tile{transition:transform 0.1s;cursor:pointer;} .tile:hover{transform:scale(1.05);outline:4px solid white;}</style></head><body class='h-screen flex flex-col p-12 overflow-hidden'>
    <h1 class='text-5xl font-light mb-12'>GAME DASHBOARD</h1>
    <div class='grid grid-cols-4 grid-rows-2 gap-4 flex-1 max-h-[600px]'>
      <div class='tile bg-green-500 col-span-2 row-span-2 p-8 flex flex-col justify-between rounded-xl'>
        <span class='text-5xl font-bold'>${tabs[2]}</span><span class='text-2xl opacity-80'>Jump back in</span>
      </div>
      <div class='tile bg-blue-500 p-6 rounded-xl flex items-end text-3xl font-semibold'>${tabs[0]}</div>
      <div class='tile bg-purple-500 p-6 rounded-xl flex items-end text-3xl font-semibold'>${tabs[1]}</div>
      <div class='tile bg-orange-600 p-6 rounded-xl flex items-end text-3xl font-semibold'>${tabs[3]}</div>
      <div class='tile bg-gray-700 p-6 rounded-xl flex items-end text-3xl font-semibold text-gray-400'>${tabs[4]} 🔒</div>
    </div>
  </body></html>`,

  // 4. Mobile Gacha (Bottom Nav)
  `<!DOCTYPE html><html><head><title>04-Mobile</title><script src='https://cdn.tailwindcss.com'></script><body class='bg-slate-900 h-screen w-full flex justify-center items-center'>
    <div class='w-[400px] h-[800px] bg-slate-800 border-8 border-slate-950 rounded-[40px] overflow-hidden flex flex-col relative shadow-[0_0_50px_rgba(0,0,0,0.5)]'>
      <header class='bg-slate-950 p-6 text-center text-white font-bold tracking-widest shadow-md z-10 text-xl'>PLAYER PROFILE</header>
      <main class='flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-white pb-24'>
        <div class='bg-gradient-to-tr from-cyan-500 to-indigo-600 h-48 rounded-2xl p-6 flex flex-col justify-end font-bold text-2xl shadow-lg border border-cyan-300/30'>Player Card <span class='text-sm font-normal opacity-80'>ID: 8090293</span></div>
        <div class='bg-slate-700/50 h-32 rounded-2xl p-4 border border-slate-600'>Stats</div>
      </main>
      <nav class='absolute bottom-0 w-full h-24 bg-slate-950 flex justify-around items-center border-t-2 border-slate-800 rounded-b-[32px]'>
        ${tabs.map(t => `<div class='text-[10px] flex flex-col items-center text-gray-400 hover:text-cyan-400 cursor-pointer uppercase tracking-wider'><div class='w-10 h-10 rounded-full bg-slate-800 mb-1 border-2 border-transparent hover:border-cyan-400 flex items-center justify-center'>◆</div>${t.split(' ')[0]}</div>`).join('')}
      </nav>
    </div>
  </body></html>`,

  // 5. Sci-Fi Hex/Floating Terminal
  `<!DOCTYPE html><html><head><title>05-SciFi</title><script src='https://cdn.tailwindcss.com'></script><style>body{background:radial-gradient(circle, #0f2027, #203a43, #2c5364);color:#0ff;font-family:monospace;}</style></head><body class='min-h-screen p-8 flex items-center justify-center'>
    <div class='w-full max-w-6xl grid grid-cols-12 gap-8'>
      <main class='col-span-9 bg-black/50 border-2 border-cyan-500/50 p-12 rounded-lg backdrop-blur shadow-[0_0_30px_rgba(0,255,255,0.1)] h-[700px] relative clip-path-polygon flex flex-col'>
        <div class='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent'></div>
        <h1 class='text-6xl font-bold tracking-widest mb-12 uppercase'>${tabs[0]}</h1>
        <div class='border border-cyan-900 flex-1 bg-cyan-900/10 flex items-center justify-center'>
            <div class='w-48 h-48 border-4 border-cyan-500 rounded-full border-dashed animate-spin-slow'></div>
        </div>
      </main>
      <nav class='col-span-3 flex flex-col gap-4 justify-center'>
        ${tabs.map((t,i) => `<div class='border border-cyan-500/50 bg-black/50 p-6 text-right cursor-pointer hover:bg-cyan-900/30 hover:pl-8 transition-all uppercase text-sm tracking-widest ${i===0?'border-cyan-400 shadow-[0_0_15px_#0ff]':''}'>${t}</div>`).join('')}
      </nav>
    </div>
  </body></html>`,

  // 6. Book / Parchment layout (Two Columns)
  `<!DOCTYPE html><html><head><title>06-Fantasy Book</title><script src='https://cdn.tailwindcss.com'></script><style>body{background:#3e2a14; display:flex; align-items:center; justify-content:center; height:100vh;} .page{background:#e3d1b8; color:#3e2a14; box-shadow:inset 0 0 50px rgba(0,0,0,0.2);}</style></head><body>
    <div class='w-full max-w-5xl h-[800px] flex rounded-lg overflow-hidden shadow-2xl relative'>
      <div class='absolute left-1/2 top-0 bottom-0 w-16 -ml-8 bg-gradient-to-r from-black/0 via-black/40 to-black/0 z-10 pointer-events-none'></div>
      <div class='page w-1/2 p-16 flex flex-col justify-center border-r-2 border-[#8b5a2b] relative'>
        <h1 class='text-5xl font-serif text-center mb-16 border-b-2 border-current pb-4'>Index</h1>
        <ul class='space-y-8 text-3xl font-serif text-center'>
          ${tabs.map((t, i) => `<li class='cursor-pointer hover:text-red-900 hover:scale-105 transition-transform italic ${i===0?'font-bold':''}'>~ ${t} ~</li>`).join('')}
        </ul>
      </div>
      <div class='page w-1/2 p-16 font-serif text-xl'>
        <h2 class='text-4xl mb-8 capitalize'>${tabs[0]}</h2>
        <p class='leading-relaxed opacity-80 decoration-dashed'>Here lies the records of the adventurer, recorded carefully upon this magical parchment. The world awaits your mark.</p>
      </div>
    </div>
  </body></html>`,

  // 7. Folder Tabs (Skue-morphic)
  `<!DOCTYPE html><html><head><title>07-Folders</title><script src='https://cdn.tailwindcss.com'></script><style>body{background:#cbd5e1;} .folder-tab{border-radius:16px 16px 0 0; border:2px solid #64748b; border-bottom:none;}</style></head><body class='min-h-screen p-16 flex flex-col'>
    <div class='max-w-6xl w-full mx-auto flex-1 flex flex-col'>
      <div class='flex px-8 border-b-2 border-gray-400 z-10'>
        ${tabs.map((t,i) => `<div class='folder-tab px-8 py-4 cursor-pointer font-bold text-gray-800 text-xl transition-all ${i===0?'bg-[#FDE68A] pb-6 -mb-2 border-b-[#fde68a] z-20':'bg-slate-300 -ml-4 -mb-2 hover:bg-slate-200 mt-2 z-0'} scale-100'>${t}</div>`).join('')}
      </div>
      <main class='bg-[#FDE68A] p-16 border-2 border-[#64748b] rounded-b-2xl rounded-tr-2xl flex-1 shadow-2xl relative -mt-2 z-10'>
        <div class='absolute top-4 right-4 text-gray-500 font-mono'>TOP SECRET</div>
        <h1 class='text-5xl font-bold mb-12 underline decoration-wavy decoration-red-400'>User Profile</h1>
        <div class='bg-white/60 p-12 border-4 border-dashed border-gray-400 rounded-xl min-h-[400px]'>Document Content Here</div>
      </main>
    </div>
  </body></html>`,

  // 8. Minimalist Pixel Pause Screen Overlay
  `<!DOCTYPE html><html><head><title>08-Pause Menu</title><script src='https://cdn.tailwindcss.com'></script><style>body{background:repeating-linear-gradient(45deg, #111, #111 10px, #000 10px, #000 20px); font-family:monospace;}</style></head><body class='h-screen text-white flex overflow-hidden'>
    <div class='w-1/3 h-full bg-black/90 flex flex-col justify-center pl-16 py-16 clip-path shadow-[20px_0_50px_black] z-10'>
      <div class='text-7xl mb-24 uppercase italic font-black text-white/50 border-b-8 border-white inline-block pr-8 pb-4'>PAUSED</div>
      <nav class='flex flex-col gap-8 text-4xl font-bold'>
        ${tabs.map((t,i) => `<div class='cursor-pointer ${i===0?'text-red-500 scale-110 origin-left':'text-gray-600 hover:text-white'} transition-all flex items-center gap-4'>${i===0?'> ':''}${t}</div>`).join('')}
      </nav>
    </div>
    <div class='w-2/3 h-full flex items-center justify-center relative p-24'>
      <div class='w-full h-full bg-black/60 border-2 border-white/20 p-12 flex flex-col backdrop-blur-sm'>
        <h2 class='text-4xl text-white/50 mb-8'>[ ACTIVE : ${tabs[0]} ]</h2>
      </div>
    </div>
  </body></html>`,

  // 9. Diagonal Split Action
  `<!DOCTYPE html><html><head><title>09-Action Split</title><script src='https://cdn.tailwindcss.com'></script><style>body{overflow:hidden;} .slant{transform:skewX(-15deg);}</style></head><body class='h-screen bg-neutral-900 text-white relative'>
    <nav class='absolute top-0 left-0 w-3/4 h-[120px] bg-amber-400 slant origin-top-left flex items-end pb-4 pl-24 gap-12 text-black font-black uppercase text-2xl shadow-2xl z-20 transform -translate-x-12'>
      <div class='reverse transform skew-x-[15deg] flex gap-12'>
        ${tabs.map((t,i) => `<span class='cursor-pointer px-6 py-2 hover:bg-black hover:text-white inline-block transition-colors ${i===0?'bg-black text-white':''}'>${t}</span>`).join('')}
      </div>
    </nav>
    <main class='absolute inset-0 pt-[250px] p-24 font-sans bg-[url("https://www.transparenttextures.com/patterns/carbon-fibre.png")] bg-neutral-900'>
      <div class='bg-black/80 p-16 border-l-[16px] border-amber-400 h-full overflow-y-auto w-3/4 ml-auto rounded-r-xl shadow-2xl skew-x-[-5deg] origin-bottom'>
        <div class='skew-x-[5deg] origin-bottom'>
        <h1 class='text-6xl font-black italic uppercase mb-12 text-amber-400 tracking-tighter'>${tabs[0]}</h1>
        <div class='grid grid-cols-2 gap-8'><div class='h-48 bg-neutral-800 rounded'></div><div class='h-48 bg-neutral-800 rounded'></div></div>
        </div>
      </div>
    </main>
  </body></html>`,

  // 10. Radar / Target Lock Area (HUD)
  `<!DOCTYPE html><html><head><title>10-Target Terminal</title><script src='https://cdn.tailwindcss.com'></script><style>body{background:#0a0a0a; color:#0f0;} .scanline{background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.3)); background-size: 100% 4px; z-index: 50;}</style></head><body class='h-screen flex items-center justify-center p-12 relative overflow-hidden'>
    <div class='absolute inset-0 scanline pointer-events-none'></div>
    <div class='w-full max-w-7xl h-full border border-green-500 relative flex flex-col p-6 bg-green-900/10 shadow-[0_0_50px_rgba(0,255,0,0.1)]'>
      <div class='absolute top-0 left-0 w-16 h-16 border-t-8 border-l-8 border-green-500'></div>
      <div class='absolute top-0 right-0 w-16 h-16 border-t-8 border-r-8 border-green-500'></div>
      <div class='absolute bottom-0 left-0 w-16 h-16 border-b-8 border-l-8 border-green-500'></div>
      <div class='absolute bottom-0 right-0 w-16 h-16 border-b-8 border-r-8 border-green-500'></div>
      
      <header class='flex justify-between border-b-2 border-green-800 pb-4 mb-8 uppercase text-lg font-mono tracking-widest'>
        <span>/// TERMINAL DB ENTRY /// HUB OVERRIDE</span>
        <span>STATUS: NOMINAL</span>
      </header>
      
      <div class='flex-1 flex gap-12 h-full'>
        <nav class='w-80 border-r-2 border-green-800 pr-12 h-full'>
          <ul class='space-y-8 mt-12'>
            ${tabs.map((t,i) => `<li class='cursor-pointer p-4 uppercase tracking-widest text-sm font-mono transition-all hover:bg-green-500/20 hover:pl-8 ${i===0?'bg-green-500 text-black font-bold':''}'>[${i+1}] ${t}</li>`).join('')}
          </ul>
        </nav>
        <main class='flex-1 p-8 grid grid-cols-2 gap-8'>
          <div class='col-span-2 text-4xl uppercase tracking-widest font-bold font-mono border-b-2 border-green-800 pb-6 text-green-400'>${tabs[0]} Data</div>
          <div class='border-2 border-green-900 h-80 flex items-center justify-center uppercase text-green-900 bg-green-900/20 text-xl font-mono'>[IMAGE RENDER PENDING]</div>
          <div class='border-2 border-green-900 h-80 p-8 text-sm font-mono bg-green-900/5'>LOADING HUD STATS... <br/>> System Initialized<br/>> User Authenticated</div>
        </main>
      </div>
    </div>
  </body></html>`
];

designs.forEach((html, i) => {
  fs.writeFileSync(path.join(dir, `layout-structure-${(i+1).toString().padStart(2, '0')}.html`), html);
});

console.log('Structures generated!');
