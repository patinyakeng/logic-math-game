// Logic Game (Parentheses) — v5 fixes
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

  // Helpers
  function secondsForDifficulty(d){
    // linear 1->10s ... 10->60s
    const sec = 10 + (d-1)*(50/9);
    return Math.round(sec);
  }
  function show(el){ el.classList.remove('hidden'); }
  function hide(el){ el.classList.add('hidden'); }
  function updateHudScore(){ hudScore.textContent = state.score; }

  // ===== Color helpers: ฟ้า(ระดับต่ำ/เวลาเยอะ) → แดงเข้ม(ระดับสูง/เวลาใกล้หมด) =====
// t ∈ [0,1] ; 0 = ฟ้า, 1 = แดงเข้ม
function colorFromT(t) {
  // ใช้ HSL ไล่ hue: ฟ้า ~210° → แดง ~0°
  const hue = 210 * (1 - t);      // t=0 -> 210 (ฟ้า), t=1 -> 0 (แดง)
  const sat = 90;                  // saturation %
  const light = 50;                // lightness  %
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

// อัปเดตสีของสไลเดอร์ความยาก + ป้ายค่า
function updateDifficultyTheme() {
  const slider = document.getElementById('difficulty');
  const badge  = document.getElementById('diff-val');
  const min = parseInt(slider.min || '1', 10);
  const max = parseInt(slider.max || '10', 10);
  const val = parseInt(slider.value, 10);

  // ทำให้ t = 0 เมื่อระดับต่ำสุด, 1 เมื่อระดับสูงสุด
  const t = (val - min) / (max - min);
  const color = colorFromT(t);
  const pct = ((val - min) / (max - min)) * 100;

  // รางไล่สีด้านซ้ายเป็นสีตามระดับ, ด้านขวาเทา
  slider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #e6e9f2 ${pct}%, #e6e9f2 100%)`;
  // หัวแม่มือให้เข้ากับสี
  slider.style.setProperty('--thumb-color', color);
  // Firefox ไม่มีตัวแปรนี้ ให้ใช้ inline กับ ::-moz-range-thumb ไม่ได้ จึงพอแค่ track ก็โอเค

  // ป้ายค่าความยาก ไล่สีตาม
  badge.style.background = color;
  badge.style.border = `1px solid ${color}`;
}

  // Tree
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

  // Render blank selects (no default)
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


  // Search for non-trivial satisfying assignment
  function hasMixedSolution(tree, target, nLeaves){
    const total = 1<<nLeaves;
    for(let mask=1; mask<total-1; mask++){ // skip all-0 and all-1
      const vals = Array.from({length:nLeaves}, (_,i)=> !!(mask & (1<<i)));
      if(evalTree(tree, vals) === target) return true;
    }
    return false;
  }

  // Timer
  function setTimer(seconds){
    clearInterval(state.timer.id);
    state.timer.max=seconds; state.timer.left=seconds;
    timerText.textContent=`${Math.ceil(state.timer.left)} วิ`; timerBar.style.width='100%';
    state.timer.id=setInterval(()=>{
      state.timer.left-=0.1;
      if(state.timer.left<=0){
        clearInterval(state.timer.id);
        state.timer.left=0; timerText.textContent='หมดเวลา'; timerBar.style.width='0%';
        lockInputs(true);
        feedback.innerHTML='<span class="incorrect">หมดเวลา! ลองข้อถัดไปนะ</span>';
        if(!state.finished) setTimeout(nextQuestion, 800);
      }else{
        timerText.textContent=`${Math.ceil(state.timer.left)} วิ`;
        timerBar.style.width=((state.timer.left/state.timer.max)*100)+'%';
      }
    },100);
  }
  function lockInputs(disabled){
    state.current.selects.forEach(sel=>sel.disabled=disabled);
    checkBtn.disabled=disabled; skipBtn.disabled=disabled;
  }

  // Generate question with constraints:
  // - target random
  // - blank literals (no default)
  // - reject if all-T or all-F would satisfy target
  // - require existence of at least one mixed assignment that satisfies target
  function generateQuestion(){
  const nLeaves = state.difficulty + 1;
  let trials = 0;
  while(true){
    trials++;
    const tree = randomTree(nLeaves);
    const target = Math.random() < 0.5;

    // --- เงื่อนไขกันเดา: ใช้เฉพาะระดับ > 1 ---
    if (state.difficulty > 1) {
      const allT = Array(nLeaves).fill(true);
      const allF = Array(nLeaves).fill(false);
      const valAllT = evalTree(tree, allT);
      const valAllF = evalTree(tree, allF);

      // คัดทิ้งโจทย์ที่ all-T หรือ all-F ให้ค่าเท่ากับเป้าหมาย
      if (valAllT === target || valAllF === target) continue;

      // ต้องมีอย่างน้อย 1 ค่าผสม T/F ที่ทำให้ได้เป้าหมาย
      if (!hasMixedSolution(tree, target, nLeaves)) continue;
    }
    // ---------------------------------------------

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
    if(!state.hasSaved){
      state.hasSaved = true;
      try{
        const key='logic_game_results_paren';
        const arr=JSON.parse(localStorage.getItem(key)||'[]');
        arr.push({timestamp:stamp, player:state.player, difficulty:state.difficulty, score:state.score, correct:state.correct, totalQ:state.totalQ, avgTime:avg});
        localStorage.setItem(key, JSON.stringify(arr));
      }catch(e){}
    }
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
      const gained = Math.floor((100 + 5*remaining) * state.difficulty);
      state.score += gained; state.correct += 1;
      updateHudScore();
      feedback.innerHTML = `<span class="correct">ถูกต้อง! +${gained} คะแนน</span>`;
    }else{
      const penalty = 200 * state.difficulty;
      state.score -= penalty;
      updateHudScore();
      feedback.innerHTML = `<span class="incorrect">ตอบผิด −${penalty} คะแนน</span>`;
    }
    setTimeout(nextQuestion, 700);
  }

  // Events
  startBtn.addEventListener('click', ()=>{
    const name = playerIdInput.value.trim();
    if(!name){ playerIdInput.focus(); playerIdInput.placeholder='กรุณากรอกชื่อก่อนครับ'; return; }
    try{ localStorage.setItem('logic_game_last_player', name);}catch(e){}
    hide(startScreen); show(menuScreen);
    lastPlayer.textContent=`ผู้เล่นล่าสุด: ${name}`;
  });
  playBtn.addEventListener('click', ()=>{
    state.player = (localStorage.getItem('logic_game_last_player') || playerIdInput.value.trim());
    state.difficulty = parseInt(diffSlider.value,10);
    state.qIndex=0; state.totalQ=10; state.score=0; state.correct=0; state.times=[]; state.finished=false; state.hasSaved=false;
    hudPlayer.textContent=state.player||'-'; hudDiff.textContent=state.difficulty; updateHudScore();
    hide(menuScreen); hide(summaryScreen); show(gameScreen); newQuestion();
  });
  leaderboardBtn.addEventListener('click', ()=>{ hide(menuScreen); show(leaderboardScreen); renderLeaderboard(); });
  leaderboardBack.addEventListener('click', ()=>{ hide(leaderboardScreen); show(menuScreen); });
  backMenuBtn.addEventListener('click', ()=>{ hide(summaryScreen); show(menuScreen); });
  playAgainBtn.addEventListener('click', ()=>{
    hide(summaryScreen); show(gameScreen);
    state.qIndex=0; state.score=0; state.correct=0; state.times=[]; state.finished=false; state.hasSaved=false; updateHudScore();
    newQuestion();
  });
  $('#check-btn').addEventListener('click', checkAnswer);
  $('#skip-btn').addEventListener('click', ()=>{
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

  const last = (localStorage.getItem('logic_game_last_player')||'');
  if(last){ playerIdInput.value=last; lastPlayer.textContent = `ผู้เล่นล่าสุด: ${last}`; }
})();
