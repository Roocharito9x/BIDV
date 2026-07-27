const DATABASE_NAME = "bidv-training";
const DATABASE_VERSION = 1;
const EXAMS_STORE = "exams";
const PROGRESS_STORE = "progress";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(EXAMS_STORE)) {
        database.createObjectStore(EXAMS_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(PROGRESS_STORE)) {
        database.createObjectStore(PROGRESS_STORE, { keyPath: "examId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runTransaction(storeName, mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

export function getUserExams() {
  return runTransaction(EXAMS_STORE, "readonly", (store) => store.getAll());
}

export function saveUserExam(exam) {
  return runTransaction(EXAMS_STORE, "readwrite", (store) => store.put(exam));
}

export function deleteUserExam(examId) {
  return runTransaction(EXAMS_STORE, "readwrite", (store) => store.delete(examId));
}

export async function getProgress(examId) {
  const progress = await runTransaction(PROGRESS_STORE, "readonly", (store) =>
    store.get(examId),
  );
  return (
    progress ?? {
      examId,
      sessions: 0,
      bestScore: 0,
      wrongQuestionIds: [],
      rememberedFlashcards: [],
      updatedAt: null,
    }
  );
}

export function saveProgress(progress) {
  return runTransaction(PROGRESS_STORE, "readwrite", (store) =>
    store.put({ ...progress, updatedAt: new Date().toISOString() }),
  );
}

export function deleteProgress(examId) {
  return runTransaction(PROGRESS_STORE, "readwrite", (store) =>
    store.delete(examId),
  );
}
