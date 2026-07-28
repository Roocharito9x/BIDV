import {
  deleteProgress,
  deleteUserExam,
  getProgress,
  getUserExams,
  saveProgress,
  saveUserExam,
} from "./storage.js";
import { parseExamWorkbook } from "./excel-importer.js";

const PASSWORD_HASH = "bcfa55507a4eaf90c1c3c3c058292d74215363e33bda56d655f3f14bd455433b";
const SYSTEM_EXAM_URLS = [
  "./data/bidv-digital-transformation-2026.json",
  "./data/hcqt.json",
];
const SESSION_KEY = "bidv-training-authenticated";

const state = {
  exams: [],
  currentExam: null,
  currentProgress: null,
  importedExam: null,
  practice: null,
  timerId: null,
  flashcards: [],
  flashcardIndex: 0,
  flashcardFlipped: false,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function toast(message, type = "") {
  const element = document.createElement("div");
  element.className = `toast ${type}`.trim();
  element.textContent = message;
  $("#toastRegion").append(element);
  setTimeout(() => element.remove(), 3800);
}

function showView(viewId) {
  $$(".view").forEach((view) => {
    view.hidden = view.id !== viewId;
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function hashText(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function loadExams() {
  const systemExams = await Promise.all(
    SYSTEM_EXAM_URLS.map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Không tải được bộ đề hệ thống: ${url}`);
      return response.json();
    }),
  );
  const userExams = await getUserExams();
  state.exams = [
    ...systemExams,
    ...userExams.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  ];
  $("#homeExamCount").textContent = state.exams.length;
}

function renderExamLibrary() {
  const grid = $("#examGrid");
  if (!state.exams.length) {
    grid.innerHTML = '<div class="empty-state">Chưa có bộ đề nào trên thiết bị.</div>';
    return;
  }

  grid.innerHTML = state.exams
    .map(
      (exam) => `
        <article class="exam-card ${exam.source === "system" ? "system" : "user"}">
          <span class="exam-badge">${exam.source === "system" ? "BỘ ĐỀ BIDV" : "ĐỀ TỰ TẠO"}</span>
          <h2>${escapeHtml(exam.name)}</h2>
          <p>${escapeHtml(exam.description || "Bộ đề luyện tập trên thiết bị.")}</p>
          <div class="exam-card-footer">
            <span class="exam-stats">${exam.questions.length} câu hỏi</span>
            <button class="button primary compact" data-open-exam="${escapeHtml(exam.id)}" type="button">
              Bắt đầu →
            </button>
          </div>
        </article>
      `,
    )
    .join("");
}

async function openExam(examId) {
  const exam = state.exams.find((item) => item.id === examId);
  if (!exam) return;
  state.currentExam = exam;
  state.currentProgress = await getProgress(exam.id);
  $("#examTitle").textContent = exam.name;
  $("#examMeta").textContent = `${exam.questions.length} câu hỏi • ${exam.source === "system" ? "Bộ đề BIDV" : "Đề đã lưu trên thiết bị"}`;
  $("#deleteExamButton").hidden = exam.source === "system";
  renderQuestionList();
  configurePractice();
  renderFlashcardSets();
  selectExamTab("questions");
  showView("examView");
}

function renderQuestionList(filter = "") {
  const normalized = filter.trim().toLocaleLowerCase("vi");
  const questions = state.currentExam.questions.filter((question) => {
    if (!normalized) return true;
    return [
      question.question,
      question.category,
      ...Object.values(question.options),
    ].some((value) => String(value).toLocaleLowerCase("vi").includes(normalized));
  });

  $("#questionCount").textContent = `${questions.length} câu hỏi`;
  $("#questionList").innerHTML = questions
    .map(
      (question, index) => `
        <article class="question-card">
          <div class="question-top">
            <span class="question-number">${escapeHtml(question.id || index + 1)}</span>
            <div>
              <span class="question-category">${escapeHtml(question.category || "Chưa phân loại")}</span>
              <h3>${escapeHtml(question.question)}</h3>
            </div>
          </div>
          <div class="answer-grid">
            ${Object.entries(question.options).map(
              ([key, value]) => `
                <div class="answer-item ${question.correctAnswer === key ? "correct" : ""}">
                  <span class="answer-key">${key}.</span>
                  <span>${escapeHtml(value)}</span>
                </div>
              `,
            ).join("")}
          </div>
        </article>
      `,
    )
    .join("");
}

function selectExamTab(tabName) {
  $$(".exam-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.examTab === tabName);
  });
  const panelMap = {
    questions: "questionsPanel",
    practice: "practicePanel",
    flashcards: "flashcardsPanel",
  };
  Object.entries(panelMap).forEach(([name, panelId]) => {
    $(`#${panelId}`).hidden = name !== tabName;
  });
}

function configurePractice() {
  const total = state.currentExam.questions.length;
  const choices = [10, 20, 50, 100, total]
    .filter((value, index, array) => value <= total && array.indexOf(value) === index);
  $("#practiceCount").innerHTML = choices
    .map((value) => `<option value="${value}">${value === total ? `Toàn bộ (${total})` : `${value} câu`}</option>`)
    .join("");
  $("#startWrongPractice").hidden = !state.currentProgress.wrongQuestionIds.length;
  showPracticeScreen("setup");
}

function showPracticeScreen(screen) {
  $("#practiceSetup").hidden = screen !== "setup";
  $("#practiceQuestion").hidden = screen !== "question";
  $("#practiceResult").hidden = screen !== "result";
  clearInterval(state.timerId);
}

function startPractice(useWrongQuestions = false) {
  let source = state.currentExam.questions;
  if (useWrongQuestions) {
    source = source.filter((question) =>
      state.currentProgress.wrongQuestionIds.includes(String(question.id)),
    );
  }

  const selectedCount = Math.min(Number($("#practiceCount").value), source.length);
  const questions =
    $("#practiceOrder").value === "random"
      ? shuffle(source).slice(0, selectedCount)
      : source.slice(0, selectedCount);

  state.practice = {
    questions,
    index: 0,
    results: [],
    timerSeconds: Number($("#practiceTimer").value),
    revealAnswer: $("#practiceReveal").value === "yes",
    remaining: 0,
    answered: false,
  };
  showPracticeScreen("question");
  renderPracticeQuestion();
}

function renderPracticeQuestion() {
  const practice = state.practice;
  const question = practice.questions[practice.index];
  practice.answered = false;
  $("#quizPosition").textContent = `Câu ${practice.index + 1} / ${practice.questions.length}`;
  $("#quizProgress").style.width = `${((practice.index + 1) / practice.questions.length) * 100}%`;
  $("#quizCategory").textContent = question.category || "CÂU HỎI";
  $("#quizQuestionText").textContent = question.question;
  $("#quizFeedback").hidden = true;
  $("#nextQuestionButton").hidden = true;
  $("#quizOptions").innerHTML = Object.entries(question.options).map(
    ([key, value]) => `
      <button class="quiz-option" data-answer="${key}" type="button">
        <span class="option-key">${key}</span>
        <span>${escapeHtml(value)}</span>
      </button>
    `,
  ).join("");
  startQuestionTimer();
}

function startQuestionTimer() {
  clearInterval(state.timerId);
  const seconds = state.practice.timerSeconds;
  $("#quizTimer").hidden = seconds === 0;
  if (!seconds) return;
  state.practice.remaining = seconds;
  $("#quizTimer").textContent = `${seconds}s`;
  state.timerId = setInterval(() => {
    state.practice.remaining -= 1;
    $("#quizTimer").textContent = `${state.practice.remaining}s`;
    if (state.practice.remaining <= 0) {
      clearInterval(state.timerId);
      answerQuestion(null);
    }
  }, 1000);
}

function answerQuestion(selectedAnswer) {
  if (state.practice.answered) return;
  state.practice.answered = true;
  clearInterval(state.timerId);
  const question = state.practice.questions[state.practice.index];
  const isCorrect = selectedAnswer === question.correctAnswer;
  state.practice.results.push({
    questionId: String(question.id),
    selectedAnswer,
    correctAnswer: question.correctAnswer,
    isCorrect,
  });

  $$(".quiz-option").forEach((button) => {
    button.disabled = true;
    if (state.practice.revealAnswer || !selectedAnswer) {
      if (button.dataset.answer === question.correctAnswer) button.classList.add("correct");
      else if (button.dataset.answer === selectedAnswer) button.classList.add("wrong");
    } else if (button.dataset.answer === selectedAnswer) {
      button.classList.add(isCorrect ? "correct" : "wrong");
    }
  });

  const feedback = $("#quizFeedback");
  feedback.className = `quiz-feedback ${isCorrect ? "correct" : "wrong"}`;
  feedback.textContent = isCorrect
    ? "Chính xác! Bạn đã chọn đúng đáp án."
    : selectedAnswer
      ? `Chưa chính xác. Đáp án đúng là ${question.correctAnswer}.`
      : `Hết thời gian. Đáp án đúng là ${question.correctAnswer}.`;
  feedback.hidden = false;
  $("#nextQuestionButton").textContent =
    state.practice.index === state.practice.questions.length - 1
      ? "Xem kết quả →"
      : "Câu tiếp theo →";
  $("#nextQuestionButton").hidden = false;
}

function nextPracticeQuestion() {
  if (state.practice.index < state.practice.questions.length - 1) {
    state.practice.index += 1;
    renderPracticeQuestion();
  } else {
    finishPractice();
  }
}

function cancelPractice() {
  if (!state.practice) {
    showPracticeScreen("setup");
    return;
  }
  const confirmed = confirm(
    "Bạn muốn thoát bài test? Kết quả của phiên đang làm sẽ không được lưu.",
  );
  if (!confirmed) return;
  clearInterval(state.timerId);
  state.practice = null;
  showPracticeScreen("setup");
}

async function finishPractice() {
  const results = state.practice.results;
  const correct = results.filter((result) => result.isCorrect).length;
  const skipped = results.filter((result) => !result.selectedAnswer).length;
  const percentage = Math.round((correct / results.length) * 100);
  const wrongIds = results
    .filter((result) => !result.isCorrect)
    .map((result) => result.questionId);
  const priorWrong = state.currentProgress.wrongQuestionIds.filter(
    (id) => !results.some((result) => result.questionId === id && result.isCorrect),
  );
  state.currentProgress = {
    ...state.currentProgress,
    sessions: state.currentProgress.sessions + 1,
    bestScore: Math.max(state.currentProgress.bestScore, percentage),
    wrongQuestionIds: [...new Set([...priorWrong, ...wrongIds])],
  };
  await saveProgress(state.currentProgress);

  $("#resultIcon").textContent = percentage >= 80 ? "🏆" : percentage >= 50 ? "💪" : "📚";
  $("#resultTitle").textContent =
    percentage >= 80 ? "Kết quả rất tốt!" : percentage >= 50 ? "Bạn đang tiến bộ!" : "Hãy ôn thêm nhé!";
  $("#resultScore").textContent = `${percentage}%`;
  $("#resultStats").innerHTML = `
    <div class="result-stat"><strong>${correct}</strong><span>Đúng</span></div>
    <div class="result-stat"><strong>${results.length - correct - skipped}</strong><span>Sai</span></div>
    <div class="result-stat"><strong>${skipped}</strong><span>Bỏ qua</span></div>
  `;
  $("#startWrongPractice").hidden = !state.currentProgress.wrongQuestionIds.length;
  showPracticeScreen("result");
}

function getFlashcardSets(exam) {
  if (exam.flashcardSets?.length) return exam.flashcardSets;
  const cards = exam.questions.map((question) => ({
    section: question.category,
    front: question.question,
    back: `${question.correctAnswer}. ${question.options[question.correctAnswer]}${question.explanation ? `\n\n${question.explanation}` : ""}`,
  }));
  const sets = [];
  for (let index = 0; index < cards.length; index += 20) {
    sets.push({
      name: `Nhóm ${sets.length + 1}`,
      cards: cards.slice(index, index + 20),
    });
  }
  return sets;
}

function renderFlashcardSets() {
  const sets = getFlashcardSets(state.currentExam);
  $("#flashcardHome").hidden = false;
  $("#flashcardStudy").hidden = true;
  $("#flashcardSetGrid").innerHTML = sets
    .map(
      (set, index) => `
        <button class="flashcard-set" data-flashcard-set="${index}" type="button">
          <span class="exam-badge">BỘ ${index + 1}</span>
          <strong>${escapeHtml(set.name)}</strong>
          <span>${set.cards.length} thẻ ghi nhớ</span>
        </button>
      `,
    )
    .join("");
}

function openFlashcardSet(index) {
  state.flashcards = getFlashcardSets(state.currentExam)[index].cards;
  state.flashcardIndex = 0;
  state.flashcardFlipped = false;
  $("#flashcardHome").hidden = true;
  $("#flashcardStudy").hidden = false;
  renderFlashcard();
}

function renderFlashcard() {
  const card = state.flashcards[state.flashcardIndex];
  $("#flashcardPosition").textContent =
    `Thẻ ${state.flashcardIndex + 1} / ${state.flashcards.length}`;
  $("#flashcard").classList.toggle("flipped", state.flashcardFlipped);
  $("#flashcardSideLabel").textContent = state.flashcardFlipped
    ? "ĐÁP ÁN"
    : card.section || "CÂU HỎI";
  $("#flashcardText").textContent = state.flashcardFlipped ? card.back : card.front;
  $("#flashcardPrev").disabled = state.flashcardIndex === 0;
  $("#flashcardNext").disabled = state.flashcardIndex === state.flashcards.length - 1;
}

function moveFlashcard(direction) {
  const nextIndex = state.flashcardIndex + direction;
  if (nextIndex < 0 || nextIndex >= state.flashcards.length) return;
  state.flashcardIndex = nextIndex;
  state.flashcardFlipped = false;
  renderFlashcard();
}

async function markFlashcard(remembered) {
  const card = state.flashcards[state.flashcardIndex];
  const key = `${card.front}::${card.back}`;
  const memory = new Set(state.currentProgress.rememberedFlashcards);
  if (remembered) memory.add(key);
  else memory.delete(key);
  state.currentProgress.rememberedFlashcards = [...memory];
  await saveProgress(state.currentProgress);
  toast(remembered ? "Đã ghi nhận thẻ đã nhớ." : "Đã đưa thẻ vào danh sách cần ôn.");
  moveFlashcard(1);
}

async function processExcelFile(file) {
  const result = $("#uploadResult");
  const preview = $("#previewPanel");
  result.hidden = false;
  result.className = "upload-result";
  result.textContent = "Đang đọc và kiểm tra dữ liệu…";
  preview.hidden = true;
  state.importedExam = null;

  try {
    const exam = await parseExamWorkbook(file, $("#examNameInput").value);
    state.importedExam = exam;
    result.className = "upload-result success";
    result.textContent = `File hợp lệ: ${exam.questions.length} câu hỏi đã sẵn sàng.`;
    $("#previewSummary").textContent = `${exam.questions.length} câu hỏi • ${file.name}`;
    $("#previewRows").innerHTML = exam.questions
      .slice(0, 8)
      .map(
        (question) => `
          <tr>
            <td>${escapeHtml(question.id)}</td>
            <td>${escapeHtml(question.question)}</td>
            <td>${escapeHtml(question.correctAnswer)}</td>
          </tr>
        `,
      )
      .join("");
    preview.hidden = false;
  } catch (error) {
    result.className = "upload-result error";
    result.textContent = error.message;
  }
}

async function saveImportedExam() {
  if (!state.importedExam) return;
  const duplicateName = state.exams.some(
    (exam) => exam.name.toLocaleLowerCase("vi") === state.importedExam.name.toLocaleLowerCase("vi"),
  );
  if (duplicateName) {
    toast("Đã có bộ đề trùng tên. Vui lòng đổi tên trước khi tải file.", "error");
    return;
  }
  await saveUserExam(state.importedExam);
  state.exams.push(state.importedExam);
  $("#homeExamCount").textContent = state.exams.length;
  renderExamLibrary();
  toast(`Đã lưu “${state.importedExam.name}”.`, "success");
  state.importedExam = null;
  $("#examNameInput").value = "";
  $("#excelInput").value = "";
  $("#uploadResult").hidden = true;
  $("#previewPanel").hidden = true;
  showView("libraryView");
}

async function removeCurrentExam() {
  if (!state.currentExam || state.currentExam.source === "system") return;
  const confirmed = confirm(
    `Xóa bộ đề “${state.currentExam.name}” và toàn bộ tiến độ trên thiết bị?`,
  );
  if (!confirmed) return;
  await Promise.all([
    deleteUserExam(state.currentExam.id),
    deleteProgress(state.currentExam.id),
  ]);
  state.exams = state.exams.filter((exam) => exam.id !== state.currentExam.id);
  state.currentExam = null;
  renderExamLibrary();
  $("#homeExamCount").textContent = state.exams.length;
  toast("Đã xóa bộ đề khỏi thiết bị.", "success");
  showView("libraryView");
}

function bindEvents() {
  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const valid = (await hashText($("#passwordInput").value)) === PASSWORD_HASH;
    $("#loginError").hidden = valid;
    if (!valid) {
      $("#passwordInput").focus();
      return;
    }
    sessionStorage.setItem(SESSION_KEY, "true");
    $("#loginScreen").hidden = true;
    $("#appShell").hidden = false;
    $("#passwordInput").value = "";
    showView("homeView");
  });

  $("#togglePassword").addEventListener("click", () => {
    const input = $("#passwordInput");
    input.type = input.type === "password" ? "text" : "password";
    $("#togglePassword").setAttribute(
      "aria-label",
      input.type === "password" ? "Hiện mật khẩu" : "Ẩn mật khẩu",
    );
  });

  document.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (actionButton) {
      const action = actionButton.dataset.action;
      if (action === "go-home") showView("homeView");
      if (action === "open-library") {
        renderExamLibrary();
        showView("libraryView");
      }
      if (action === "open-upload") showView("uploadView");
      if (action === "logout") {
        sessionStorage.removeItem(SESSION_KEY);
        $("#appShell").hidden = true;
        $("#loginScreen").hidden = false;
        $("#passwordInput").focus();
      }
    }

    const examButton = event.target.closest("[data-open-exam]");
    if (examButton) openExam(examButton.dataset.openExam);

    const tabButton = event.target.closest("[data-exam-tab]");
    if (tabButton) selectExamTab(tabButton.dataset.examTab);

    const answerButton = event.target.closest("[data-answer]");
    if (answerButton) answerQuestion(answerButton.dataset.answer);

    const setButton = event.target.closest("[data-flashcard-set]");
    if (setButton) openFlashcardSet(Number(setButton.dataset.flashcardSet));
  });

  $("#questionSearch").addEventListener("input", (event) =>
    renderQuestionList(event.target.value),
  );
  $("#startPractice").addEventListener("click", () => startPractice(false));
  $("#startWrongPractice").addEventListener("click", () => startPractice(true));
  $("#nextQuestionButton").addEventListener("click", nextPracticeQuestion);
  $("#cancelPractice").addEventListener("click", cancelPractice);
  $("#retryPractice").addEventListener("click", () => startPractice(false));
  $("#backToSetup").addEventListener("click", () => showPracticeScreen("setup"));
  $("#deleteExamButton").addEventListener("click", removeCurrentExam);

  const dropZone = $("#dropZone");
  const excelInput = $("#excelInput");
  dropZone.addEventListener("click", () => excelInput.click());
  dropZone.addEventListener("keydown", (event) => {
    if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      excelInput.click();
    }
  });
  ["dragenter", "dragover"].forEach((eventName) =>
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("dragging");
    }),
  );
  ["dragleave", "drop"].forEach((eventName) =>
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("dragging");
    }),
  );
  dropZone.addEventListener("drop", (event) => {
    const [file] = event.dataTransfer.files;
    if (file) processExcelFile(file);
  });
  excelInput.addEventListener("change", () => {
    if (excelInput.files[0]) processExcelFile(excelInput.files[0]);
  });
  $("#saveImportedExam").addEventListener("click", saveImportedExam);

  $("#flashcard").addEventListener("click", () => {
    state.flashcardFlipped = !state.flashcardFlipped;
    renderFlashcard();
  });
  $("#flashcardPrev").addEventListener("click", () => moveFlashcard(-1));
  $("#flashcardNext").addEventListener("click", () => moveFlashcard(1));
  $("#flashcardRemembered").addEventListener("click", () => markFlashcard(true));
  $("#flashcardForgot").addEventListener("click", () => markFlashcard(false));
  $("#closeFlashcard").addEventListener("click", renderFlashcardSets);
}

async function initialize() {
  bindEvents();
  try {
    await loadExams();
    renderExamLibrary();
  } catch (error) {
    toast(error.message, "error");
  }

  if (sessionStorage.getItem(SESSION_KEY) === "true") {
    $("#loginScreen").hidden = true;
    $("#appShell").hidden = false;
    showView("homeView");
  } else {
    $("#passwordInput").focus();
  }
}

initialize();
