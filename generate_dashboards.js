const fs = require('fs');
const path = require('path');

const dir = path.join(process.cwd(), 'dashboard-designs');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

const tabs = ['Profile (Username)', 'Security (Password & 2FA)', 'Edit World', 'Billing', 'Analytics (Coming Soon)'];
const getNav = () => tabs.map(t => `<li class="p-4 mb-2 rounded cursor-pointer nav-item font-bold text-lg">${t}</li>`).join('\n');

const designs = [
  { name: '01-cozy-farming.html', font: 'Quicksand', bg: 'bg-[#f4efe6]', text: 'text-[#5c4a3d]', navClass: 'bg-[#e2d5c4] rounded-2xl p-4 shadow-sm border-2 border-[#d1c2b0]', mainClass: 'bg-white rounded-2xl p-8 border-4 border-[#d1c2b0]', extraCss: '.nav-item:hover { background: #d1c2b0; transform: translateY(-2px); } body { font-family: Quicksand; }' },
  { name: '02-jrpg-classic.html', font: 'Press Start 2P', bg: 'bg-blue-900', text: 'text-white', navClass: 'bg-gradient-to-b from-blue-800 to-blue-900 border-4 border-gray-300 rounded p-4 shadow-[4px_4px_0_rgba(0,0,0,0.5)]', mainClass: 'bg-gradient-to-b from-blue-800 to-blue-900 border-4 border-gray-300 rounded p-8 shadow-[4px_4px_0_rgba(0,0,0,0.5)]', extraCss: 'body { font-family: "Press Start 2P", monospace; font-size: 10px; line-height: 2; } li { position: relative; } li:hover::before { content: "▶ "; position: absolute; left: -20px; }' },
  { name: '03-fantasy-parchment.html', font: 'Cinzel', bg: 'bg-[#cfb997]', text: 'text-[#3e2a14]', navClass: 'border-double border-8 border-[#3e2a14] p-4 bg-[#e3d1b8]', mainClass: 'border-double border-8 border-[#3e2a14] bg-[#e3d1b8] p-8', extraCss: 'body { font-family: Cinzel; background-color: #cfb997; } .nav-item:hover { text-decoration: underline; font-weight: bold; }' },
  { name: '04-arcade-cabinet.html', font: 'VT323', bg: 'bg-gray-900', text: 'text-yellow-400', navClass: 'border-4 border-red-500 bg-black p-4', mainClass: 'border-4 border-blue-500 bg-black p-8', extraCss: 'body { font-family: VT323; font-size: 24px; text-shadow: 2px 2px #ff0000; } .nav-item:hover { background: #222; color: #fff; }' },
  { name: '05-board-game.html', font: 'Bangers', bg: 'bg-green-800', text: 'text-gray-100', navClass: 'bg-green-700 rounded shadow-inner p-4', mainClass: 'bg-[#f7f1e3] text-gray-900 rounded-lg p-8 shadow-[0_10px_0_rgba(0,0,0,0.2)] border border-gray-300', extraCss: 'body { font-family: Bangers; letter-spacing: 1px; } .nav-item { background: white; color: black; border-radius: 8px; border-bottom: 4px solid #ccc; font-size: 20px;} .nav-item:hover { transform: translateY(2px); border-bottom-width: 2px; }' },
  { name: '06-space-hub.html', font: 'Orbitron', bg: 'bg-slate-900', text: 'text-cyan-400', navClass: 'border border-cyan-500/30 bg-slate-800/50 p-4 rounded-xl backdrop-blur-md', mainClass: 'border border-cyan-500/30 bg-slate-800/80 p-8 rounded-xl', extraCss: 'body { font-family: Orbitron; } .nav-item { transition: all 0.2s; } .nav-item:hover { background: rgba(6, 182, 212, 0.2); box-shadow: 0 0 10px rgba(6,182,212,0.5); }' },
  { name: '07-woodland-sign.html', font: 'Caveat', bg: 'bg-[#a3b18a]', text: 'text-[#344e41]', navClass: 'bg-[#dda15e] border-4 border-[#bc6c25] rounded p-4 text-[#fefae0]', mainClass: 'bg-[#fefae0] border-8 border-[#bc6c25] p-8 box-border rounded-lg', extraCss: 'body { font-family: Caveat; font-size: 28px; } .nav-item { background: rgba(0,0,0,0.1); border-radius: 4px; } .nav-item:hover { background: #bc6c25; }' },
  { name: '08-brawler-select.html', font: 'Anton', bg: 'bg-[#ffca28]', text: 'text-gray-900', navClass: 'bg-black text-white p-4 slanted', mainClass: 'bg-white p-8 border-8 border-black shadow-[10px_10px_0_rgba(0,0,0,1)]', extraCss: 'body { font-family: Anton; text-transform: uppercase; } .nav-item { transform: skewX(-10deg); background: #333; margin-bottom: 10px; } .nav-item:hover { background: #ff5252; color: white; }' },
  { name: '09-strategy-map.html', font: 'Rajdhani', bg: 'bg-[#1e272e]', text: 'text-[#d2dae2]', navClass: 'bg-[#485460] rounded-sm p-4 border border-[#808e9b]', mainClass: 'bg-[#2c3e50] bg-opacity-90 border border-[#808e9b] p-8 backdrop-blur p-8 focus', extraCss: 'body { font-family: Rajdhani; font-size: 20px; background-image: radial-gradient(#808e9b 1px, transparent 1px); background-size: 20px 20px; } .nav-item:hover { background: #0fbcf9; color: black; }' },
  { name: '10-pixel-minimal.html', font: 'Silkscreen', bg: 'bg-[#fafafa]', text: 'text-black', navClass: 'border-4 border-black p-4 bg-white shadow-[4px_4px_0_rgba(0,0,0,1)]', mainClass: 'border-4 border-black p-8 bg-white shadow-[8px_8px_0_rgba(0,0,0,1)]', extraCss: 'body { font-family: Silkscreen; background: repeating-linear-gradient(45deg, #f0f0f0, #f0f0f0 10px, #ffffff 10px, #ffffff 20px); } .nav-item { border: 2px solid transparent; } .nav-item:hover { background: black; color: white; }' }
];

designs.forEach(d => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${d.name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=${d.font.replace(/ /g, '+')}&display=swap" rel="stylesheet">
  <style>
    ${d.extraCss}
    .flex-layout { display: flex; gap: 2rem; width: 100%; max-width: 1200px; }
    .sidebar-layout { width: 25%; }
    .main-layout { flex: 1; }
  </style>
</head>
<body class="${d.bg} ${d.text} min-h-screen p-8 flex justify-center items-start">
  <div class="flex-layout mt-10">
    <!-- Sidebar -->
    <nav class="sidebar-layout ${d.navClass}">
      <div class="text-3xl font-bold mb-8 text-center border-b-2 border-current pb-4 tracking-wider">GAME HUB</div>
      <ul class="flex flex-col gap-2">
        ${getNav()}
      </ul>
    </nav>
    <!-- Main Content -->
    <main class="main-layout ${d.mainClass}">
      <h1 class="text-5xl font-bold mb-8">PLAYER PROFILE</h1>
      <div class="grid grid-cols-2 gap-6 mb-8">
        <div class="p-6 bg-black/10 rounded border-2 border-current">
          <p class="opacity-80 uppercase tracking-widest text-sm mb-1">Hero Name</p>
          <p class="text-3xl font-bold">LegendaryPlayer99</p>
        </div>
        <div class="p-6 bg-black/10 rounded border-2 border-current">
          <p class="opacity-80 uppercase tracking-widest text-sm mb-1">Status</p>
          <p class="text-3xl font-bold text-green-500 drop-shadow-md">Online</p>
        </div>
      </div>
      
      <div class="p-8 bg-black/5 rounded outline-dashed outline-2 outline-current h-64 flex flex-col items-center justify-center space-y-4">
        <svg class="w-16 h-16 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
        <p class="opacity-70 text-xl">[ Workspace / World Preview Area ]</p>
      </div>

    </main>
  </div>
</body>
</html>`;
  fs.writeFileSync(path.join(dir, d.name), html);
});

console.log('Successfully generated 10 HTML designs in dashboard-designs folder.');
