// 重量、次數即時連動控制組件
const SAVE_FEEDBACK_DURATION = 1800;

const FIELD_LIMITS = {
  weight: { maxIntegerDigits: 3, maxFractionDigits: 1, allowDecimal: true },
  reps: { maxIntegerDigits: 3, maxFractionDigits: 0, allowDecimal: false },
};

class SetRowState {
  constructor() {
    this.weight = "";
    this.reps = "";
    this.activeField = "weight";
  }

  setActiveField(field) {
    if (!FIELD_LIMITS[field]) return;
    this.activeField = field;
  }

  applyKey(key) {
    const field = this.activeField;
    const limits = FIELD_LIMITS[field];
    const current = this[field];

    if (key === "backspace") {
      this[field] = current.slice(0, -1);
      return this[field];
    }

    if (key === ".") {
      if (!limits.allowDecimal || current.includes(".")) return current;
      this[field] = current === "" ? "0." : `${current}.`;
      return this[field];
    }

    if (/^\d$/.test(key)) {
      if (current.includes(".")) {
        if (current.split(".")[1].length >= limits.maxFractionDigits) return current;
        this[field] = current + key;
      } else {
        if (current === "0") this[field] = key;
        else if (current.length < limits.maxIntegerDigits) this[field] = current + key;
      }
    }
    return this[field];
  }
}

class SetRowController {
  constructor(root = document) {
    this.root = root;
    this.state = new SetRowState();
    this.setIndexes = new Map();
    this.setRow = root.querySelector("[data-set-row]");
    this.keypad = root.querySelector("[data-numeric-keypad]");
    this.fields = {
      weight: root.querySelector('[data-set-field="weight"]'),
      reps: root.querySelector('[data-set-field="reps"]'),
    };

    if (!this.setRow || !this.keypad || !this.fields.weight || !this.fields.reps) return;

    this.submitButton = root.querySelector("[data-save-set]");
    this.feedback = root.querySelector("[data-save-feedback]");

    this.ensureSubmitControls();
    this.bind();
    this.render();
  }

  ensureSubmitControls() {
    if (!this.submitButton) {
      this.submitButton = document.createElement("button");
      this.submitButton.type = "button";
      this.submitButton.className = "keypad-btn keypad-btn--submit";
      this.submitButton.dataset.saveSet = "true";
      this.submitButton.textContent = "確認送出 ✓";
      this.submitButton.style.gridColumn = "1 / -1";
      this.submitButton.style.marginTop = "10px";
      this.keypad.append(this.submitButton);
    }

    if (!this.feedback) {
      this.feedback = document.createElement("p");
      this.feedback.className = "set-row__feedback";
      this.feedback.style.fontSize = "0.8rem";
      this.feedback.style.marginTop = "8px";
      this.setRow.append(this.feedback);
    }
  }

  bind() {
    this.keypad.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-key]");
      if (btn) { this.state.applyKey(btn.dataset.key); this.render(); }
    });

    this.submitButton.addEventListener("click", () => this.save());

    this.setRow.addEventListener("click", (e) => {
      const field = e.target.closest("[data-set-field]");
      if (field) { this.state.setActiveField(field.dataset.setField); this.render(); }
    });

    document.getElementById("exercise-select")?.addEventListener("change", () => this.render());
  }

  getExerciseId(machineName) {
    let hash = 2166136261;
    for (const character of machineName) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return `exercise_${(hash >>> 0).toString(16)}`;
  }

  getSetIndex(exerciseId) {
    return (this.setIndexes.get(exerciseId) || 0) + 1;
  }

  async save() {
    if (this.submitButton.disabled) return;

    // --- 關鍵修正：抓取下拉選單目前的動作名稱與肌群標籤 ---
    const exerciseSelect = document.getElementById("exercise-select");
    const machineName = exerciseSelect ? exerciseSelect.value : "未知動作";
    const selectedOption = exerciseSelect?.options[exerciseSelect.selectedIndex];
    // 從 dataset 抓取肌群標籤 (用於圖表分類)
    const muscleGroup = selectedOption?.dataset.muscle || selectedOption?.dataset.catalog || "其他";

    const weight = Number(this.state.weight);
    const reps = Number(this.state.reps);
    const exerciseId = this.getExerciseId(machineName);
    const setIndex = this.getSetIndex(exerciseId);
    const date = this.setRow.dataset.workoutDate || (() => {
      const today = new Date();
      today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
      return today.toISOString().slice(0, 10);
    })();

    if (!this.state.weight || !this.state.reps || isNaN(weight) || isNaN(reps)) {
      this.showFeedback("請輸入完整數據", "error");
      return;
    }

    this.submitButton.disabled = true;
    this.submitButton.textContent = "儲存中...";

    try {
      const { saveWorkoutSet } = await import("../services/workout-service.js");
      const userId = this.setRow.dataset.userId;
      if (!userId) throw new Error("尚未登入");

      await saveWorkoutSet({
        userId,
        workoutId: this.setRow.dataset.workoutId || `daily_${date}`,
        exerciseId,
        date,
        type: this.setRow.dataset.workoutType || "",
        machine: machineName,
        catalogKey: muscleGroup,
        weight,
        reps,
        setIndex,
        completed: true
      });

      this.setIndexes.set(exerciseId, setIndex);

      this.showFeedback("紀錄成功！", "success");

      // 成功後連動主程式計時器
      document.getElementById("btn-timer-reset")?.click();
      document.getElementById("btn-timer-start")?.click();

      this.state.weight = "";
      this.state.reps = "";
      this.render();

    } catch (error) {
      console.error(error);
      this.showFeedback("儲存失敗", "error");
    } finally {
      this.submitButton.disabled = false;
      this.submitButton.textContent = "確認送出 ✓";
    }
  }

  showFeedback(msg, type) {
    if (!this.feedback) return;
    this.feedback.textContent = msg;
    this.feedback.style.color = type === "success" ? "#00ffd1" : "#ff7748";
    setTimeout(() => { if (this.feedback) this.feedback.textContent = ""; }, SAVE_FEEDBACK_DURATION);
  }

  render() {
    Object.keys(this.fields).forEach(f => {
      if (this.fields[f]) {
        this.fields[f].value = this.state[f];
        this.fields[f].classList.toggle("is-active", this.state.activeField === f);
      }
    });
    const exerciseSelect = document.getElementById("exercise-select");
    const exerciseId = exerciseSelect ? this.getExerciseId(exerciseSelect.value) : "";
    const indexLabel = this.setRow?.querySelector(".set-row__index");
    if (indexLabel) indexLabel.textContent = `動作與紀錄 · 第 ${this.getSetIndex(exerciseId)} 組`;
  }
}

new SetRowController();
