// Logic Game v4 — เพิ่มกติกา: ต้องมีทั้ง T และ F อย่างน้อย 1 ตัวในโจทย์ และคำตอบ
(function(){
  const $ = (sel) => document.querySelector(sel);
  const OPS = ['∧','∨','→','↔'];
  const startScreen=$('#start-screen'),menuScreen=$('#menu-screen'),gameScreen=$('#game-screen'),summaryScreen=$('#summary-screen'),leaderboardScreen=$('#leaderboard-screen');
  const playerIdInput=$('#player-id'),startBtn=$('#start-btn'),playBtn=$('#play-btn'),leaderboardBtn=$('#leaderboard-btn'),leaderboardBack=$('#leaderboard-back');
  const hudPlayer=$('#hud-player'),hudDiff=$('#hud-diff'),hudQ=$('#hud-q'),hudScore=$('#hud-score');
  const timerBar=$('#timer-bar'),timerText=$('#timer-text');
  const targetVal=$('#target-val'),expression=$('#expression');
  const checkBtn=$('#check-btn'),skipBtn=$('#skip-btn'),feedback=$('#feedback');
  const backMenuBtn=$('#back-menu-btn'),playAgainBtn=$('#play-again-btn');
  const diffSlider=$('#difficulty'),lastPlayer=$('#last-player');
  const summaryDiv=$('#summary'),leaderboardDiv=$('#leaderboard');

  let state={player:'',difficulty:3,qIndex:0,totalQ:10,score:0,correct:0,times:[],current:{tree:null,leaves:[],target:true},timer:{max:30,left:30,id:null},finished:false,hasSaved:false};

  function randomTree(nLeaves){
    let idx=0;
    function build(n){
      if(n===1) return {type:'leaf',index:idx++};
      const split=1+Math.floor(Math.random()*(n-1));
      const left=build(split), right=build(n-split);
      const op=OPS[Math.floor(Math.random()*OPS.length)];
      return {type:'op',op,left,right};
    }
    return build(nLeaves);
  }

  function renderTreeToDOM(node){
    if(node.type==='leaf'){
      const tok=document.createElement('div'); tok.className='token';
      const sel=document.createElement('select'); sel.className='tf';
      sel.innerHTML='<option value="T">T</option><option value="F">F</option>';
      sel.value=(Math.random()<0.5)?'T':'F';
      tok.appendChild(sel); expression.appendChild(tok);
      state.current.leaves.push(sel); return;
    }
    const l=document.createElement('div'); l.textContent='('; l.className='paren'; expression.appendChild(l);
    renderTreeToDOM(node.left);
    const op=document.createElement('div'); op.className='operator'; op.textContent=node.op; expression.appendChild(op);
    renderTreeToDOM(node.right);
    const r=document.createElement('div'); r.textContent=')'; r.className='paren'; expression.appendChild(r);
  }

  function evalTree(node,vals){ if(node.type==='leaf') return vals[node.index];
    const lv=evalTree(node.left,vals),rv=evalTree(node.right,vals);
    switch(node.op){case'∧':return lv&&rv;case'∨':return lv||rv;case'→':return(!lv)||rv;case'↔':return lv===rv;default:return false;}
  }

  function newQuestion(){
    expression.innerHTML=''; state.current.leaves=[];
    const nLeaves=state.difficulty+1;
    state.current.tree=randomTree(nLeaves);
    state.current.target=Math.random()<0.5;
    hudQ.textContent=`${state.qIndex+1}/${state.totalQ}`;
    targetVal.textContent=state.current.target?'T':'F';
    renderTreeToDOM(state.current.tree);
    // ตรวจว่ามีทั้ง T และ F อย่างน้อย 1
    let values=state.current.leaves.map(sel=>sel.value);
    if(!(values.includes('T')&&values.includes('F'))){
      // บังคับให้เปลี่ยนหนึ่งตัว
      state.current.leaves[0].value=(values[0]==='T')?'F':'T';
    }
    feedback.textContent='';
  }

  function checkAnswer(){
    let values=state.current.leaves.map(sel=>sel.value);
    if(!(values.includes('T')&&values.includes('F'))){
      feedback.innerHTML='<span class="incorrect">ต้องมีทั้ง T และ F อย่างน้อยอย่างละ 1 ตัว</span>'; return;
    }
    const bools=values.map(v=>v==='T');
    const result=evalTree(state.current.tree,bools);
    if(result===state.current.target){state.score+=100*state.difficulty; state.correct++; feedback.innerHTML='<span class="correct">ถูกต้อง!</span>';}else{state.score-=200; feedback.innerHTML='<span class="incorrect">ผิด</span>';}
    hudScore.textContent=state.score;
    setTimeout(()=>{state.qIndex++; if(state.qIndex>=state.totalQ){summary();}else{newQuestion();}},500);
  }

  function summary(){gameScreen.classList.add('hidden');summaryScreen.classList.remove('hidden');summaryDiv.innerHTML=`<p>คะแนน: ${state.score}</p><p>ตอบถูก: ${state.correct}/${state.totalQ}</p>`;}

  startBtn.addEventListener('click',()=>{menuScreen.classList.remove('hidden');startScreen.classList.add('hidden');});
  playBtn.addEventListener('click',()=>{state.qIndex=0;state.score=0;state.correct=0;gameScreen.classList.remove('hidden');menuScreen.classList.add('hidden');newQuestion();});
  checkBtn.addEventListener('click',checkAnswer);
  skipBtn.addEventListener('click',()=>{state.qIndex++;if(state.qIndex>=state.totalQ){summary();}else{newQuestion();}});
  backMenuBtn.addEventListener('click',()=>{summaryScreen.classList.add('hidden');menuScreen.classList.remove('hidden');});
  playAgainBtn.addEventListener('click',()=>{summaryScreen.classList.add('hidden');gameScreen.classList.remove('hidden');state.qIndex=0;state.score=0;state.correct=0;newQuestion();});
})();