// Logic Game (Drag Operators) — Guaranteed solvable questions
(function(){
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const OPS = ['∧','∨','→','↔'];

  // Elements
  const startScreen=$('#start-screen'), menuScreen=$('#menu-screen'), gameScreen=$('#game-screen'), summaryScreen=$('#summary-screen'), leaderboardScreen=$('#leaderboard-screen');
  const playerIdInput=$('#player-id'), startBtn=$('#start-btn'), playBtn=$('#play-btn'), leaderboardBtn=$('#leaderboard-btn'), leaderboardBack=$('#leaderboard-back');
  const hudPlayer=$('#hud-player'), hudDiff=$('#hud-diff'), hudQ=$('#hud-q'), hudScore=$('#hud-score');
  const timerBar=$('#timer-bar'), timerText=$('#timer-text');
  const targetVal=$('#target-val'), expression=$('#expression'), palette=$('#palette'), resetOpsBtn=$('#reset-ops');
  const checkBtn=$('#check-btn'), skipBtn=$('#skip-btn'), feedback=$('#feedback');
  const backMenuBtn=$('#back-menu-btn'), playAgainBtn=$('#play-again-btn');
  const diffSlider=$('#difficulty'), lastPlayer=$('#last-player');
  const summaryDiv=$('#summary'), leaderboardDiv=$('#leaderboard');

  let state = {
    player:'',
    difficulty:3,
    qIndex:0,
    totalQ:10,
    score:0,
    correct:0,
    times:[],
    finished:false, hasSaved:false,
    timer:{max:30,left:30,id:null},
    // current question
    tree:null,            // expression tree (structure only)
    leavesVals:[],        // randomized T/F literals
    target:true,
    slots:[],             // DOM slots for operators
    bag:[],               // multiset of operators in palette (shuffled)
    solutionOps:[]        // hidden sequence that guarantees solvability
  };

  function boolToTF(b){ return b?'T':'F'; }
  function randomBool(){ return Math.random()<0.5; }
  function secondsForDifficulty(d){ return Math.max(15, 45 - 3*d); }
  function show(el){ el.classList.remove('hidden'); }
  function hide(el){ el.classList.add('hidden'); }
  function updateHud(){ hudScore.textContent = state.score; hudDiff.textContent = state.difficulty; hudPlayer.textContent = state.player || '-'; }

  // Build random full binary tree with given number of leaves
  function randomTree(nLeaves){
    function build(n){
      if(n===1) return {type:'leaf', index: -1};
      const split = 1 + Math.floor(Math.random()*(n-1));
      return {type:'op', left:build(split), right:build(n-split)};
    }
    return build(nLeaves);
  }

  // Evaluate tree with an operator sequence (in-order) and leaf values
  function evalOp(a,op,b){
    switch(op){
      case '∧': return a && b;
      case '∨': return a || b;
      case '→': return (!a) || b;
      case '↔': return a === b;
      default: return false;
    }
  }
  function evalTreeWithOps(node, leafVals, ops, stateObj){
    if(node.type==='leaf'){
      const idx = stateObj.nextLeaf++;
      return leafVals[idx];
    }
    const lv = evalTreeWithOps(node.left, leafVals, ops, stateObj);
    const op = ops[stateObj.nextOp++];
    const rv = evalTreeWithOps(node.right, leafVals, ops, stateObj);
    return evalOp(lv, op, rv);
  }

  // Render tree to DOM with parentheses and create empty operator slots
  function renderTree(node, assign){
    if(node.type==='leaf'){
      const idx = assign.nextLeaf++;
      node.index = idx;
      const lit = document.createElement('span');
      lit.className='literal';
      lit.textContent = boolToTF(state.leavesVals[idx]);
      expression.appendChild(lit);
      return;
    }
    const lpar=document.createElement('span'); lpar.className='paren'; lpar.textContent='(';
    expression.appendChild(lpar);

    renderTree(node.left, assign);

    const slot=document.createElement('span');
    slot.className='slot'; slot.setAttribute('data-slot','');
    slot.setAttribute('aria-label','วางตัวเชื่อมที่นี่');
    slot.addEventListener('dragover', e=>{ e.preventDefault(); });
    slot.addEventListener('drop', onDropOperator);
    expression.appendChild(slot);
    state.slots.push(slot);

    renderTree(node.right, assign);

    const rpar=document.createElement('span'); rpar.className='paren'; rpar.textContent=')';
    expression.appendChild(rpar);
  }

  // Palette and drag drop
  function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
  function drawPalette(){
    palette.innerHTML='';
    state.bag.forEach((op, idx)=>{
      const btn=document.createElement('div');
      btn.className='op'; btn.textContent=op;
      btn.setAttribute('draggable','true');
      btn.dataset.index=idx;
      btn.addEventListener('dragstart', e=>{
        e.dataTransfer.setData('text/plain', JSON.stringify({op}));
      });
      palette.appendChild(btn);
    });
  }
  function onDropOperator(e){
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData('text/plain')||'{}');
    if(!data || !data.op) return;
    const slot = e.currentTarget;
    // return existing op to bag
    if(slot.dataset.op){
      state.bag.push(slot.dataset.op);
    }
    // place new op
    slot.textContent=data.op;
    slot.classList.add('filled');
    slot.dataset.op = data.op;
    // remove one instance of op from bag
    const k = state.bag.indexOf(data.op);
    if(k>=0){ state.bag.splice(k,1); }
    drawPalette();
  }
  function resetSlots(){
    state.slots.forEach(s=>{
      if(s.dataset.op){ state.bag.push(s.dataset.op); }
      s.textContent=''; s.classList.remove('filled'); delete s.dataset.op;
    });
    drawPalette();
  }

  function allSlotsFilled(){ return state.slots.every(s => !!s.dataset.op); }

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
  function lockInputs(disabled){ checkBtn.disabled=disabled; skipBtn.disabled=disabled; }

  // Generate SOLVABLE question
  function newQuestion(){
    if(state.finished) return;
    expression.innerHTML=''; palette.innerHTML=''; state.slots=[];
    const nLeaves = state.difficulty + 1;
    state.tree = randomTree(nLeaves);
    state.leavesVals = Array.from({length:nLeaves}, ()=>randomBool());

    // Create a hidden solution operator sequence (length = number of slots = difficulty)
    state.solutionOps = Array.from({length: state.difficulty}, ()=> OPS[Math.floor(Math.random()*OPS.length)]);
    // Compute target from this solution
    const result = evalTreeWithOps(state.tree, state.leavesVals, state.solutionOps.slice(), {nextLeaf:0, nextOp:0});
    state.target = result;

    // Render expression with empty slots
    renderTree(state.tree, {nextLeaf:0});
    // Give the player a shuffled bag that matches the solution multiset (guaranteed solvable)
    state.bag = shuffle(state.solutionOps.slice());
    drawPalette();

    $('#hud-q').textContent = `${state.qIndex+1}/${state.totalQ}`;
    targetVal.textContent = boolToTF(state.target);
    feedback.textContent='';
    lockInputs(false);
    setTimer(secondsForDifficulty(state.difficulty));
  }

  function getChosenOps(){
    return state.slots.map(s => s.dataset.op);
  }

  function evalWithChosenOps(){
    const ops = getChosenOps();
    return evalTreeWithOps(state.tree, state.leavesVals, ops, {nextLeaf:0, nextOp:0});
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
    if(!allSlotsFilled()){
      feedback.innerHTML = '<span class="muted">โปรดลากตัวเชื่อมให้ครบทุกช่องก่อนตรวจคำตอบ</span>';
      return;
    }
    clearInterval(state.timer.id);
    lockInputs(true);
    const val = evalWithChosenOps();
    const correct = (val === state.target);
    if(correct){
      const remaining = Math.max(0, state.timer.left);
      const gained = Math.floor((100 + 5*remaining) * state.difficulty);
      state.score += gained; state.correct += 1;
      hudScore.textContent = state.score;
      feedback.innerHTML = `<span class="correct">ถูกต้อง! +${gained} คะแนน</span>`;
    }else{
      state.score -= 200;
      hudScore.textContent = state.score;
      feedback.innerHTML = `<span class="incorrect">ตอบผิด −200 คะแนน</span>`;
    }
    setTimeout(nextQuestion, 700);
  }

  // Leaderboard (local)
  function renderLeaderboard(){
    let rows = [];
    try{ rows = JSON.parse(localStorage.getItem('logic_game_results_paren')||'[]').reverse(); }catch(e){ rows=[]; }
    if(rows.length===0){ leaderboardDiv.innerHTML = '<p class="muted">ยังไม่มีสถิติ</p>'; return; }
    let html = '<table><thead><tr><th>เวลา</th><th>ผู้เล่น</th><th>ยาก</th><th>คะแนน</th><th>ถูก</th><th>เวลาเฉลี่ย/ข้อ</th></tr></thead><tbody>';
    for(const r of rows){
      html += `<tr><td>${r.timestamp}</td><td>${r.player}</td><td>${r.difficulty}</td><td>${r.score}</td><td>${r.correct}/${r.totalQ}</td><td>${r.avgTime.toFixed(1)} วิ</td></tr>`;
    }
    html += '</tbody></table>'; leaderboardDiv.innerHTML = html;
  }

  // Events
  $('#reset-ops').addEventListener('click', resetSlots);

  startBtn.addEventListener('click', ()=>{
    const name = playerIdInput.value.trim();
    if(!name){ playerIdInput.focus(); playerIdInput.placeholder='กรุณากรอกชื่อก่อนครับ'; return; }
    try{ localStorage.setItem('logic_game_last_player', name);}catch(e){}
    hide(startScreen); show(menuScreen);
    lastPlayer.textContent = `ผู้เล่นล่าสุด: ${name}`;
  });

  playBtn.addEventListener('click', ()=>{
    state.player = (localStorage.getItem('logic_game_last_player') || playerIdInput.value.trim());
    state.difficulty = parseInt(diffSlider.value,10);
    state.qIndex=0; state.totalQ=10; state.score=0; state.correct=0; state.times=[];
    state.finished=false; state.hasSaved=false;
    updateHud();
    hide(menuScreen); hide(summaryScreen); show(gameScreen);
    newQuestion();
  });

  leaderboardBtn.addEventListener('click', ()=>{ hide(menuScreen); show(leaderboardScreen); renderLeaderboard(); });
  leaderboardBack.addEventListener('click', ()=>{ hide(leaderboardScreen); show(menuScreen); });
  backMenuBtn.addEventListener('click', ()=>{ hide(summaryScreen); show(menuScreen); });
  playAgainBtn.addEventListener('click', ()=>{
    hide(summaryScreen); show(gameScreen);
    state.qIndex=0; state.score=0; state.correct=0; state.times=[]; state.finished=false; state.hasSaved=false;
    updateHud();
    newQuestion();
  });

  checkBtn.addEventListener('click', checkAnswer);
  skipBtn.addEventListener('click', ()=>{
    if(state.finished) return;
    clearInterval(state.timer.id);
    feedback.innerHTML='<span class="muted">ข้ามข้อนี้ (ไม่เสียคะแนน)</span>';
    setTimeout(nextQuestion, 400);
  });

  const last = (localStorage.getItem('logic_game_last_player')||'');
  if(last){ playerIdInput.value=last; lastPlayer.textContent = `ผู้เล่นล่าสุด: ${last}`; }
})();