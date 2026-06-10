/**
 * KoreksiSoal - API Layer
 * Menghubungkan aplikasi frontend ke Google Apps Script (backend)
 * 
 * CARA SETUP:
 * 1. Deploy Code.gs sebagai Web App di Google Apps Script
 * 2. Ganti nilai GAS_URL di bawah dengan URL deployment Anda
 */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzCJ8wysdOZZqNj_CAts_ojlzIDeu3mbSJQBgA6b5WdncVgRBYLh61pjO-0fvz01fLs/exec';

// ============================================================
// CORE API CLIENT
// ============================================================

const KS_API = {

  // ID guru yang sedang login (diisi setelah login berhasil)
  teacherId: null,

  // Session token untuk validasi multi-device (diisi setelah login berhasil)
  _sessionToken: null,

  /**
   * Kirim request ke Google Apps Script
   * @param {string} action - Nama action
   * @param {object} payload - Data tambahan
   * @param {boolean} isPost - true = POST, false = GET
   */
  // Timeout (ms) untuk setiap request — bisa diubah sesuai kebutuhan
  REQUEST_TIMEOUT_MS: 15000,

  async call(action, payload = {}, isPost = false) {
    try {
      let response;

      // AbortController untuk membatalkan fetch jika melebihi batas waktu
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.REQUEST_TIMEOUT_MS
      );

      // Sertakan session token di setiap request agar server bisa
      // memvalidasi sesi dari device manapun (multi-device support)
      const sessionToken = this._sessionToken || localStorage.getItem('ks_session_token');
      const basePayload = { action, ...payload };
      if (sessionToken) basePayload.sessionToken = sessionToken;

      try {
        if (isPost) {
          response = await fetch(GAS_URL, {
            method: 'POST',
            // redirect: 'follow' diperlukan karena GAS memakai redirect
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(basePayload),
            signal: controller.signal
          });
        } else {
          const params = new URLSearchParams(basePayload);
          response = await fetch(`${GAS_URL}?${params}`, {
            redirect: 'follow',
            signal: controller.signal
          });
        }
      } finally {
        // Bersihkan timeout agar tidak memory leak setelah fetch selesai
        clearTimeout(timeoutId);
      }

      const result = await response.json();

      // Jika server mengembalikan session token baru (token refresh),
      // simpan otomatis untuk mendukung rotasi token multi-device
      if (result.sessionToken) {
        this._sessionToken = result.sessionToken;
        localStorage.setItem('ks_session_token', result.sessionToken);
      }

      if (result.error) {
        console.error('[KS_API]', action, result.error);
        throw new Error(result.error);
      }

      return result;

    } catch (err) {
      // Jika URL belum dikonfigurasi, tampilkan pesan jelas
      if (GAS_URL.includes('GANTI_DENGAN')) {
        console.warn('[KS_API] URL API belum dikonfigurasi. Gunakan mode offline (localStorage).');
        throw new Error('API_NOT_CONFIGURED');
      }
      // Ubah error AbortError menjadi pesan yang lebih informatif
      if (err.name === 'AbortError') {
        throw new Error(`Request timeout: server tidak merespons dalam ${this.REQUEST_TIMEOUT_MS / 1000} detik.`);
      }
      throw err;
    }
  },

  // ---- AUTH ----

  async login(nip, password) {
    return this.call('login', { nip, password }, true);
  },

  async register(profileData) {
    return this.call('register', profileData, true);
  },

  // ---- CRUD HELPERS ----

  async getAll(sheet) {
    if (!this.teacherId) throw new Error('Belum login');
    return this.call('getAll', { sheet, teacherId: this.teacherId });
  },

  async save(sheet, data) {
    if (!this.teacherId) throw new Error('Belum login');
    return this.call('save', {
      sheet,
      data: { ...data, teacherId: this.teacherId }
    }, true);
  },

  async delete(sheet, id) {
    if (!this.teacherId) throw new Error('Belum login');
    return this.call('delete', { sheet, id, teacherId: this.teacherId }, true);
  },

  async saveMany(sheet, rows) {
    if (!this.teacherId) throw new Error('Belum login');
    const tagged = rows.map(r => ({ ...r, teacherId: this.teacherId }));
    return this.call('saveMany', { sheet, rows: tagged }, true);
  },

  // ---- SHEET NAMES ----
  SHEETS: {
    TEACHERS:    'teachers',
    STUDENTS:    'students',
    EXAMS:       'exams',
    SUBMISSIONS: 'submissions',
    ACTIVITIES:  'activities'
  }
};


// ============================================================
// DATABASE MANAGER
// Abstraksi yang dipakai oleh app.js — otomatis pilih
// mode ONLINE (GAS) atau OFFLINE (localStorage) sebagai fallback
// ============================================================

const DB = {

  // Mode: 'online' | 'offline' | 'checking'
  mode: 'checking',

  /**
   * Inisialisasi: cek apakah API bisa dijangkau, lalu set mode
   */
  async init() {
    // Jika URL belum dikonfigurasi, langsung pakai offline
    if (GAS_URL.includes('GANTI_DENGAN')) {
      this.mode = 'offline';
      console.info('[DB] Mode: OFFLINE (localStorage) — URL API belum dikonfigurasi');
      return;
    }

    try {
      // Ping ringan ke API dengan batas waktu 8 detik.
      // Jika server cold-start atau koneksi lambat, kita tidak membiarkan
      // loader global aktif selamanya — fallback ke offline otomatis.
      const PING_TIMEOUT_MS = 8000;
      const pingPromise    = KS_API.call('ping', {});
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Ping timeout')), PING_TIMEOUT_MS)
      );
      await Promise.race([pingPromise, timeoutPromise]);
      this.mode = 'online';
      console.info('[DB] Mode: ONLINE (Google Spreadsheet)');
    } catch (e) {
      // Jika ada session token tersimpan, asumsikan online dan biarkan
      // request berikutnya yang gagal jika memang offline
      const savedToken = localStorage.getItem('ks_session_token');
      const savedId    = localStorage.getItem('ks_teacherId');
      if (savedToken && savedId) {
        this.mode = 'online';
        console.warn('[DB] Mode: ONLINE (asumsi — ping gagal tapi session aktif):', e.message);
      } else {
        this.mode = 'offline';
        console.warn('[DB] Mode: OFFLINE (localStorage) — API tidak terjangkau:', e.message);
      }
    }
  },

  isOnline() {
    return this.mode === 'online' && KS_API.teacherId !== null;
  },

  // ============================================================
  // AUTH
  // ============================================================

  async login(nip, password) {
    if (this.mode !== 'online') {
      // ---- MODE OFFLINE ----
      const saved = localStorage.getItem('ks_profile');
      if (saved) {
        const profile = JSON.parse(saved);
        const savedPwd = localStorage.getItem('ks_password');
        if (profile.nip === nip) {
          // Izinkan jika password cocok, atau belum ada password tersimpan
          if (!savedPwd || savedPwd === password) {
            if (profile.id) KS_API.teacherId = profile.id;
            return { success: true, teacher: profile };
          } else {
            return { success: false, error: 'Password salah.' };
          }
        } else {
          return { success: false, error: 'NIP tidak ditemukan. Pastikan NIP benar atau daftar akun baru.' };
        }
      }
      // Offline pertama kali: izinkan masuk
      return { success: true, teacher: null, offlineFirstTime: true };
    }

    // ---- MODE ONLINE ----
    try {
      const result = await KS_API.login(nip, password);
      if (result.success && result.teacher) {
        KS_API.teacherId = result.teacher.id;

        // Simpan session token untuk multi-device (jika server mengembalikannya)
        const token = result.sessionToken || result.token || null;
        if (token) {
          KS_API._sessionToken = token;
          localStorage.setItem('ks_session_token', token);
        }

        localStorage.setItem('ks_teacherId', result.teacher.id);
        localStorage.setItem('ks_profile', JSON.stringify(result.teacher));

        // Simpan password untuk fallback offline
        if (password) localStorage.setItem('ks_password', password);
      }
      return result;
    } catch (e) {
      // Gagal jaringan sementara: coba fallback ke data lokal yang tersimpan
      console.warn('[DB.login] Online login gagal, coba cache lokal:', e.message);
      const saved = localStorage.getItem('ks_profile');
      if (saved) {
        const profile = JSON.parse(saved);
        const savedPwd = localStorage.getItem('ks_password');
        if (profile.nip === nip && (!savedPwd || savedPwd === password)) {
          if (profile.id) KS_API.teacherId = profile.id;
          return { success: true, teacher: profile, fromCache: true };
        }
      }
      throw e;
    }
  },

  async register(profileData) {
    if (this.mode !== 'online') {
      // Offline: simpan langsung ke localStorage
      const offlineTeacher = {
        id: 'offline-' + Date.now(),
        ...profileData
      };
      delete offlineTeacher.password; // jangan simpan password di profile object
      localStorage.setItem('ks_profile', JSON.stringify(offlineTeacher));
      if (profileData.password) localStorage.setItem('ks_password', profileData.password);
      if (offlineTeacher.id) KS_API.teacherId = offlineTeacher.id;
      return { success: true, teacher: offlineTeacher };
    }

    const result = await KS_API.register(profileData);
    if (result.success && result.teacher) {
      KS_API.teacherId = result.teacher.id;

      const token = result.sessionToken || result.token || null;
      if (token) {
        KS_API._sessionToken = token;
        localStorage.setItem('ks_session_token', token);
      }

      localStorage.setItem('ks_teacherId', result.teacher.id);
      localStorage.setItem('ks_profile', JSON.stringify(result.teacher));

      // Simpan password untuk fallback offline setelah register online
      if (profileData.password) {
        localStorage.setItem('ks_password', profileData.password);
      }
    }
    return result;
  },

  /**
   * Pulihkan sesi dari storage lokal.
   * Mendukung multi-device: prioritaskan session token dari server,
   * fallback ke teacherId yang tersimpan.
   */
  restoreSession() {
    const savedId    = localStorage.getItem('ks_teacherId');
    const savedToken = localStorage.getItem('ks_session_token');

    if (savedId) {
      KS_API.teacherId = savedId;
      // Lampirkan token ke instance API agar ikut di setiap request
      if (savedToken) {
        KS_API._sessionToken = savedToken;
      }
      return true;
    }
    return false;
  },

  logout() {
    KS_API.teacherId = null;
    KS_API._sessionToken = null;
    localStorage.removeItem('ks_teacherId');
    localStorage.removeItem('ks_session_token');
    // ks_profile & ks_password tetap tersimpan agar re-login offline bisa berjalan
  },

  async changePassword(oldPassword, newPassword) {
    const savedPwd = localStorage.getItem('ks_password') || '';
    if (savedPwd && savedPwd !== oldPassword) {
      return { success: false, error: 'Password lama salah.' };
    }
    localStorage.setItem('ks_password', newPassword);
    if (this.mode === 'online') {
      try {
        return await KS_API.call('changePassword', { teacherId: KS_API.teacherId, newPassword }, true);
      } catch(e) {
        return { success: true }; // tersimpan lokal
      }
    }
    return { success: true };
  },

  // ============================================================
  // PROFILE
  // ============================================================

  async getProfile() {
    if (!this.isOnline()) {
      const saved = localStorage.getItem('ks_profile');
      return saved ? JSON.parse(saved) : null;
    }

    const result = await KS_API.call('getAll', {
      sheet: KS_API.SHEETS.TEACHERS,
      teacherId: KS_API.teacherId
    });
    const found = result.data.find(t => t.id === KS_API.teacherId);
    if (found) localStorage.setItem('ks_profile', JSON.stringify(found));
    return found || null;
  },

  async saveProfile(profile) {
    localStorage.setItem('ks_profile', JSON.stringify(profile));
    if (!this.isOnline()) return { success: true };

    return KS_API.call('save', {
      sheet: KS_API.SHEETS.TEACHERS,
      data: { ...profile, id: KS_API.teacherId }
    }, true);
  },

  // ============================================================
  // STUDENTS
  // ============================================================

  async getStudents() {
    if (!this.isOnline()) {
      const saved = localStorage.getItem('ks_students');
      return saved ? JSON.parse(saved) : [];
    }
    const result = await KS_API.getAll(KS_API.SHEETS.STUDENTS);
    localStorage.setItem('ks_students', JSON.stringify(result.data));
    return result.data;
  },

  async saveStudent(student) {
    if (!this.isOnline()) {
      const students = await this.getStudents();
      const idx = students.findIndex(s => s.id === student.id);
      if (idx >= 0) students[idx] = student;
      else students.push(student);
      localStorage.setItem('ks_students', JSON.stringify(students));
      return { success: true };
    }
    // Update localStorage cache agar data siswa tersedia saat offline/reload
    const students = JSON.parse(localStorage.getItem('ks_students') || '[]');
    const idx = students.findIndex(s => s.id === student.id);
    if (idx >= 0) students[idx] = student;
    else students.push(student);
    localStorage.setItem('ks_students', JSON.stringify(students));
    return KS_API.save(KS_API.SHEETS.STUDENTS, student);
  },

  async deleteStudent(id) {
    if (!this.isOnline()) {
      const students = await this.getStudents();
      localStorage.setItem('ks_students', JSON.stringify(students.filter(s => s.id !== id)));
      return { success: true };
    }
    // Update localStorage cache agar penghapusan langsung terrefleksi
    const students = JSON.parse(localStorage.getItem('ks_students') || '[]');
    localStorage.setItem('ks_students', JSON.stringify(students.filter(s => s.id !== id)));
    return KS_API.delete(KS_API.SHEETS.STUDENTS, id);
  },

  // ============================================================
  // EXAMS
  // ============================================================

  async getExams() {
    if (!this.isOnline()) {
      const saved = localStorage.getItem('ks_exams');
      return saved ? JSON.parse(saved) : [];
    }
    const result = await KS_API.getAll(KS_API.SHEETS.EXAMS);
    const exams = (result.data || []).map(ex => {
      if (typeof ex.questions === 'string') {
        try { ex.questions = JSON.parse(ex.questions); } catch(e) { ex.questions = []; }
      }
      return ex;
    });
    localStorage.setItem('ks_exams', JSON.stringify(exams));
    return exams;
  },

  async saveExam(exam) {
    if (!this.isOnline()) {
      const exams = await this.getExams();
      const idx = exams.findIndex(e => e.id === exam.id);
      if (idx >= 0) exams[idx] = exam;
      else exams.push(exam);
      localStorage.setItem('ks_exams', JSON.stringify(exams));
      return { success: true };
    }
    return KS_API.save(KS_API.SHEETS.EXAMS, exam);
  },

  async deleteExam(id) {
    if (!this.isOnline()) {
      const exams = await this.getExams();
      localStorage.setItem('ks_exams', JSON.stringify(exams.filter(e => e.id !== id)));
      return { success: true };
    }
    return KS_API.delete(KS_API.SHEETS.EXAMS, id);
  },

  // ============================================================
  // SUBMISSIONS
  // ============================================================

  async getSubmissions() {
    if (!this.isOnline()) {
      const saved = localStorage.getItem('ks_submissions');
      return saved ? JSON.parse(saved) : [];
    }
    const result = await KS_API.getAll(KS_API.SHEETS.SUBMISSIONS);
    const submissions = (result.data || []).map(sub => {
      if (typeof sub.answers === 'string') {
        try { sub.answers = JSON.parse(sub.answers); } catch(e) { sub.answers = {}; }
      }
      if (typeof sub.scores === 'string') {
        try { sub.scores = JSON.parse(sub.scores); } catch(e) { sub.scores = {}; }
      }
      return sub;
    });
    localStorage.setItem('ks_submissions', JSON.stringify(submissions));
    return submissions;
  },

  async saveSubmission(submission) {
    if (!this.isOnline()) {
      const subs = await this.getSubmissions();
      const idx = subs.findIndex(s => s.id === submission.id);
      if (idx >= 0) subs[idx] = submission;
      else subs.push(submission);
      localStorage.setItem('ks_submissions', JSON.stringify(subs));
      return { success: true };
    }
    return KS_API.save(KS_API.SHEETS.SUBMISSIONS, submission);
  },

  async saveManySubmissions(submissions) {
    if (!this.isOnline()) {
      // Merge dengan submissions yang sudah ada, jangan overwrite semuanya
      const existing = JSON.parse(localStorage.getItem('ks_submissions') || '[]');
      const merged = [...existing];
      submissions.forEach(sub => {
        const idx = merged.findIndex(s => s.id === sub.id);
        if (idx >= 0) merged[idx] = sub;
        else merged.push(sub);
      });
      localStorage.setItem('ks_submissions', JSON.stringify(merged));
      return { success: true };
    }
    // Mode online: update localStorage cache juga
    const existing = JSON.parse(localStorage.getItem('ks_submissions') || '[]');
    const merged = [...existing];
    submissions.forEach(sub => {
      const idx = merged.findIndex(s => s.id === sub.id);
      if (idx >= 0) merged[idx] = sub;
      else merged.push(sub);
    });
    localStorage.setItem('ks_submissions', JSON.stringify(merged));
    return KS_API.saveMany(KS_API.SHEETS.SUBMISSIONS, submissions);
  },

  async deleteSubmission(id) {
    if (!this.isOnline()) {
      const subs = await this.getSubmissions();
      localStorage.setItem('ks_submissions', JSON.stringify(subs.filter(s => s.id !== id)));
      return { success: true };
    }
    return KS_API.delete(KS_API.SHEETS.SUBMISSIONS, id);
  },

  async deleteSubmissionsByExam(examId) {
    if (!this.isOnline()) {
      const subs = await this.getSubmissions();
      localStorage.setItem('ks_submissions', JSON.stringify(subs.filter(s => s.examId !== examId)));
      return { success: true };
    }
    const subs = await this.getSubmissions();
    const ids = subs.filter(s => s.examId === examId).map(s => s.id);
    if (ids.length === 0) return { success: true };
    return KS_API.call('deleteMany', { sheet: KS_API.SHEETS.SUBMISSIONS, ids }, true);
  },

  async deleteSubmissionsByStudent(studentId) {
    if (!this.isOnline()) {
      const subs = await this.getSubmissions();
      localStorage.setItem('ks_submissions', JSON.stringify(subs.filter(s => s.studentId !== studentId)));
      return { success: true };
    }
    const subs = await this.getSubmissions();
    const ids = subs.filter(s => s.studentId === studentId).map(s => s.id);
    if (ids.length === 0) return { success: true };
    return KS_API.call('deleteMany', { sheet: KS_API.SHEETS.SUBMISSIONS, ids }, true);
  },

  // ============================================================
  // ACTIVITIES
  // ============================================================

  async getActivities() {
    if (!this.isOnline()) {
      const saved = localStorage.getItem('ks_activities');
      return saved ? JSON.parse(saved) : [];
    }
    const result = await KS_API.getAll(KS_API.SHEETS.ACTIVITIES);
    return result.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  async saveActivity(activity) {
    if (!this.isOnline()) {
      const acts = await this.getActivities();
      acts.unshift(activity);
      const trimmed = acts.slice(0, 30);
      localStorage.setItem('ks_activities', JSON.stringify(trimmed));
      return { success: true };
    }
    return KS_API.save(KS_API.SHEETS.ACTIVITIES, activity);
  },

  // ============================================================
  // THEME & DARK MODE (selalu localStorage — bersifat lokal)
  // ============================================================

  getTheme() {
    return localStorage.getItem('ks_theme') || 'blue';
  },

  saveTheme(theme) {
    localStorage.setItem('ks_theme', theme);
  },

  getDarkMode() {
    return localStorage.getItem('ks_darkmode') === 'true';
  },

  saveDarkMode(val) {
    localStorage.setItem('ks_darkmode', val.toString());
  }
};
