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

  /**
   * Kirim request ke Google Apps Script
   * @param {string} action - Nama action
   * @param {object} payload - Data tambahan
   * @param {boolean} isPost - true = POST, false = GET
   */
  async call(action, payload = {}, isPost = false) {
    try {
      let response;

      if (isPost) {
        response = await fetch(GAS_URL, {
          method: 'POST',
          // redirect: 'follow' diperlukan karena GAS memakai redirect
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action, ...payload })
        });
      } else {
        const params = new URLSearchParams({ action, ...payload });
        response = await fetch(`${GAS_URL}?${params}`, { redirect: 'follow' });
      }

      const result = await response.json();

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
      // Ping ringan ke API
      await KS_API.call('getAll', { sheet: 'teachers', teacherId: 'ping-test' });
      this.mode = 'online';
      console.info('[DB] Mode: ONLINE (Google Spreadsheet)');
    } catch (e) {
      this.mode = 'offline';
      console.warn('[DB] Mode: OFFLINE (localStorage) — API tidak terjangkau:', e.message);
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
      // Offline: cek NIP dan password
      const saved = localStorage.getItem('ks_profile');
      if (saved) {
        const profile = JSON.parse(saved);
        const savedPwd = localStorage.getItem('ks_password');
        if (profile.nip === nip) {
          // Jika belum ada password tersimpan, izinkan login pertama kali
          if (!savedPwd || savedPwd === password) {
            return { success: true, teacher: profile };
          } else {
            return { success: false, error: 'Password salah.' };
          }
        } else {
          return { success: false, error: 'NIP tidak ditemukan.' };
        }
      }
      // Offline pertama kali: izinkan login dengan NIP apa saja
      return { success: true, teacher: null, offlineFirstTime: true };
    }

    const result = await KS_API.login(nip, password);
    if (result.success) {
      KS_API.teacherId = result.teacher.id;
      localStorage.setItem('ks_teacherId', result.teacher.id);
      localStorage.setItem('ks_profile', JSON.stringify(result.teacher));
    }
    return result;
  },

  async register(profileData) {
    if (this.mode !== 'online') {
      // Offline: simpan langsung ke localStorage
      const offlineTeacher = {
        id: 'offline-' + Date.now(),
        ...profileData
      };
      delete offlineTeacher.password; // jangan simpan password di profile
      localStorage.setItem('ks_profile', JSON.stringify(offlineTeacher));
      if (profileData.password) localStorage.setItem('ks_password', profileData.password);
      return { success: true, teacher: offlineTeacher };
    }

    const result = await KS_API.register(profileData);
    if (result.success) {
      KS_API.teacherId = result.teacher.id;
      localStorage.setItem('ks_teacherId', result.teacher.id);
      localStorage.setItem('ks_profile', JSON.stringify(result.teacher));
    }
    return result;
  },

  restoreSession() {
    const savedId = localStorage.getItem('ks_teacherId');
    if (savedId) {
      KS_API.teacherId = savedId;
      return true;
    }
    return false;
  },

  logout() {
    KS_API.teacherId = null;
    localStorage.removeItem('ks_teacherId');
    // Note: ks_profile, ks_password, dan data lain tetap tersimpan untuk re-login
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
        return { success: true }; // saved locally at least
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
    return KS_API.save(KS_API.SHEETS.STUDENTS, student);
  },

  async deleteStudent(id) {
    if (!this.isOnline()) {
      const students = await this.getStudents();
      localStorage.setItem('ks_students', JSON.stringify(students.filter(s => s.id !== id)));
      return { success: true };
    }
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
    localStorage.setItem('ks_exams', JSON.stringify(result.data));
    return result.data;
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
    localStorage.setItem('ks_submissions', JSON.stringify(result.data));
    return result.data;
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
      localStorage.setItem('ks_submissions', JSON.stringify(submissions));
      return { success: true };
    }
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
