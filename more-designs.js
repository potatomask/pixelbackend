const fs = require('fs');
const path = require('path');

const dir = path.join(process.cwd(), 'dashboard-designs');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

const tabs = ['Profile', 'Security', 'Edit World', 'Billing', 'Analytics'];

const designs = [
  // 11. Radial/Circular Menu
  `<!DOCTYPE html><html><head><title>11-Radial Menu</title><script src='https://cdn.tailwindcss.com'></script><style>body{background:#111827; overflow:hidden;} .orbit-item{position:absolute; transform-origin:center;}</style></head><body class='h-screen w-screen flex items-center justify-center text-white font-sans'>
    <div class='relative w-[600px] h-[600px] flex items-center justify-center rounded-full border-4 border-dashed border-indigo-900 shadow-[0_0_100px_rgba(67,56,202,0.2)]'>
      <div class='w-56 h-56 bg-indigo-600 rounded-full z-10 flex items-center justify-center text-3xl font-black tracking-widest shadow-[0_0_50px_rgba(79,70,229,0.8)] border-4 border-indigo-400'>PLAYER</div>
      ${tabs.map((t, i) => {
        const angle = (i * (360 / tabs.length)) - 90;
        return `<div class='absolute w-full h-2' style='transform:rotate(${angle}deg)'><div class='w-36 h-16 bg-slate-800 border-2 border-indigo-500 absolute right-0 -top-7 rounded-full flex items-center justify-center cursor-pointer hover:bg-indigo-500 hover:scale-125 transition-all text-sm font-bold shadow-xl' style='transform:rotate(${-angle}deg)'>${t}</div></div>`;
      }).join('')}
    </div>
    <main class='absolute bottom-12 right-12 w-[450px] h-72 bg-slate-800/90 p-8 rounded-2xl border-2 border-indigo-500 backdrop-blur-md shadow-2xl'>
      <h1 class='text-2xl font-bold border-b border-indigo-500/50 pb-4 mb-4 text-indigo-300'>Active Module: Profile</h1>
      <p class='text-slate-400'>Select a node from the orbital ring to activate its interface.</p>
    </main>
  </body></html>`,

  // 12. Notice Board (Scattered Papers / Physical)
  `<!DOCTYPE html><html><head><title>12-Notice Board</title><script src='https://cdn.tailwindcss.com'></script><style>body{background:#5c4033; background-image:url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100' height='100' fill='%235c4033'/%3E%3Cpath d='M0 0l100 100M100 0L0 100' stroke='%234a332a' stroke-width='2'/%3E%3C/svg%3E");} .pin{width:16px;height:16px;border-radius:50%;background:#ef4444;position:absolute;top:12px;left:50%;transform:translateX(-50%);box-shadow:inset -2px -2px 4px rgba(0,0,0,0.5), 2px 2px 4px rgba(0,0,0,0.5); z-index:50;} .paper{background:#fef3c7; background-image: linear-gradient(#fbbf24 1px, transparent 1px); background-size: 100% 30px; line-height:30px;}</style></head><body class='h-screen p-8 relative flex shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]'>
    <nav class='w-1/3 h-full relative'>
      ${tabs.map((t, i) => {
        const rot = Math.random() * 30 - 15;
        const top = 10 + (i * 16);
        const left = 5 + (Math.random() * 30 - 15);
        return `<div class='absolute bg-amber-100 p-6 border-b border-amber-300 w-56 shadow-[4px_4px_10px_rgba(0,0,0,0.5)] cursor-pointer hover:z-50 hover:scale-110 transition-transform text-center text-amber-900 text-2xl font-bold origin-top' style='top:${top}%; left:${left}%; transform:rotate(${rot}deg)'><div class='pin'></div><br/>${t}</div>`;
      }).join('')}
    </nav>
    <main class='w-2/3 h-full paper rounded shadow-2xl p-16 relative transform rotate-1 flex flex-col'>
        <div class='pin' style='left:auto; right:30px; top:20px'></div><div class='pin' style='left:30px; top:20px'></div>
        <h1 class='text-6xl font-bold pb-2 text-amber-900 underline mt-4 font-serif'>Official Notice</h1>
        <p class='mt-12 text-3xl text-amber-800 opacity-80 font-serif italic'>Adventurer details are pinned here...</p>
    </main>
  </body></html>`,

  // 13. Retro OS Window (Win95 style / Amiga)
  `<!DOCTYPE html><html><head><title>13-Retro OS</title><script src='https://cdn.tailwindcss.com'></script><style>body{background:#008080; font-family:tahoma, sans-serif;} .win{border:2px solid; border-color:#dfdfdf #000 #000 #dfdfdf; background:#c0c0c0;} .inset{border:2px solid; border-color:#808080 #fff #fff #808080; background:#fff;} .titlebar{background:#000080; color:white; font-weight:bold; padding:4px 8px; display:flex; justify-content:space-between; align-items:center; letter-spacing:1px;}</style></head><body class='h-screen p-4 flex flex-col justify-between overflow-hidden'>
    <div class='flex-1 relative'>
      <div class='win absolute top-8 left-8 w-72 z-10 shadow-lg cursor-move'>
        <div class='titlebar'><span>Menu.exe</span><button class='bg-[#c0c0c0] font-black text-black border-2 border-[#dfdfdf] border-r-black border-b-black px-2 py-0 text-sm'>X</button></div>
        <div class='p-4 flex flex-col gap-3'>
          ${tabs.map(t => `<button class='inset text-left px-4 py-2 cursor-pointer hover:bg-[#000080] hover:text-white bg-[#c0c0c0] active:border-r-white active:border-b-white active:border-t-[#808080] active:border-l-[#808080] font-bold'>${t}</button>`).join('')}
        </div>
      </div>
      <div class='win absolute top-24 left-[380px] w-[800px] h-[550px] z-0 shadow-lg cursor-move'>
        <div class='titlebar'><span>Workspace - ${tabs[0]}</span><button class='bg-[#c0c0c0] font-black text-black border-2 border-[#dfdfdf] border-r-black border-b-black px-2 text-sm'>X</button></div>
        <div class='inset m-3 h-[calc(100%-55px)] p-8 flex flex-col overflow-y-auto font-serif'>
            <h1 class='text-4xl border-b-2 border-black w-full pb-4 font-bold'>User Profile</h1>
            <div class='grid grid-cols-3 gap-8 mt-8'>
              <div class='inset p-4 bg-[#c0c0c0] text-center'>Avatar.bmp</div>
              <div class='col-span-2'>Data layout simulated.</div>
            </div>
        </div>
      </div>
    </div>
    <div class='win h-12 flex items-center px-2 z-20 gap-4 fixed bottom-0 left-0 w-full'><button class='win px-6 py-1 font-bold active:border-[#808080] active:border-r-[#fff] active:border-b-[#fff] active:bg-[#a0a0a0] flex items-center gap-2'><img src='https://win98icons.alexmeub.com/icons/png/windows_slanted-1.png' class='w-4 h-4'> Start</button> <div class='inset px-6 py-1 bg-transparent font-bold text-gray-700 shadow-inner'>Dashboard Runtime Engine</div></div>
  </body></html>`,
  
  // 14. Skill Tree Web
  `<!DOCTYPE html><html><head><title>14-Skill Tree</title><script src='https://cdn.tailwindcss.com'></script><style>body{background:#020617; color:#cbd5e1;} .node{width:100px;height:100px;border-radius:50%;border:4px solid #3b82f6;background:#1e293b;display:flex;align-items:center;justify-content:center;text-align:center;font-size:12px;font-weight:bold;cursor:pointer;position:relative;z-index:10; transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);} .node:hover{background:#3b82f6;color:white;transform:scale(1.15); box-shadow:0 0 30px #3b82f6;} .line{position:absolute;background:#334155;height:4px;z-index:0;} .node-active{background:#3b82f6; color:white; border-color:white; box-shadow:0 0 30px #3b82f6;}</style></head><body class='h-screen flex text-white relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 to-slate-950'>
    <div class='w-1/2 relative flex items-center justify-center h-full'>
      <div class='w-full h-full relative p-20'>
        <!-- Node Lines -->
        <div class='line' style='width:200px; top:50%; left:25%; transform:translateY(-50%);'></div>
        <div class='line' style='width:220px; top:35%; left:35%; transform:rotate(35deg);'></div>
        <div class='line' style='width:220px; top:65%; left:35%; transform:rotate(-35deg);'></div>
        <div class='line' style='width:150px; top:20%; left:50%; transform:rotate(70deg);'></div>
        
        <div class='node absolute node-active' style='top:calc(50% - 50px); left:10%; border-color:white;'>${tabs[0]}<br/>(ROOT)</div>
        <div class='node absolute' style='top:calc(50% - 50px); left:45%; border-color:#eab308;'>${tabs[2]}</div>
        <div class='node absolute' style='top:calc(20% - 50px); left:65%; border-color:#10b981;'>${tabs[1]}</div>
        <div class='node absolute' style='top:calc(80% - 50px); left:65%; border-color:#f43f5e;'>${tabs[3]}</div>
        <div class='node absolute' style='top:calc(5% - 50px); left:40%; border-color:#a855f7;'>${tabs[4]}</div>
      </div>
    </div>
    <div class='w-1/2 p-24 flex flex-col justify-center h-full'>
      <div class='border border-slate-700 bg-slate-800/40 p-16 rounded-[40px] h-4/5 backdrop-blur-xl shadow-2xl relative overflow-hidden'>
        <div class='absolute -top-32 -right-32 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-[100px] opacity-20'></div>
        <h1 class='text-6xl font-bold mb-8 text-blue-400'>Node Status</h1>
        <p class='text-slate-400 text-xl leading-relaxed'>Select a node on the left to reveal its characteristics and unlock sub-features.</p>
        <div class='mt-12 p-8 border-2 border-dashed border-slate-600 rounded-2xl flex items-center justify-center opacity-50'>[ Content Projection ]</div>
      </div>
    </div>
  </body></html>`,

  // 15. Isometric City / Buildings
  `<!DOCTYPE html><html><head><title>15-Isometric View</title><script src='https://cdn.tailwindcss.com'></script><style>body{background:#f0f9ff; overflow:hidden;} .iso-grid{transform: rotateX(60deg) rotateZ(-45deg); transform-style: preserve-3d;} .building{transition:all 0.4s cubic-bezier(0.4, 0, 0.2, 1); cursor:pointer;} .building:hover{transform:translateZ(40px);} .face{position:absolute; border:1px solid rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center;}</style></head><body class='min-h-screen flex items-center justify-center p-12 relative'>
    <h1 class='absolute top-12 text-6xl font-black text-blue-900/10 tracking-tighter uppercase w-full text-center'>Cyber City Hub</h1>
    <div class='w-[900px] h-[900px] perspective-[1200px] flex items-center justify-center absolute left-20'>
      <div class='iso-grid w-[600px] h-[600px] relative border-8 border-blue-200/50 bg-blue-50/50 shadow-[0_50px_100px_rgba(0,0,0,0.1)]'>
        ${tabs.map((t,i) => {
          const x = (i%3)*180 + 40;
          const y = Math.floor(i/3)*180 + 40;
          const h = 80 + (i*30) + Math.random()*40;
          const isSelected = i===0;
          return `<div class='building absolute w-32 h-32' style='left:${x}px; top:${y}px;'>
            <div class='face ${isSelected?'bg-rose-500':'bg-blue-500'} font-bold text-center px-4 text-white text-xl z-20 shadow-[inset_0_0_20px_rgba(0,0,0,0.2)]' style='width:140px; height:140px; transform:translateZ(${h}px);'>${t}</div>
            <div class='face ${isSelected?'bg-rose-600':'bg-blue-600'}' style='width:140px; height:${h}px; transform:rotateX(-90deg) translateZ(${h}px) translateY(-${h/2}px); transform-origin:top;'></div>
            <div class='face ${isSelected?'bg-rose-700':'bg-blue-700'} overflow-hidden' style='width:${h}px; height:140px; transform:rotateY(90deg) translateZ(140px) translateX(${h/2}px); transform-origin:right;'>
                <div class='w-full h-full bg-[linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[size:100%_10px]'></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <main class='absolute right-20 w-[500px] h-[700px] bg-white p-12 rounded-3xl shadow-2xl border flex flex-col z-50'>
        <div class='text-rose-500 font-bold mb-2 tracking-widest uppercase'>Active Sector</div>
        <h2 class='text-5xl font-black mb-8 border-b-4 border-gray-100 pb-8'>${tabs[0]}</h2>
        <div class='flex-1 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 flex items-center justify-center p-8 text-center text-gray-400'>Details loading from isometric coordinate matrix.</div>
    </main>
  </body></html>`,

  // 16. Visual Novel Dialogue UI
  `<!DOCTYPE html><html><head><title>16-Visual Novel</title><script src='https://cdn.tailwindcss.com'></script><style>body{background:url("https://images.unsplash.com/photo-1542831371-32f555c86880?auto=format&fit=crop&q=80&w=1920") center/cover; overflow:hidden;} .char{filter: drop-shadow(0 0 30px rgba(0,0,0,0.8));} .textbox{background:rgba(10,10,20,0.85); border:6px solid white; border-radius:24px; box-shadow:0 0 50px rgba(0,0,0,0.8); backdrop-filter:blur(10px);}</style></head><body class='h-screen relative flex flex-col justify-end p-12'>
    <div class='absolute bottom-0 left-32 w-[500px] h-[900px] char z-10 flex flex-col justify-end items-center'>
      <div class='w-full h-4/5 bg-gradient-to-t from-gray-900 to-transparent rounded-t-full opacity-90 border-t-[12px] border-white z-0 relative overflow-hidden'>
        <div class='absolute inset-0 bg-[url("data:image/svg+xml,%3Csvg width=\\'20\\' height=\\'20\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Ccircle cx=\\'2\\' cy=\\'2\\' r=\\'1\\' fill=\\'%23ffffff\\' fill-opacity=\\'0.2\\'/%3E%3C/svg%3E")]'></div>
      </div> 
      <span class='absolute top-1/3 left-1/2 -translate-x-1/2 text-white text-[180px] z-10'>👤</span>
    </div>
    <div class='textbox w-full h-[350px] z-20 flex p-12 text-white relative'>
      <div class='absolute -top-10 left-16 bg-white text-black font-black text-4xl px-10 py-3 rounded shadow-lg transform -rotate-1'>SYSTEM GUIDE</div>
      <div class='w-3/5 h-full pr-12 text-4xl leading-relaxed flex items-center italic font-serif opacity-90'>
        "Welcome back to your hub! Where would you like to go next? Master your domain or check your stats?"
      </div>
      <div class='w-2/5 flex flex-col gap-4 font-bold border-l-4 border-white/20 pl-12 overflow-y-auto pr-4'>
        ${tabs.map((t,i) => `<button class='w-full text-left bg-white/5 hover:bg-white hover:text-black hover:scale-[1.02] transform px-8 py-5 rounded-xl transition-all text-2xl border border-white/10 ${i===0?'bg-white/20 border-white/50':''}'>${i===0?'▶ ':''}${t}</button>`).join('')}
      </div>
    </div>
  </body></html>`,

  // 17. Comic Book / Manga Panels
  `<!DOCTYPE html><html><head><title>17-Comic Panels</title><script src='https://cdn.tailwindcss.com'></script><style>body{background:#fefefe;} .panel{border:8px solid #111; box-shadow:12px 12px 0 #111; background:white; position:relative; overflow:hidden; transition:transform 0.2s;} .panel:hover{transform:translate(-6px, -6px); box-shadow:18px 18px 0 #111; z-index:10;} .halftone{background-image: radial-gradient(circle, #000 2px, transparent 2.5px); background-size: 15px 15px; opacity:0.1; position:absolute; inset:0; pointer-events:none;}</style></head><body class='min-h-screen p-12 bg-[#eee] bg-[linear-gradient(45deg,#ddd_25%,transparent_25%,transparent_75%,#ddd_75%,#ddd),linear-gradient(45deg,#ddd_25%,transparent_25%,transparent_75%,#ddd_75%,#ddd)] bg-[length:40px_40px] bg-[position:0_0,20px_20px]'>
    <div class='max-w-7xl mx-auto grid grid-cols-4 grid-rows-3 gap-8 h-[850px] rotate-[-1deg]'>
      <div class='panel col-span-3 row-span-2 p-12 bg-yellow-400 flex flex-col relative'>
        <div class='halftone'></div>
        <div class='bg-white border-8 border-black p-4 w-72 transform -rotate-3 text-center font-black text-3xl mb-8 uppercase z-10'>${tabs[0]} DATA!</div>
        <div class='flex-1 border-8 border-black bg-white rounded flex items-center justify-center font-bold text-6xl text-gray-200 uppercase z-10'>Panel Content</div>
        <!-- Action lines -->
        <svg class='absolute bottom-0 right-0 w-64 h-64 opacity-50 z-0' viewBox="0 0 100 100"><path d="M0,100 L100,0 M20,100 L100,20 M40,100 L100,40 M60,100 L100,60 M80,100 L100,80" stroke="black" stroke-width="2"/></svg>
      </div>
      <div class='panel col-span-1 row-span-1 bg-cyan-400 flex items-center justify-center p-8 text-5xl font-black text-white cursor-pointer relative'>
        <div class='halftone'></div>
        <span style='-webkit-text-stroke: 3px black;' class='z-10 transform -rotate-6'>${tabs[1]}</span>
      </div>
      <div class='panel col-span-1 row-span-1 bg-rose-500 flex items-center justify-center p-8 text-5xl font-black text-white cursor-pointer relative'>
        <div class='halftone'></div>
        <span style='-webkit-text-stroke: 3px black;' class='z-10 transform rotate-6'>${tabs[2]}</span>
      </div>
      <div class='panel col-span-2 bg-emerald-400 flex items-center justify-center p-8 text-6xl font-black italic cursor-pointer relative'>
        <div class='halftone'></div>
        <span class='bg-white px-8 py-2 border-8 border-black z-10 transform scale-110 -rotate-2'>${tabs[3]}</span>
      </div>
      <div class='panel col-span-2 bg-purple-500 flex items-center justify-center text-5xl font-black cursor-pointer text-white relative'>
        <div class='halftone'></div>
        <span style='-webkit-text-stroke: 3px black;' class='z-10 uppercase'>${tabs[4]}</span>
      </div>
    </div>
  </body></html>`,

  // 18. Floating Islands / Nodes Layout
  `<!DOCTYPE html><html><head><title>18-Floating Islands</title><script src='https://cdn.tailwindcss.com'></script><style>body{background:linear-gradient(180deg, #87CEEB, #bae6fd);} .island{border-radius:50% 50% 50% 50% / 30% 30% 70% 70%; box-shadow: inset 0 10px 0 rgba(255,255,255,0.3), inset 0 -20px 0 #5c4033, inset 0 -40px 0 #3d2a21, 0 30px 40px rgba(0,0,0,0.2); animation: float 6s ease-in-out infinite;} @keyframes float { 0% {transform:translateY(0px) rotate(0deg);} 50% {transform:translateY(-20px) rotate(1deg);} 100%{transform:translateY(0px) rotate(0deg);} }</style></head><body class='h-screen relative overflow-hidden'>
    <div class='absolute top-10 left-10 text-white font-black text-5xl opacity-50 uppercase tracking-widest'>Sky Realm Hub</div>
    <!-- Main Big Island Content -->
    <div class='absolute top-[25%] right-[10%] w-[800px] h-[500px] bg-green-400 island z-20 flex flex-col pt-16 items-center text-green-900'>
      <h1 class='text-5xl font-black mb-8 bg-white px-10 py-4 rounded-full border-4 border-green-600 shadow-[0_10px_0_#16a34a]'>Active: ${tabs[0]}</h1>
      <div class='bg-white/40 w-3/4 h-1/2 rounded-3xl border-4 border-dashed border-green-600/50 p-8 text-center text-2xl font-bold flex items-center justify-center'>
        [ Ground Level Viewport ]
      </div>
    </div>
    <!-- Floating Nav Islands -->
    ${tabs.map((t,i) => {
      const top = 15 + i * 15;
      const left = 5 + (i%2)*8;
      const delay = i * 0.8;
      return `<div class='absolute w-64 h-48 bg-green-400 island cursor-pointer hover:bg-green-300 flex items-center justify-center font-bold text-center z-30 transition-all hover:scale-110' style='top:${top}%; left:${left}%; animation-delay:-${delay}s'>
        <span class='transform translate-y-[-20px] bg-white px-6 py-2 rounded-full text-xl shadow-[0_5px_0_#16a34a] border-2 border-green-600 whitespace-nowrap'>${t}</span>
      </div>`;
    }).join('')}
  </body></html>`,

  // 19. Tape Deck / Cassette Player
  `<!DOCTYPE html><html><head><title>19-Tape Deck</title><script src='https://cdn.tailwindcss.com'></script><style>body{background:#262626;} .deck{background:#171717; border-radius:30px; box-shadow: 0 20px 50px rgba(0,0,0,0.8), inset 0 2px 5px rgba(255,255,255,0.1), inset 0 -4px 10px rgba(0,0,0,0.5);} .btn{background:linear-gradient(to bottom, #d4d4d4, #a3a3a3); border-bottom:12px solid #525252; transition:all 0.1s;} .btn:active{transform:translateY(12px); border-bottom-width:0px;} .cassette-window{box-shadow:inset 0 0 30px rgba(0,0,0,0.9);}</style></head><body class='h-screen flex items-center justify-center p-8 bg-[url("https://www.transparenttextures.com/patterns/dark-matter.png")]'>
    <div class='deck w-full max-w-5xl p-12 flex flex-col gap-12 border-t border-neutral-600'>
      <div class='bg-neutral-900 h-96 rounded-2xl border-[16px] border-neutral-800 flex flex-col p-6 relative overflow-hidden cassette-window'>
         <!-- Spools -->
         <div class='absolute top-1/2 left-1/4 -translate-y-1/2 w-40 h-40 border-[20px] border-white/10 rounded-full border-dashed animate-spin-slow'></div>
         <div class='absolute top-1/2 right-1/4 -translate-y-1/2 w-40 h-40 border-[20px] border-white/10 rounded-full border-dashed animate-spin-slow'></div>
         
         <!-- LCD text -->
         <div class='absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 px-8 py-2 rounded text-red-500 font-mono text-4xl font-bold uppercase tracking-widest text-center shadow-inner'>TRACK 1: ${tabs[0]}</div>
         <div class='mt-auto flex justify-between px-12 text-green-500 font-mono text-2xl z-10'>
           <span class='bg-black/80 px-4 py-1 rounded'>L ||||||||||||||||||---- R</span>
           <span class='bg-black/80 px-4 py-1 rounded text-red-500'>00:42:15</span>
         </div>
      </div>
      <div class='flex gap-6 justify-between bg-neutral-950 p-6 rounded-2xl inset-shadow'>
        ${tabs.map((t,i) => `<button class='btn flex-1 py-6 font-black text-gray-900 uppercase tracking-widest rounded-lg text-lg'>${i===0? '▶ P' : i===1? '⏸ S' : '■ '+t[0]}</button>`).join('')}
        <button class='btn flex-1 py-6 font-black text-red-700 uppercase tracking-widest rounded-lg bg-gradient-to-b from-red-200 to-red-400'>EJECT</button>
      </div>
      <div class='text-center flex justify-between px-12 text-neutral-500 uppercase font-black tracking-widest text-xl'>
        ${tabs.map(t => `<span class='hover:text-white cursor-pointer'>${t}</span>`).join('')}
      </div>
    </div>
  </body></html>`,

  // 20. Blueprint / Schematic Layout
  `<!DOCTYPE html><html><head><title>20-Blueprint</title><script src='https://cdn.tailwindcss.com'></script><style>body{background:#003366; color:#99CCFF; font-family:monospace; background-image: linear-gradient(rgba(153,204,255,0.2) 2px, transparent 2px), linear-gradient(90deg, rgba(153,204,255,0.2) 2px, transparent 2px); background-size: 60px 60px;} .schema-box{border:2px solid; position:relative; background:rgba(0,51,102,0.9);} .node-point{width:12px; height:12px; background:#99CCFF; position:absolute;} .lineH{height:2px; background:#99CCFF; position:absolute;} .lineV{width:2px; background:#99CCFF; position:absolute;}</style></head><body class='h-screen p-12 overflow-hidden flex items-center justify-center relative'>
    <div class='w-full max-w-[1400px] h-full relative'>
      <div class='absolute top-0 right-0 p-6 border-2 border-[#99CCFF] text-right bg-[#003366] z-50'>
         <h1 class='text-5xl uppercase font-bold tracking-widest'>PROJECT HUB</h1>
         <p class='text-xl mt-2'>REV. SCHEMATIC_0.4</p>
      </div>
      
      <!-- Connectors Grid -->
      <div class='lineV' style='left:200px; top:100px; height:700px;'></div>
      <div class='lineH' style='left:200px; top:200px; width:150px;'></div>
      <div class='lineH' style='left:200px; top:400px; width:150px;'></div>
      
      <!-- Nav Nodes -->
      <div class='flex flex-col gap-16 absolute left-4 top-32 z-10'>
        ${tabs.map(t => `<div class='schema-box border-[#99CCFF] p-6 uppercase w-64 text-center cursor-pointer hover:bg-[#99CCFF] hover:text-[#003366] transition-colors text-2xl font-bold'><div class='node-point -right-3 top-1/2 -translate-y-1/2 bg-[#99CCFF]'></div>${t}</div>`).join('')}
      </div>
      
      <!-- Main view box -->
      <div class='schema-box border-[#99CCFF] absolute left-[350px] top-[100px] w-[1000px] h-[700px] p-12 shadow-2xl'>
        <div class='absolute top-0 left-0 p-4 border-r-2 border-b-2 border-[#99CCFF] bg-[#99CCFF] text-[#003366] font-bold text-2xl'>FIG 1. ${tabs[0]}</div>
        
        <div class='absolute top-0 right-0 w-32 h-32 border-l-2 border-b-2 border-[#99CCFF] flex items-center justify-center flex-col text-xs'>
            <div class='border border-[#99CCFF] p-2 m-1 w-full text-center'>X: 192.00</div>
            <div class='border border-[#99CCFF] p-2 m-1 w-full text-center'>Y: 804.11</div>
        </div>

        <div class='w-full h-full border-2 border-dashed border-[#99CCFF]/50 mt-12 p-16 flex flex-col justify-center items-center opacity-70'>
          <svg class='w-48 h-48 mb-12' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='square' stroke-linejoin='miter' stroke-width='1.5' d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'></path></svg>
          <div class='text-3xl tracking-[0.5em]'>WIRE-FRAME RENDER AREA</div>
        </div>
      </div>
    </div>
  </body></html>`
];

designs.forEach((html, i) => {
  fs.writeFileSync(path.join(dir, `layout-structure-${(i+11).toString().padStart(2, '0')}.html`), html);
});

console.log('Successfully generated layout-structure-11.html to layout-structure-20.html');