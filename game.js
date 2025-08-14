const API_URL = "https://script.google.com/macros/s/AKfycbxaW2ZR74JA3D3o3RvVHO7s9Gnxz9h_qs1uUhrsb-6jJVPCxCvfoCf9XVDiNZQtsB7w/exec";

// Logic Game (Parentheses) — v5 + Top10 (Google Sheets) + colorized timer/slider + colored parentheses
(function(){
  const $ = (sel) => document.querySelector(sel);

  // Screens
  const startScreen = $('#start-screen');
  const menuScreen = $('#menu-screen');
  const gameScreen = $('#game-screen');
  const summaryScreen = $('#summary-screen');
  const leaderboardScreen = $('#leaderboard-screen');

  // Controls
  const playerIdInput = $('#player-id');
  const startBtn = $('#start-btn');
  const playBtn = $('#play-btn');
  const leaderboardBtn = $('#leaderboard-btn');
  const leaderboardBack = $('#leaderboard-back');

  // HUD
  const hudPlayer = $('#hud-player');
  const hudDiff = $('#hud-diff');
  const hudQ = $('#hud-q');
  const hudScore = $('#hud-score');
  const timerBar = $('#timer-bar');
  const timerText = $('#timer-text');

  // Game UI
  const targetVal = $('#target-val');
  const expression = $('#expression');
  const checkBtn = $('#check-btn');
  const skipBtn = $('#skip-btn');
  const feedback = $('#feedback');

  // Summary & menu
  const backMenuBtn = $('#back-menu-btn');
  const playAgainBtn = $('#play-again-btn');
  const diffSlider = $('#difficulty');
  const lastPlayer = $('#last-player');
  const summaryDiv = $('#summary');
  const leaderboardDiv = $('#leaderboard');

  const OPS = ['∧','∨','→','↔'];

  let state = {
    player: '',
    difficulty: 3,
    qIndex: 0,
    totalQ: 10,
    score: 0,
    correct: 0,
    times: [],
    current: { tree:null, selects:[], target:true },
    timer: { max:30, left:30, id:null },
    finished: false,
    hasSaved: false
  };

  // ====== Google Apps Script endpoint ======
  const API_URL = 'https://script.google.com/macros/s/XXXXXXXXXXXX/exec'; // <-- ใส่ของครู

  async function submitScore(payload){
    try{
      await fetch(API_URL, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });
    }catch(e){
      console.warn('submitScore error', e);
    }
  }

  async function fetchTop10() {
    try{
      const res = await fetch(`${API_URL}?action=top10`, { method:'GET' });
      const data = await res.json();
      if(!data.ok) throw new Error(data.error || 'fetch top10 failed');
      return data.top || [];
    }catch(e){
      console.warn('Top10 error:', e);
      return [];
    }
  }

  function renderTop10(list, mountEl) {
    if(!mountEl) return;
    if(!list.length){
      mountEl.innerHTML = '<div class="muted">ยังไม่มีข้อมูล</div>';
      return;
    }
    let html = '<table><thead><tr><th>#</th><th>ชื่อ</th><th>ยาก</th><th>คะแนน</th></tr></thead><tbody>';
    list.forEach((r,i)=>{
      html += `<tr>
        <td>${i+1}</td>
        <td>${escapeHtml(r.player || '-')}</td>
        <td>${r.difficulty ?? '-'}</td>
        <td>${r.score ?? '-'}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    mountEl.innerHTML = html;
  }

  // ป้องกัน XSS ง่าย ๆ
  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // ===== Helpers =====
  // เวลา: ยาก1=10s → ยาก10=60s (แก้เป็น 10 + 5.555*(d-1) ถ้าอยากกลับไป 60 วินาที)
  function secondsForDifficulty(d){
    // เวอร์ชันที่คุณตั้งไว้: 10 + 7*(d-1)  → ยาก10 = 73s
    const sec = 10 + (d-1)*7;
    return Math.round(sec);
  }
  function show(el){ el.classList.remove('hidden'); }
  function hide(el){ el.classList.add('hidden'); }
  function updateHudScore(){ hudScore.textContent = state.score; }

  // ===== สี: ฟ้า(น้อย) → แดง(มาก) =====
  function colorFromT(t) {
    const hue = 210 * (1 - t);   // 0→ฟ้า(210), 1→แดง(0)
    const sat = 90, light = 50;
    return `hsl(${hue}, ${sat}%, ${light}%)`;
  }

  function updateDifficultyTheme() {
    const slider = document.getElementById('difficulty');
    const badge  = document.getElementById('diff-val');
    const min = parseInt(slider.min || '1', 10);
    const max = parseInt(slider.max || '10', 10);
    const val = parseInt(slider.value, 10);
    const t = (val - min) / (max - min);
    const color = colorFromT(t);
    const pct = ((val - min) / (max - min)) * 100;

    slider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #e6e9f2 ${pct}%, #e6e9f2 100%)`;
    slider.style.setProperty('--thumb-color', color);
    badge.style.background = color;
    badge.style.border = `1px solid ${color}`;
  }

  // ===== นิพจน์แบบต้นไม้ + วงเล็บสีตามชั้น =====
  function randomTree(nLeaves){
    let idx=0;
    function build(n){
      if(n===1) return {type:'leaf', index: idx++};
      const split = 1 + Math.floor(Math.random()*(n-1));
      const left = build(split);
      const right = build(n-split);
      const op = OPS[Math.floor(Math.random()*OPS.length)];
      return {type:'op', op, left, right};
    }
    return build(nLeaves);
  }
  function opEval(a,op,b){
    switch(op){
      case '∧': return a && b;
      case '∨': return a || b;
      case '→': return (!a) || b;
      case '↔': return a === b;
      default: return false;
    }
  }
  function evalTree(node, vals){
    if(node.type==='leaf') return vals[node.index];
    const lv = evalTree(node.left, vals);
    const rv = evalTree(node.right, vals);
    return opEval(lv, node.op, rv);
  }

  function renderTreeBlank(node, depth = 0){
    if(node.type === 'leaf'){
      const tok = document.createElement('div'); tok.className = 'token';
      const sel = document.createElement('select'); sel.className = 'tf placeholder';
      const opt0 = document.createElement('option'); opt0.value = ''; opt0.textContent = '—'; opt0.disabled = true; opt0.selected = true;
      const optT = document.createElement('option'); optT.value = 'T'; optT.textContent = 'T';
      const optF = document.createElement('option'); optF.value = 'F'; optF.textContent = 'F';
      sel.appendChild(opt0); sel.appendChild(optT); sel.appendChild(optF);
      tok.appendChild(sel); expression.appendChild(tok);
      state.current.selects.push(sel);
      return;
    }
    const depthClass = `paren-depth-${depth % 6}`;

    const lpar = document.createElement('div');
    lpar.className = 'paren ' + depthClass;
    lpar.textContent = '(';
    expression.appendChild(lpar);

    renderTreeBlank(node.left, depth + 1);

    const opEl = document.createElement('div');
    opEl.className = 'operator';
    opEl.textContent = node.op;
    expression.appendChild(opEl);

    renderTreeBlank(node.right, depth + 1);

    const rpar = document.createElement('div');
    rpar.className = 'paren ' + depthClass;
    rpar.textContent = ')';
    expression.appendChild(rpar);
  }

  function hasMixedSolution(tree, target, nLeaves){
    const total = 1<<nLeaves;
    for(let mask=1; mask<total-1; mask++){ // ข้าม all-0 และ all-1
      const vals = Array.from({length:nLeaves}, (_,i)=> !!(mask & (1<<i)));
      if(evalTree(tree, vals) === target) return true;
    }
    return false;
  }

  // ===== Timer (สีไล่ตามเวลา) =====
  function setTimer(seconds){
    clearInterval(state.timer.id);
    state.timer.max = seconds;
    state.timer.left = seconds;

    timerText.textContent = `${Math.ceil(state.timer.left)} วิ`;
    timerBar.style.width = '100%';
    timerBar.style.background = colorFromT(0); // ฟ้า

    state.timer.id = setInterval(()=>{
      state.timer.left -= 0.1;
      const left = Math.max(0, state.timer.left);
      const fracLeft = left / state.timer.max; // 1→เต็ม, 0→หมด
      const usedT = 1 - fracLeft;              // 0→ฟ้า, 1→แดง
      const color = colorFromT(usedT);

      if(left <= 0){
        clearInterval(state.timer.id);
        state.timer.left = 0;
        timerText.textContent = 'หมดเวลา';
        timerBar.style.width = '0%';
        timerBar.style.background = color;
        lockInputs(true);
        feedback.innerHTML = '<span class="incorrect">หมดเวลา! ลองข้อถัดไปนะ</span>';
        if(!state.finished) setTimeout(nextQuestion, 800);
      }else{
        timerText.textContent = `${Math.ceil(left)} วิ`;
        timerBar.style.width = (fracLeft*100) + '%';
        timerBar.style.background = color;
      }
    }, 100);
  }

  function lockInputs(disabled){
    state.current.selects.forEach(sel=>sel.disabled=disabled);
    checkBtn.disabled=disabled; skipBtn.disabled=disabled;
  }

  // ===== สุ่มโจทย์ (กันเดา) =====
  function generateQuestion(){
    const nLeaves = state.difficulty + 1;
    while(true){
      const tree = randomTree(nLeaves);
      const target = Math.random() < 0.5;

      if (state.difficulty > 1) {
        const allT = Array(nLeaves).fill(true);
        const allF = Array(nLeaves).fill(false);
        const valAllT = evalTree(tree, allT);
        const valAllF = evalTree(tree, allF);
        if (valAllT === target || valAllF === target) continue; // กัน all-same
        if (!hasMixedSolution(tree, target, nLeaves)) continue;  // ต้องมีชุดผสม
      }
      return { tree, target };
    }
  }

  function newQuestion(){
    if(state.finished) return;
    expression.innerHTML=''; state.current.selects=[];
    const q = generateQuestion();
    state.current.tree = q.tree;
    state.current.target = q.target;
    hudQ.textContent=`${state.qIndex+1}/${state.totalQ}`;
    targetVal.textContent = state.current.target ? 'T' : 'F';
    renderTreeBlank(state.current.tree, 0);
    feedback.textContent=''; lockInputs(false);
    setTimer(secondsForDifficulty(state.difficulty));
  }

  function nextQuestion(){
    if(state.finished) return;
    state.times.push(state.timer.max - state.timer.left);
    state.qIndex += 1;
    if(state.qIndex >= state.totalQ){
      endGame();
    }else{
      newQuestion();
    }
  }

  function endGame(){
    if(state.finished) return;
    state.finished = true;
    clearInterval(state.timer.id);
    hide(gameScreen); show(summaryScreen);
    const avg = state.times.length ? state.times.reduce((a,b)=>a+b,0)/state.times.length : 0;
    const now = new Date(); const stamp = now.toLocaleString('th-TH');
    summaryDiv.innerHTML = `
      <p><strong>ผู้เล่น:</strong> ${state.player}</p>
      <p><strong>ความยาก:</strong> ${state.difficulty}</p>
      <p><strong>คะแนนรวม:</strong> ${state.score}</p>
      <p><strong>ตอบถูก:</strong> ${state.correct}/${state.totalQ}</p>
      <p><strong>เวลาเฉลี่ย/ข้อ:</strong> ${avg.toFixed(1)} วิ</p>
    `;

    // ส่งขึ้นชีต (ครั้งเดียว)
    if(!state.hasSaved){
      state.hasSaved = true;
      const payload = {
        timestamp: stamp,
        player: state.player,
        difficulty: state.difficulty,
        score: state.score,
        correct: state.correct,
        totalQ: state.totalQ,
        avgTime: +avg.toFixed(2)
      };
      submitScore(payload);
    }

    // โหลด Top10 สำหรับหน้าสรุป
    fetchTop10().then(list => {
      renderTop10(list, document.getElementById('top10-summary-table'));
    });
  }

  function allSelected(){
    return state.current.selects.every(sel => sel.value==='T' || sel.value==='F');
  }

  function checkAnswer(){
    if(state.finished) return;
    if(!allSelected()){
      feedback.innerHTML = '<span class="muted">โปรดเลือกค่า T/F ให้ครบทุกตำแหน่งก่อนตรวจคำตอบ</span>';
      return;
    }
    clearInterval(state.timer.id);
    lockInputs(true);
    const vals = state.current.selects.map(sel => sel.value==='T');
    const val = evalTree(state.current.tree, vals);
    const correct = (val === state.current.target);
    if(correct){
      const remaining = Math.max(0, state.timer.left);
      const gained = Math.floor((100 + 10*remaining) * state.difficulty); // สูตรที่คุณตั้งไว้
      state.score += gained; state.correct += 1;
      updateHudScore();
      feedback.innerHTML = `<span class="correct">ถูกต้อง! +${gained} คะแนน</span>`;
    }else{
      const penalty = 100 * state.difficulty; // สูตรที่คุณตั้งไว้
      state.score -= penalty;
      updateHudScore();
      feedback.innerHTML = `<span class="incorrect">ตอบผิด −${penalty} คะแนน</span>`;
    }
    setTimeout(nextQuestion, 700);
  }

  // ==== Theme init ====
  updateDifficultyTheme();
  diffSlider.addEventListener('input', updateDifficultyTheme);

  // ==== Events ====
  startBtn.addEventListener('click', ()=>{
    const name = playerIdInput.value.trim();
    if(!name){ playerIdInput.focus(); playerIdInput.placeholder='กรุณากรอกชื่อก่อนครับ'; return; }
    try{ localStorage.setItem('logic_game_last_player', name);}catch(e){}
    hide(startScreen); show(menuScreen);
    lastPlayer.textContent=`ผู้เล่นล่าสุด: ${name}`;

    // โหลด Top10 ที่หน้าเมนู
    fetchTop10().then(list => {
      renderTop10(list, document.getElementById('top10-menu-table'));
    });
  });

  playBtn.addEventListener('click', ()=>{
    state.player = (localStorage.getItem('logic_game_last_player') || playerIdInput.value.trim());
    state.difficulty = parseInt(diffSlider.value,10);
    state.qIndex=0; state.totalQ=10; state.score=0; state.correct=0; state.times=[]; state.finished=false; state.hasSaved=false;
    hudPlayer.textContent=state.player||'-'; hudDiff.textContent=state.difficulty; updateHudScore();
    hide(menuScreen); hide(summaryScreen); show(gameScreen); newQuestion();
  });

  leaderboardBtn.addEventListener('click', ()=>{ hide(menuScreen); show(leaderboardScreen); renderLeaderboard(); });

  backMenuBtn.addEventListener('click', ()=>{
    hide(summaryScreen); show(menuScreen);
    fetchTop10().then(list => {
      renderTop10(list, document.getElementById('top10-menu-table'));
    });
  });

  leaderboardBack.addEventListener('click', ()=>{
    hide(leaderboardScreen); show(menuScreen);
    fetchTop10().then(list => {
      renderTop10(list, document.getElementById('top10-menu-table'));
    });
  });

  playAgainBtn.addEventListener('click', ()=>{
    hide(summaryScreen); show(gameScreen);
    state.qIndex=0; state.score=0; state.correct=0; state.times=[]; state.finished=false; state.hasSaved=false; updateHudScore();
    newQuestion();
  });

  checkBtn.addEventListener('click', checkAnswer);
  skipBtn.addEventListener('click', ()=>{
    if(state.finished) return;
    clearInterval(state.timer.id);
    feedback.innerHTML='<span class="muted">ข้ามข้อนี้ (ไม่เสียคะแนน)</span>';
    setTimeout(nextQuestion, 400);
  });

  function renderLeaderboard(){
    let rows=[];
    try{ rows = JSON.parse(localStorage.getItem('logic_game_results_paren')||'[]').reverse(); }catch(e){ rows=[]; }
    if(rows.length===0){ leaderboardDiv.innerHTML='<p class="muted">ยังไม่มีสถิติ</p>'; return; }
    let html='<table><thead><tr><th>เวลา</th><th>ผู้เล่น</th><th>ยาก</th><th>คะแนน</th><th>ถูก</th><th>เวลาเฉลี่ย/ข้อ</th></tr></thead><tbody>';
    for(const r of rows){
      html+=`<tr><td>${r.timestamp}</td><td>${r.player}</td><td>${r.difficulty}</td><td>${r.score}</td><td>${r.correct}/${r.totalQ}</td><td>${r.avgTime.toFixed(1)} วิ</td></tr>`;
    }
    html+='</tbody></table>'; leaderboardDiv.innerHTML=html;
  }

  // โหลด Top10 หน้าครั้งแรก (ถ้าครูอยากให้ขึ้นเลยก่อนกดปุ่ม)
  document.addEventListener('DOMContentLoaded', ()=>{
    const mount = document.getElementById('top10-menu-table');
    if(mount){
      fetchTop10().then(list => renderTop10(list, mount));
    }
  });

  const last = (localStorage.getItem('logic_game_last_player')||'');
  if(last){ playerIdInput.value=last; lastPlayer.textContent = `ผู้เล่นล่าสุด: ${last}`; }
})();
