// Logic Game (Parentheses) — v4: enforce using both T and F + full timer/HUD
(function(){
  const $ = (sel) => document.querySelector(sel);

  const startScreen = $('#start-screen');
  const menuScreen = $('#menu-screen');
  const gameScreen = $('#game-screen');
  const summaryScreen = $('#summary-screen');
  const leaderboardScreen = $('#leaderboard-screen');

  const playerIdInput = $('#player-id');
  const startBtn = $('#start-btn');
  const playBtn = $('#play-btn');
  const leaderboardBtn = $('#leaderboard-btn');
  const leaderboardBack = $('#leaderboard-back');

  const hudPlayer = $('#hud-player');
  const hudDiff = $('#hud-diff');
  const hudQ = $('#hud-q');
  const hudScore = $('#hud-score');

  const timerBar = $('#timer-bar');
  const timerText = $('#timer-text');

  const targetVal = $('#target-val');
  const expression = $('#expression');

  const checkBtn = $('#check-btn');
  const skipBtn = $('#skip-btn');
  const feedback = $('#feedback');

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
    current: { tree:null, leaves:[], target:true },
    timer: { max:30, left:30, id:null },
    finished: false,
    hasSaved: false
  };

  function randomTree(nLeaves){
    let idx = 0;
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

  function renderTreeToDOM(node){
    if(node.type==='leaf'){
      const tok=document.createElement('div'); tok.className='token';
      const sel=document.createElement('select'); sel.className='tf';
      sel.innerHTML='<option value="T">T</option><option value="F">F</option>';
      tok.appendChild(sel); expression.appendChild(tok);
      state.current.leaves.push(sel); return;
    }
    const lpar=document.createElement('div'); lpar.className='paren'; lpar.textContent='('; expression.appendChild(lpar);
    renderTreeToDOM(node.left);
    const opEl=document.createElement('div'); opEl.className='operator'; opEl.textContent=node.op; expression.appendChild(opEl);
    renderTreeToDOM(node.right);
    const rpar=document.createElement('div'); rpar.className='paren'; rpar.textContent=')'; expression.appendChild(rpar);
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

  function randomTarget(){ return Math.random()<0.5; }
  function secondsForDifficulty(d){ return Math.max(15, 45-3*d); }

  function show(el){ el.classList.remove('hidden'); }
  function hide(el){ el.classList.add('hidden'); }

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
    state.current.leaves.forEach(sel=>sel.disabled=disabled);
    checkBtn.disabled=disabled; skipBtn.disabled=disabled;
  }

  function updateHudScore(){ hudScore.textContent = state.score; }

  function ensureAtLeastOneTandF(){
    const values = state.current.leaves.map(sel=>sel.value);
    const hasT = values.includes('T');
    const hasF = values.includes('F');
    if(!(hasT && hasF)){
      // Flip one item to guarantee both exist
      const i = Math.floor(Math.random()*state.current.leaves.length);
      state.current.leaves[i].value = hasT ? 'F' : 'T';
    }
  }

  function newQuestion(){
    if(state.finished) return;
    expression.innerHTML=''; state.current.leaves=[];
    const nLeaves = state.difficulty+1;
    state.current.tree = randomTree(nLeaves);
    state.current.target = randomTarget();
    hudQ.textContent=`${state.qIndex+1}/${state.totalQ}`;
    targetVal.textContent = state.current.target ? 'T':'F';
    renderTreeToDOM(state.current.tree);

    // Random initial fill then enforce diversity
    state.current.leaves.forEach(sel=>{ sel.value = (Math.random()<0.5?'T':'F'); });
    ensureAtLeastOneTandF();

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

  function checkAnswer(){
    if(state.finished) return;
    const values = state.current.leaves.map(sel=>sel.value);
    const hasT = values.includes('T');
    const hasF = values.includes('F');
    if(!(hasT && hasF)){
      feedback.innerHTML = '<span class="muted">ต้องมีทั้ง <strong>T</strong> และ <strong>F</strong> อย่างน้อยอย่างละ 1 ตัวก่อนตรวจคำตอบ</span>';
      return;
    }

    clearInterval(state.timer.id);
    lockInputs(true);
    const vals = values.map(v=>v==='T');
    const val = evalTree(state.current.tree, vals);
    const correct = (val===state.current.target);
    if(correct){
      const remaining = Math.max(0, state.timer.left);
      const gained = Math.floor((100 + 5*remaining) * state.difficulty);
      state.score += gained; state.correct += 1;
      updateHudScore();
      feedback.innerHTML=`<span class="correct">ถูกต้อง! +${gained} คะแนน</span>`;
    }else{
      state.score -= 200;
      updateHudScore();
      feedback.innerHTML=`<span class="incorrect">ตอบผิด −200 คะแนน (ผลลัพธ์ที่ต้องการคือ ${state.current.target?'T':'F'})</span>`;
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

  const last = (localStorage.getItem('logic_game_last_player')||'');
  if(last){ playerIdInput.value=last; lastPlayer.textContent=`ผู้เล่นล่าสุด: ${last}`; }
})();