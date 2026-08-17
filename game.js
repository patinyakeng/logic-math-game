// Logic Math Game — practice and private assessment build
(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const OPS = ["∧", "∨", "→", "↔"];
  const API_URL = "https://script.google.com/macros/s/AKfycbwR8of3Llm4JRescPwNp9x2Xv4KfPCAQvng7iqJngFm_DYXE-w_QKlMxcW5su6bE0PeUg/exec";
  const DEPTH_RANGES = {
    1: [1, 1], 2: [2, 2], 3: [2, 3], 4: [3, 3], 5: [3, 4],
    6: [4, 4], 7: [4, 5], 8: [5, 5], 9: [5, 6], 10: [6, 6],
  };

  const screens = {
    start: $("#start-screen"), menu: $("#menu-screen"),
    game: $("#game-screen"), summary: $("#summary-screen"),
  };
  const fields = {
    prefix: $("#prefix"), firstName: $("#first-name"), lastName: $("#last-name"),
    classroom: $("#classroom"), studentNumber: $("#student-number"),
  };
  const difficulty = $("#difficulty");
  const expression = $("#expression");
  const feedback = $("#feedback");
  const checkBtn = $("#check-btn");
  const timerBar = $("#timer-bar");
  const timerText = $("#timer-text");

  const state = {
    player: null,
    mode: "practice",
    studentType: null,
    difficulty: 3,
    qIndex: 0,
    totalQ: 10,
    score: 0,
    correct: 0,
    times: [],
    rootOperators: [],
    current: { tree: null, selects: [], target: false },
    timer: { max: 30, left: 30, id: null },
    finished: false,
    hasSaved: false,
  };

  for (let room = 1; room <= 19; room += 1) {
    const option = document.createElement("option");
    option.value = `4/${room}`;
    option.textContent = `4/${room}`;
    fields.classroom.appendChild(option);
  }

  function showOnly(name) {
    Object.entries(screens).forEach(([key, el]) => el.classList.toggle("hidden", key !== name));
  }

  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function makeRootSchedule() {
    const extras = shuffle(OPS).slice(0, 2);
    return shuffle([...OPS, ...OPS, ...extras]);
  }

  function readPlayer() {
    const player = {
      prefix: fields.prefix.value,
      firstName: fields.firstName.value.trim(),
      lastName: fields.lastName.value.trim(),
      classroom: fields.classroom.value,
      studentNumber: fields.studentNumber.value.trim(),
    };
    const validNumber = /^\d{1,2}$/.test(player.studentNumber) && Number(player.studentNumber) > 0;
    if (!player.prefix || !player.firstName || !player.lastName || !player.classroom || !validNumber) {
      $("#form-error").textContent = "กรุณากรอกข้อมูลให้ครบทุกช่อง และตรวจสอบเลขที่ให้ถูกต้อง";
      return null;
    }
    $("#form-error").textContent = "";
    return player;
  }

  function playerDisplayName() {
    const p = state.player;
    return `${p.prefix}${p.firstName} ${p.lastName} ${p.classroom} เลขที่ ${p.studentNumber}`;
  }

  function enterMode(mode, studentType = null) {
    const player = readPlayer();
    if (!player) return;
    state.player = player;
    state.mode = mode;
    state.studentType = studentType;
    $("#test-modal").classList.add("hidden");
    $("#mode-label").textContent = mode === "practice"
      ? "แบบฝึกหัด"
      : `แบบทดสอบสำหรับ${studentType === "general" ? "นักเรียนทั่วไป" : "นักเรียนห้องเรียนพิเศษ"}`;
    updateLevelDetails();
    showOnly("menu");
  }

  function secondsForDifficulty(level) {
    return Math.round(10 + (level - 1) * (50 / 9));
  }

  function colorFromT(t) {
    return `hsl(${210 * (1 - t)}, 90%, 50%)`;
  }

  function updateDifficultyTheme() {
    const value = Number(difficulty.value);
    const t = (value - 1) / 9;
    const color = colorFromT(t);
    const pct = t * 100;
    difficulty.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #e6e9f2 ${pct}%, #e6e9f2 100%)`;
    difficulty.style.setProperty("--thumb-color", color);
    $("#diff-val").textContent = value;
    $("#diff-val").style.background = color;
    updateLevelDetails();
  }

  function updateLevelDetails() {
    const level = Number(difficulty.value);
    const [minDepth, maxDepth] = DEPTH_RANGES[level];
    const depthText = minDepth === maxDepth ? `${minDepth}` : `${minDepth}–${maxDepth}`;
    if (state.mode === "practice") {
      $("#level-details").innerHTML = `โจทย์แต่ละข้อมี <strong>${level} ตัวเชื่อม</strong> และ <strong>${level + 1} ช่อง T/F</strong> ความลึก ${depthText} ชั้น`;
    } else {
      const bonus = state.studentType === "general" ? 3 : 1;
      $("#level-details").innerHTML = `โจทย์แต่ละข้อมี <strong>${level} ตัวเชื่อม</strong> และ <strong>${level + 1} ช่อง T/F</strong><br>คะแนนเต็ม <strong>${level + bonus}</strong> คะแนน ผิดหรือหมดเวลาหักข้อละ 1 คะแนน`;
    }
  }

  function randomTree(nLeaves) {
    let index = 0;
    function build(n) {
      if (n === 1) return { type: "leaf", index: index++ };
      const split = 1 + Math.floor(Math.random() * (n - 1));
      return {
        type: "op",
        op: OPS[Math.floor(Math.random() * OPS.length)],
        left: build(split),
        right: build(n - split),
      };
    }
    return build(nLeaves);
  }

  function treeDepth(node) {
    return node.type === "leaf" ? 0 : 1 + Math.max(treeDepth(node.left), treeDepth(node.right));
  }

  function mainBranchesBalanced(tree, level) {
    if (level !== 5) return true;
    return Math.abs(treeDepth(tree.left) - treeDepth(tree.right)) <= 1;
  }

  function opEval(a, op, b) {
    if (op === "∧") return a && b;
    if (op === "∨") return a || b;
    if (op === "→") return !a || b;
    if (op === "↔") return a === b;
    return false;
  }

  function evalTree(node, values) {
    if (node.type === "leaf") return values[node.index];
    return opEval(evalTree(node.left, values), node.op, evalTree(node.right, values));
  }

  function hasMixedSolution(tree, target, nLeaves) {
    const total = 2 ** nLeaves;
    for (let mask = 1; mask < total - 1; mask += 1) {
      const values = Array.from({ length: nLeaves }, (_, i) => Boolean(mask & (2 ** i)));
      if (evalTree(tree, values) === target) return true;
    }
    return false;
  }

  function generateQuestion(rootOperator) {
    const level = state.difficulty;
    const nLeaves = level + 1;
    const [minDepth, maxDepth] = DEPTH_RANGES[level];
    for (let attempt = 0; attempt < 10000; attempt += 1) {
      const tree = randomTree(nLeaves);
      tree.op = rootOperator;
      const depth = treeDepth(tree);
      if (depth < minDepth || depth > maxDepth || !mainBranchesBalanced(tree, level)) continue;
      const target = level === 1 ? Math.random() < 0.5 : false;
      if (level > 1) {
        if (!hasMixedSolution(tree, target, nLeaves)) continue;
      }
      return { tree, target };
    }
    throw new Error(`สร้างโจทย์ระดับ ${level} ไม่สำเร็จ`);
  }

  function renderTree(node, depth = 0) {
    if (node.type === "leaf") {
      const token = document.createElement("div");
      token.className = "token";
      const select = document.createElement("select");
      select.className = "tf placeholder";
      select.innerHTML = '<option value="" disabled selected>—</option><option value="T">T</option><option value="F">F</option>';
      select.addEventListener("change", () => {
        select.classList.remove("placeholder");
        select.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      });
      token.appendChild(select);
      expression.appendChild(token);
      state.current.selects.push(select);
      return;
    }
    const leftParen = document.createElement("div");
    leftParen.className = `paren paren-depth-${depth % 6}`;
    leftParen.textContent = "(";
    const operator = document.createElement("div");
    operator.className = "operator";
    operator.textContent = node.op;
    const rightParen = leftParen.cloneNode();
    rightParen.textContent = ")";
    expression.appendChild(leftParen);
    renderTree(node.left, depth + 1);
    expression.appendChild(operator);
    renderTree(node.right, depth + 1);
    expression.appendChild(rightParen);
  }

  function lockInputs(disabled) {
    state.current.selects.forEach((select) => { select.disabled = disabled; });
    checkBtn.disabled = disabled;
  }

  function setTimer(seconds) {
    clearInterval(state.timer.id);
    state.timer.max = seconds;
    state.timer.left = seconds;
    timerText.textContent = `${seconds} วิ`;
    timerBar.style.width = "100%";
    timerBar.style.background = colorFromT(0);
    state.timer.id = setInterval(() => {
      state.timer.left = Math.max(0, state.timer.left - 0.1);
      const fraction = state.timer.left / state.timer.max;
      timerText.textContent = state.timer.left > 0 ? `${Math.ceil(state.timer.left)} วิ` : "หมดเวลา";
      timerBar.style.width = `${fraction * 100}%`;
      timerBar.style.background = colorFromT(1 - fraction);
      if (state.timer.left <= 0) {
        clearInterval(state.timer.id);
        lockInputs(true);
        feedback.innerHTML = '<span class="incorrect">หมดเวลา</span>';
        setTimeout(nextQuestion, 800);
      }
    }, 100);
  }

  function newQuestion() {
    expression.innerHTML = "";
    state.current.selects = [];
    const question = generateQuestion(state.rootOperators[state.qIndex]);
    state.current.tree = question.tree;
    state.current.target = question.target;
    $("#hud-q").textContent = `${state.qIndex + 1}/${state.totalQ}`;
    $("#target-val").textContent = question.target ? "T" : "F";
    $("#target").classList.toggle("target-true", question.target);
    $("#target").classList.toggle("target-false", !question.target);
    feedback.textContent = "";
    renderTree(question.tree);
    lockInputs(false);
    setTimer(secondsForDifficulty(state.difficulty));
  }

  function nextQuestion() {
    if (state.finished) return;
    state.times.push(state.timer.max - state.timer.left);
    state.qIndex += 1;
    if (state.qIndex >= state.totalQ) endGame();
    else newQuestion();
  }

  function updatePracticeScore() {
    $("#hud-score").textContent = state.mode === "practice" ? state.score : state.correct;
  }

  function checkAnswer() {
    if (state.finished) return;
    const complete = state.current.selects.every((select) => select.value === "T" || select.value === "F");
    if (!complete) {
      feedback.innerHTML = '<span class="muted">กรุณาเลือก T/F ให้ครบทุกตำแหน่ง</span>';
      return;
    }
    clearInterval(state.timer.id);
    lockInputs(true);
    const values = state.current.selects.map((select) => select.value === "T");
    const correct = evalTree(state.current.tree, values) === state.current.target;
    if (correct) {
      state.correct += 1;
      if (state.mode === "practice") {
        const gained = Math.floor((100 + 10 * Math.max(0, state.timer.left)) * state.difficulty);
        state.score += gained;
        feedback.innerHTML = `<span class="correct">ถูกต้อง! +${gained} คะแนน</span>`;
      } else {
        feedback.innerHTML = '<span class="correct">ถูกต้อง</span>';
      }
    } else if (state.mode === "practice") {
      const penalty = 100 * state.difficulty;
      state.score -= penalty;
      feedback.innerHTML = `<span class="incorrect">ตอบผิด −${penalty} คะแนน</span>`;
    } else {
      feedback.innerHTML = '<span class="incorrect">ตอบผิด</span>';
    }
    updatePracticeScore();
    setTimeout(nextQuestion, 700);
  }

  function testScore() {
    const bonus = state.studentType === "general" ? 3 : 1;
    const wrong = state.totalQ - state.correct;
    return Math.max(0, state.difficulty + bonus - wrong);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
  }

  async function submitAssessment(payload) {
    if (!API_URL) return { ok: false, configurationMissing: true };
    try {
      const response = await fetch(API_URL, { method: "POST", body: new URLSearchParams(payload) });
      if (!response.ok) return { ok: false };
      return await response.json();
    } catch (error) {
      console.error("Assessment submission failed", error);
      return { ok: false };
    }
  }

  async function endGame() {
    if (state.finished) return;
    state.finished = true;
    clearInterval(state.timer.id);
    const average = state.times.length ? state.times.reduce((sum, time) => sum + time, 0) / state.times.length : 0;
    const wrong = state.totalQ - state.correct;
    const score = state.mode === "test" ? testScore() : state.score;
    $("#summary").innerHTML = `
      <p><strong>ผู้เล่น:</strong> ${escapeHtml(playerDisplayName())}</p>
      <p><strong>โหมด:</strong> ${state.mode === "practice" ? "แบบฝึกหัด" : escapeHtml(state.studentType === "general" ? "แบบทดสอบนักเรียนทั่วไป" : "แบบทดสอบนักเรียนห้องเรียนพิเศษ")}</p>
      <p><strong>ระดับ:</strong> ${state.difficulty}</p>
      <p><strong>ตอบถูก:</strong> ${state.correct}/${state.totalQ}</p>
      <p><strong>คะแนน:</strong> ${score}</p>
      <p><strong>เวลาเฉลี่ย/ข้อ:</strong> ${average.toFixed(1)} วินาที</p>`;
    $("#save-status").textContent = "";
    showOnly("summary");

    if (state.mode === "test" && !state.hasSaved) {
      state.hasSaved = true;
      $("#save-status").textContent = "กำลังบันทึกผลแบบทดสอบ...";
      const result = await submitAssessment({
        submissionId: crypto.randomUUID(),
        prefix: state.player.prefix,
        firstName: state.player.firstName,
        lastName: state.player.lastName,
        classroom: state.player.classroom,
        studentNumber: state.player.studentNumber,
        studentType: state.studentType,
        difficulty: state.difficulty,
        correct: state.correct,
        wrong,
        total: state.totalQ,
        score,
        averageTime: average.toFixed(2),
      });
      $("#save-status").textContent = result.ok
        ? "บันทึกผลแบบทดสอบเรียบร้อยแล้ว"
        : result.configurationMissing
          ? "ระบบบันทึกผลยังไม่เชื่อมต่อ Google Sheet"
          : "บันทึกผลไม่สำเร็จ กรุณาแจ้งครูผู้สอน";
    }
  }

  function startGame() {
    state.difficulty = Number(difficulty.value);
    state.qIndex = 0;
    state.score = 0;
    state.correct = 0;
    state.times = [];
    state.finished = false;
    state.hasSaved = false;
    state.rootOperators = makeRootSchedule();
    $("#hud-player").textContent = playerDisplayName();
    $("#hud-diff").textContent = state.difficulty;
    $("#hud-score-label").textContent = state.mode === "practice" ? "คะแนน" : "ตอบถูก";
    $("#hud-score").textContent = "0";
    showOnly("game");
    newQuestion();
  }

  $("#practice-btn").addEventListener("click", () => enterMode("practice"));
  $("#test-btn").addEventListener("click", () => {
    if (!readPlayer()) return;
    $("#test-modal").classList.remove("hidden");
  });
  $("#close-modal-btn").addEventListener("click", () => $("#test-modal").classList.add("hidden"));
  document.querySelectorAll(".choose-test").forEach((button) => {
    button.addEventListener("click", () => enterMode("test", button.dataset.studentType));
  });
  $("#change-mode-btn").addEventListener("click", () => showOnly("start"));
  difficulty.addEventListener("input", updateDifficultyTheme);
  $("#play-btn").addEventListener("click", startGame);
  checkBtn.addEventListener("click", checkAnswer);
  $("#back-menu-btn").addEventListener("click", () => showOnly("menu"));
  $("#play-again-btn").addEventListener("click", startGame);

  updateDifficultyTheme();
})();
