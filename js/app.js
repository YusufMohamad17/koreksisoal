/**
 * KoreksiSoal - Application Logic
 * Pair programmed with Antigravity AI
 * Versi Online: menggunakan Google Apps Script + Spreadsheet sebagai database
 */

class KoreksiSoalApp {
  constructor() {
    this.profile = {};
    this.students = [];
    this.exams = [];
    this.submissions = [];
    this.activities = [];
    
    this.currentView = 'dashboard';
    this.activeTheme = 'blue';
    this.darkMode = false;
    this.chartInstance = null;
    this.isLoading = false;

    // Default avatars list
    this.defaultAvatars = {
      'avatar-1': 'https://api.dicebear.com/7.x/adventurer/svg?seed=budi&backgroundColor=b6e3f4',
      'avatar-2': 'https://api.dicebear.com/7.x/adventurer/svg?seed=sri&backgroundColor=ffdfbf',
      'avatar-3': 'https://api.dicebear.com/7.x/adventurer/svg?seed=dewi&backgroundColor=d1d4f9',
      'avatar-4': 'https://api.dicebear.com/7.x/adventurer/svg?seed=joko&backgroundColor=c0aede',
      'avatar-5': 'https://api.dicebear.com/7.x/adventurer/svg?seed=rudi&backgroundColor=ffeedd',
      'avatar-6': 'https://api.dicebear.com/7.x/adventurer/svg?seed=ani&backgroundColor=d1f4ff',
      'avatar-7': 'https://api.dicebear.com/7.x/adventurer/svg?seed=bambang&backgroundColor=ffd1dc',
      'avatar-8': 'https://api.dicebear.com/7.x/adventurer/svg?seed=eka&backgroundColor=e8ffd1'
    };
  }

  // ============================================================
  // INIT & LOADING STATE
  // ============================================================

  async init() {
    this.activeTheme = DB.getTheme();
    this.darkMode = DB.getDarkMode();
    this.applyTheme();
    this.setupEventListeners();
    lucide.createIcons();

    // Inisialisasi DB — cek mode online/offline
    this.showGlobalLoader('Menyambungkan ke database...');
    await DB.init();

    // Cek apakah ada sesi tersimpan
    const hasSession = DB.restoreSession();

    if (hasSession || DB.mode === 'offline') {
      await this.loadAllData();
    } else {
      // Tampilkan layar login jika online tapi belum login
      this.hideGlobalLoader();
      this.showLoginScreen();
      return;
    }

    this.hideGlobalLoader();
    this.syncSubmissions();
    this.switchView(this.currentView);
  }

  async loadAllData() {
    try {
      this.showGlobalLoader('Memuat data dari database...');

      const [profile, students, exams, submissions, activities] = await Promise.all([
        DB.getProfile(),
        DB.getStudents(),
        DB.getExams(),
        DB.getSubmissions(),
        DB.getActivities()
      ]);

      this.profile    = profile    || { ...DEFAULT_PROFILE };
      this.students   = students.length   ? students   : [...DEFAULT_STUDENTS];
      this.exams      = exams.length      ? exams      : [...DEFAULT_EXAMS];
      this.submissions= submissions.length? submissions : [...DEFAULT_SUBMISSIONS];
      this.activities = activities.length ? activities  : [...DEFAULT_ACTIVITIES];

      // Tampilkan badge mode di header
      this.renderDbModeBadge();

    } catch (err) {
      console.error('[loadAllData]', err);
      this.showToast('Gagal memuat data: ' + err.message, 'error');
    } finally {
      this.hideGlobalLoader();
    }
  }

  // Simpan satu item ke DB (tidak perlu simpan semua sekaligus)
  async saveItem(type, data) {
    try {
      switch (type) {
        case 'profile':    return await DB.saveProfile(data);
        case 'student':    return await DB.saveStudent(data);
        case 'exam':       return await DB.saveExam(data);
        case 'submission': return await DB.saveSubmission(data);
        case 'activity':   return await DB.saveActivity(data);
      }
    } catch (err) {
      console.error('[saveItem]', type, err);
      this.showToast('Gagal menyimpan: ' + err.message, 'error');
    }
  }

  // Legacy saveState: simpan theme & darkmode saja (data lain disimpan per-item)
  saveState() {
    DB.saveTheme(this.activeTheme);
    DB.saveDarkMode(this.darkMode);
  }

  // ============================================================
  // LOGIN SCREEN
  // ============================================================

  showLoginScreen() {
    // Inject login overlay jika belum ada
    if (!document.getElementById('login-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'login-overlay';
      overlay.style.cssText = `
        position: fixed; inset: 0; background: var(--bg-base);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999; flex-direction: column; gap: 1rem;
      `;
      overlay.innerHTML = `
        <div style="background: var(--bg-card); border-radius: var(--radius-lg); padding: 2.5rem; width: 380px; max-width: 95vw; box-shadow: 0 8px 32px rgba(0,0,0,0.15);">
          <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:1.5rem;">
            <div style="background:var(--primary); border-radius:var(--radius-md); padding:0.5rem; display:flex;">
              <i data-lucide="check-square" style="color:white; width:24px; height:24px;"></i>
            </div>
            <h2 style="margin:0; font-size:1.4rem;">KoreksiSoal</h2>
          </div>

          <div id="login-form-section">
            <p class="text-muted" style="margin-bottom:1.5rem; font-size:0.9rem;">Masuk dengan NIP Anda untuk mengakses data ujian sekolah.</p>
            <div class="form-group">
              <label class="form-label">NIP Guru</label>
              <input type="text" id="login-nip" class="form-input" placeholder="Contoh: 19900512201503002" style="font-size:1rem;">
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" id="login-password" class="form-input" placeholder="Password Anda" style="font-size:1rem;">
            </div>
            <button class="btn btn-primary" style="width:100%; margin-top:0.5rem; font-size:1rem;" id="btn-do-login">
              <i data-lucide="log-in"></i> Masuk
            </button>
            <button class="btn btn-secondary" style="width:100%; margin-top:0.75rem;" id="btn-show-register">
              Belum terdaftar? Daftar di sini
            </button>
          </div>

          <div id="register-form-section" style="display:none;">
            <p class="text-muted" style="margin-bottom:1.5rem; font-size:0.9rem;">Daftarkan akun guru baru.</p>
            <div class="form-group">
              <label class="form-label">Nama Lengkap</label>
              <input type="text" id="reg-name" class="form-input" placeholder="Nama Anda">
            </div>
            <div class="form-group">
              <label class="form-label">NIP</label>
              <input type="text" id="reg-nip" class="form-input" placeholder="NIP Anda">
            </div>
            <div class="form-group">
              <label class="form-label">Nama Sekolah</label>
              <input type="text" id="reg-school" class="form-input" placeholder="Nama sekolah/instansi">
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" id="reg-password" class="form-input" placeholder="Buat password">
            </div>
            <button class="btn btn-primary" style="width:100%; margin-top:0.5rem;" id="btn-do-register">
              <i data-lucide="user-plus"></i> Daftar & Masuk
            </button>
            <button class="btn btn-secondary" style="width:100%; margin-top:0.75rem;" id="btn-show-login">
              Sudah punya akun? Masuk
            </button>
          </div>

          <div id="login-error" style="display:none; margin-top:1rem; padding:0.75rem; background:var(--danger-light,#fee2e2); border-radius:var(--radius-sm); color:var(--danger); font-size:0.875rem;"></div>

          <p style="margin-top:1.5rem; font-size:0.75rem; color:var(--text-muted); text-align:center;">
            Mode: ${DB.mode === 'online' ? '🟢 Online (Google Spreadsheet)' : '🟡 Offline (Browser)'} 
          </p>
        </div>
      `;
      document.body.appendChild(overlay);
      lucide.createIcons();

      // Event listeners login screen
      document.getElementById('btn-do-login').addEventListener('click', () => this.handleLogin());
      document.getElementById('btn-do-register').addEventListener('click', () => this.handleRegister());
      document.getElementById('btn-show-register').addEventListener('click', () => {
        document.getElementById('login-form-section').style.display = 'none';
        document.getElementById('register-form-section').style.display = '';
      });
      document.getElementById('btn-show-login').addEventListener('click', () => {
        document.getElementById('register-form-section').style.display = 'none';
        document.getElementById('login-form-section').style.display = '';
      });
      // Enter key on password
      document.getElementById('login-password').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleLogin();
      });
    }

    document.getElementById('login-overlay').style.display = 'flex';
  }

  async handleLogin() {
    const nip = document.getElementById('login-nip').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';

    if (!nip) { errEl.textContent = 'NIP tidak boleh kosong.'; errEl.style.display = 'block'; return; }

    const btn = document.getElementById('btn-do-login');
    btn.disabled = true;
    btn.textContent = 'Memproses...';

    try {
      const result = await DB.login(nip, password);

      if (result.success) {
        if (result.teacher) {
          this.profile = result.teacher;
        }
        document.getElementById('login-overlay').remove();
        await this.loadAllData();
        this.syncSubmissions();
        this.switchView('dashboard');
      } else {
        errEl.textContent = result.error || 'Login gagal.';
        errEl.style.display = 'block';
      }
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="log-in"></i> Masuk';
      lucide.createIcons();
    }
  }

  async handleRegister() {
    const name = document.getElementById('reg-name').value.trim();
    const nip = document.getElementById('reg-nip').value.trim();
    const school = document.getElementById('reg-school').value.trim();
    const password = document.getElementById('reg-password').value;
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';

    if (!name || !nip || !school) {
      errEl.textContent = 'Nama, NIP, dan Sekolah wajib diisi.';
      errEl.style.display = 'block';
      return;
    }

    const btn = document.getElementById('btn-do-register');
    btn.disabled = true; btn.textContent = 'Mendaftarkan...';

    try {
      const result = await DB.register({ name, nip, school, password, academicYear: '2025/2026', avatar: 'avatar-1' });

      if (result.success) {
        this.profile = result.teacher;
        document.getElementById('login-overlay').remove();
        await this.loadAllData();
        this.switchView('setting');
      } else {
        errEl.textContent = result.error || 'Pendaftaran gagal.';
        errEl.style.display = 'block';
      }
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Daftar & Masuk';
    }
  }

  // ============================================================
  // LOADING SPINNER & TOAST
  // ============================================================

  showGlobalLoader(text = 'Memuat...') {
    let loader = document.getElementById('ks-global-loader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'ks-global-loader';
      loader.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center; z-index: 99999;
        flex-direction: column; gap: 1rem; color: white;
      `;
      loader.innerHTML = `
        <div style="width:40px;height:40px;border:4px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:ks-spin 0.8s linear infinite;"></div>
        <span id="ks-loader-text" style="font-size:0.95rem; font-weight:600;">${text}</span>
        <style>@keyframes ks-spin{to{transform:rotate(360deg)}}</style>
      `;
      document.body.appendChild(loader);
    } else {
      loader.style.display = 'flex';
      const t = document.getElementById('ks-loader-text');
      if (t) t.textContent = text;
    }
  }

  hideGlobalLoader() {
    const loader = document.getElementById('ks-global-loader');
    if (loader) loader.style.display = 'none';
  }

  showToast(message, type = 'info') {
    const colors = { info: '#3b82f6', success: '#22c55e', error: '#ef4444', warning: '#f59e0b' };
    const toast = document.createElement('div');
    toast.style.cssText = `
      position:fixed; bottom:1.5rem; right:1.5rem; z-index:99998;
      background:${colors[type] || colors.info}; color:white;
      padding:0.75rem 1.25rem; border-radius:0.5rem; font-size:0.875rem;
      font-weight:600; box-shadow:0 4px 16px rgba(0,0,0,0.2);
      animation: ks-fadein 0.25s ease; max-width: 320px;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  renderDbModeBadge() {
    // Tampilkan indikator mode di header
    let badge = document.getElementById('db-mode-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'db-mode-badge';
      badge.style.cssText = 'font-size:0.7rem; padding:2px 8px; border-radius:99px; font-weight:700; margin-left:8px; vertical-align:middle; cursor:default;';
      const brandName = document.querySelector('.brand-name');
      if (brandName) brandName.appendChild(badge);
    }
    if (DB.mode === 'online') {
      badge.textContent = '🟢 Online';
      badge.style.background = '#dcfce7'; badge.style.color = '#166534';
      badge.title = 'Terhubung ke Google Spreadsheet';
    } else {
      badge.textContent = '🟡 Offline';
      badge.style.background = '#fef9c3'; badge.style.color = '#854d0e';
      badge.title = 'Menyimpan data di browser lokal';
    }
  }

  // Create empty/uncompleted submission entries for students who don't have them yet
  syncSubmissions() {
    const newSubs = [];
    this.exams.forEach(exam => {
      const targetStudents = this.students.filter(s => s.className === exam.className);
      targetStudents.forEach(student => {
        const exists = this.submissions.some(sub => sub.examId === exam.id && sub.studentId === student.id);
        if (!exists) {
          const answers = {};
          const scores = {};
          exam.questions.forEach(q => {
            answers[q.id] = q.type === 'PGK' ? [] : '';
            scores[q.id] = 0;
          });
          const newSub = {
            id: `sub-gen-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            examId: exam.id,
            studentId: student.id,
            answers,
            scores,
            totalScore: 0,
            status: 'Belum',
            gradedAt: ''
          };
          this.submissions.push(newSub);
          newSubs.push(newSub);
        }
      });
    });
    if (newSubs.length > 0) {
      newSubs.forEach(sub => DB.saveSubmission(sub).catch(console.error));
    }
  }

  logActivity(text) {
    const newActivity = {
      id: `act-${Date.now()}`,
      text,
      timestamp: new Date().toISOString()
    };
    this.activities.unshift(newActivity);
    if (this.activities.length > 30) this.activities.pop();
    DB.saveActivity(newActivity).catch(console.error);
  }

  applyTheme() {
    // Clear theme classes
    document.body.classList.remove('theme-blue', 'theme-green', 'theme-violet', 'theme-amber', 'dark-mode');
    
    // Add active classes
    document.body.classList.add(`theme-${this.activeTheme}`);
    if (this.darkMode) {
      document.body.classList.add('dark-mode');
    }

    // Update icons and visual indicators
    const themeDots = document.querySelectorAll('.theme-dot');
    themeDots.forEach(dot => {
      if (dot.getAttribute('data-theme') === this.activeTheme) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });

    const dmIcon = document.getElementById('dark-mode-icon');
    const dmBtnText = document.getElementById('setting-toggle-dark-mode');
    
    if (this.darkMode) {
      if (dmIcon) dmIcon.setAttribute('data-lucide', 'sun');
      if (dmBtnText) dmBtnText.innerHTML = '<i data-lucide="sun"></i>Aktifkan Mode Terang';
    } else {
      if (dmIcon) dmIcon.setAttribute('data-lucide', 'moon');
      if (dmBtnText) dmBtnText.innerHTML = '<i data-lucide="moon"></i>Aktifkan Mode Gelap';
    }
    
    lucide.createIcons();
    this.renderHeaderProfile();
  }

  switchView(viewName) {
    this.currentView = viewName;
    
    // Switch active view styling in top navbar
    document.querySelectorAll('.desktop-nav .nav-link').forEach(link => {
      if (link.getAttribute('data-target') === viewName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Switch active view styling in bottom navbar
    document.querySelectorAll('.bottom-nav .mobile-nav-item').forEach(item => {
      if (item.getAttribute('data-target') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Switch sections
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });
    
    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    // Trigger sub-render functions
    switch (viewName) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'ujian':
        this.renderExams();
        break;
      case 'siswa':
        this.renderStudents();
        break;
      case 'koreksi':
        this.renderCorrections();
        break;
      case 'eksport':
        this.renderExport();
        break;
      case 'setting':
        this.renderSettings();
        break;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Header display refresh
  renderHeaderProfile() {
    const avatarImg = document.getElementById('header-avatar');
    const nameText = document.getElementById('header-name');
    const schoolText = document.getElementById('header-school');
    
    if (this.profile.customPhoto) {
      avatarImg.src = this.profile.customPhoto;
    } else {
      avatarImg.src = this.defaultAvatars[this.profile.avatar] || this.defaultAvatars['avatar-1'];
    }

    nameText.innerText = this.profile.name;
    schoolText.innerText = this.profile.school;
    
    const academicYearBadge = document.getElementById('dashboard-academic-year');
    if (academicYearBadge) {
      academicYearBadge.innerText = `Tahun Ajar: ${this.profile.academicYear}`;
    }
  }

  /* ==========================================================================
     DASHBOARD CONTROLLER
     ========================================================================== */
  renderDashboard() {
    this.renderHeaderProfile();

    // 1. Calculate stats
    // Total exams
    document.getElementById('stat-total-exams').innerText = this.exams.length;
    // Total students
    document.getElementById('stat-total-students').innerText = this.students.length;
    
    // Correction completion rates
    // Count expected submissions: for each exam, count number of students in that class
    let expectedCount = 0;
    this.exams.forEach(ex => {
      const studentCount = this.students.filter(s => s.className === ex.className).length;
      expectedCount += studentCount;
    });

    const finishedSubmissions = this.submissions.filter(s => s.status === 'Selesai');
    const completionRate = expectedCount > 0 ? Math.round((finishedSubmissions.length / expectedCount) * 100) : 0;
    document.getElementById('stat-correction-rate').innerText = `${completionRate}%`;

    // Average Score
    const scoredSubmissions = this.submissions.filter(s => s.status === 'Selesai');
    let avgScore = 0;
    if (scoredSubmissions.length > 0) {
      const sum = scoredSubmissions.reduce((acc, sub) => acc + sub.totalScore, 0);
      avgScore = (sum / scoredSubmissions.length).toFixed(1);
    }
    document.getElementById('stat-avg-score').innerText = avgScore;

    // 2. Render charts
    this.renderDashboardChart();

    // 3. Render recent activities list
    const actBody = document.querySelector('#activities-table tbody');
    actBody.innerHTML = '';
    
    if (this.activities.length === 0) {
      actBody.innerHTML = '<tr><td class="text-center text-muted">Belum ada riwayat aktivitas.</td></tr>';
    } else {
      // Show top 5 activities
      this.activities.slice(0, 5).forEach(act => {
        const date = new Date(act.timestamp);
        const formattedTime = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const formattedDate = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        
        actBody.innerHTML += `
          <tr>
            <td>
              <div style="display:flex; flex-direction:column; gap:0.2rem;">
                <span style="font-size:0.875rem; font-weight:600;">${act.text}</span>
                <span style="font-size:0.75rem; color:var(--text-muted);"><i data-lucide="clock" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:4px;"></i>${formattedDate}, ${formattedTime}</span>
              </div>
            </td>
          </tr>
        `;
      });
      lucide.createIcons();
    }

    // 4. Render "Butuh Koreksi Segera" list
    const pendingBody = document.querySelector('#pending-correction-table tbody');
    pendingBody.innerHTML = '';

    const pendingSubmissions = this.submissions.filter(s => s.status !== 'Selesai').slice(0, 4);
    
    if (pendingSubmissions.length === 0) {
      pendingBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted" style="padding:1.5rem;">Semua ujian sudah selesai dikoreksi! 🎉</td></tr>';
    } else {
      pendingSubmissions.forEach(sub => {
        const student = this.students.find(s => s.id === sub.studentId);
        const exam = this.exams.find(e => e.id === sub.examId);
        if (!student || !exam) return;

        const statusClass = sub.status === 'Proses' ? 'badge-warning' : 'badge-danger';
        const statusText = sub.status === 'Proses' ? 'Proses' : 'Belum';

        pendingBody.innerHTML += `
          <tr>
            <td style="font-weight:600;">${student.name}</td>
            <td>
              <div style="display:flex; flex-direction:column;">
                <span style="font-size:0.85rem; font-weight:500;">${exam.name}</span>
                <span style="font-size:0.75rem; color:var(--text-muted);">${exam.subject} (${exam.className})</span>
              </div>
            </td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td>
              <button class="btn btn-primary btn-sm" onclick="app.openCorrectionModal('${sub.id}')">
                <i data-lucide="check-square" style="width:14px; height:14px;"></i>Koreksi
              </button>
            </td>
          </tr>
        `;
      });
      lucide.createIcons();
    }

    // 5. Render class summaries
    const classSummaryBody = document.querySelector('#class-summary-table tbody');
    classSummaryBody.innerHTML = '';

    // Get unique classes
    const classes = [...new Set(this.students.map(s => s.className))];
    
    if (classes.length === 0) {
      classSummaryBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Belum ada data kelas.</td></tr>';
    } else {
      classes.forEach(cls => {
        const classStudents = this.students.filter(s => s.className === cls);
        
        // Average score for this class
        const classSubs = this.submissions.filter(sub => {
          const student = this.students.find(s => s.id === sub.studentId);
          return student && student.className === cls && sub.status === 'Selesai';
        });

        let classAvg = '-';
        if (classSubs.length > 0) {
          const sum = classSubs.reduce((acc, sub) => acc + sub.totalScore, 0);
          classAvg = (sum / classSubs.length).toFixed(1);
        }

        // Completion status
        const totalExpectedClass = this.exams.filter(e => e.className === cls).length * classStudents.length;
        const totalCompletedClass = this.submissions.filter(sub => {
          const student = this.students.find(s => s.id === sub.studentId);
          return student && student.className === cls && sub.status === 'Selesai';
        }).length;
        
        const complPercent = totalExpectedClass > 0 ? Math.round((totalCompletedClass / totalExpectedClass) * 100) : 0;

        classSummaryBody.innerHTML += `
          <tr>
            <td style="font-weight:700;">${cls}</td>
            <td>${classStudents.length} Siswa</td>
            <td style="font-weight:600; color:var(--primary);">${classAvg}</td>
            <td>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <div style="flex:1; height:6px; background-color:var(--border-color); border-radius:3px; overflow:hidden; min-width:60px;">
                  <div style="width:${complPercent}%; height:100%; background-color:var(--primary); border-radius:3px;"></div>
                </div>
                <span style="font-size:0.75rem; font-weight:700;">${complPercent}%</span>
              </div>
            </td>
          </tr>
        `;
      });
    }
  }

  renderDashboardChart() {
    const ctx = document.getElementById('dashboardChart');
    if (!ctx) return;

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    // Build data: Average score per exam
    const labels = [];
    const avgScores = [];
    const bgColors = [];

    this.exams.forEach((ex, idx) => {
      labels.push(`${ex.subject} - ${ex.className}`);
      
      const finishedSubs = this.submissions.filter(s => s.examId === ex.id && s.status === 'Selesai');
      if (finishedSubs.length > 0) {
        const sum = finishedSubs.reduce((acc, s) => acc + s.totalScore, 0);
        avgScores.push((sum / finishedSubs.length).toFixed(1));
      } else {
        avgScores.push(0);
      }

      // Generate colorful bars
      const hues = [221, 142, 262, 35];
      const selectedHue = hues[idx % hues.length];
      bgColors.push(`hsla(${selectedHue}, 80%, 60%, 0.7)`);
    });

    const isDark = this.darkMode;
    const textMainColor = isDark ? '#f8fafc' : '#0f172a';
    const gridColor = isDark ? '#1f2937' : '#e2e8f0';

    this.chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Nilai Rata-rata Ujian',
          data: avgScores,
          backgroundColor: bgColors,
          borderWidth: 0,
          borderRadius: 8,
          barThickness: 35
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            titleColor: textMainColor,
            bodyColor: textMainColor,
            borderColor: gridColor,
            borderWidth: 1,
            padding: 10,
            displayColors: false
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: textMainColor,
              font: {
                family: 'Plus Jakarta Sans',
                weight: '600',
                size: 11
              }
            }
          },
          y: {
            grid: {
              color: gridColor
            },
            ticks: {
              color: textMainColor,
              font: {
                family: 'Plus Jakarta Sans'
              },
              min: 0,
              max: 100
            }
          }
        }
      }
    });
  }

  /* ==========================================================================
     EXAMS CONTROLLER (DATA UJIAN)
     ========================================================================== */
  renderExams() {
    const searchVal = document.getElementById('search-exam').value.toLowerCase();
    const tableBody = document.querySelector('#exams-table tbody');
    tableBody.innerHTML = '';

    const filteredExams = this.exams.filter(ex => 
      ex.name.toLowerCase().includes(searchVal) || 
      ex.subject.toLowerCase().includes(searchVal) ||
      ex.className.toLowerCase().includes(searchVal)
    );

    if (filteredExams.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">Tidak ditemukan data ujian.</td></tr>';
      return;
    }

    filteredExams.forEach(ex => {
      const qCount = ex.questions.length;
      const totalWeight = ex.questions.reduce((acc, q) => acc + q.weight, 0);

      tableBody.innerHTML += `
        <tr>
          <td style="font-weight:700;">${ex.name}</td>
          <td><span class="badge badge-info">${ex.subject}</span></td>
          <td><span class="badge badge-success">${ex.className}</span></td>
          <td style="font-weight:600;">${qCount} Butir</td>
          <td style="font-weight:600;">${totalWeight} / 100</td>
          <td>
            <div style="display:flex; gap:0.4rem;">
              <button class="btn btn-secondary btn-icon-only btn-sm" onclick="app.openExamModal('${ex.id}')" title="Edit Ujian">
                <i data-lucide="edit" style="width:16px; height:16px; color:var(--primary);"></i>
              </button>
              <button class="btn btn-secondary btn-icon-only btn-sm" onclick="app.duplicateExam('${ex.id}')" title="Duplikat Ujian">
                <i data-lucide="copy" style="width:16px; height:16px; color:var(--success);"></i>
              </button>
              <button class="btn btn-secondary btn-icon-only btn-sm" onclick="app.deleteExam('${ex.id}')" title="Hapus Ujian">
                <i data-lucide="trash-2" style="width:16px; height:16px; color:var(--danger);"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    lucide.createIcons();
  }

  // Handle Exam modal builder rows dynamically
  openExamModal(examId = '') {
    const modal = document.getElementById('exam-overlay') || document.getElementById('exam-modal');
    const title = document.getElementById('exam-modal-title');
    const formExamId = document.getElementById('form-exam-id');
    const formName = document.getElementById('form-exam-name');
    const formSubject = document.getElementById('form-exam-subject');
    const formClass = document.getElementById('form-exam-class');
    const qListContainer = document.getElementById('modal-questions-list');

    qListContainer.innerHTML = '';
    
    if (examId) {
      title.innerText = 'Edit Data Ujian & Soal';
      const exam = this.exams.find(e => e.id === examId);
      formExamId.value = exam.id;
      formName.value = exam.name;
      formSubject.value = exam.subject;
      formClass.value = exam.className;

      // Populate questions
      exam.questions.forEach((q, idx) => {
        this.addQuestionRowToModal(idx + 1, q);
      });
    } else {
      title.innerText = 'Tambah Ujian Baru';
      formExamId.value = '';
      formName.value = '';
      formSubject.value = '';
      formClass.value = '';
      
      // Default: Create 5 blank questions
      for (let i = 1; i <= 5; i++) {
        this.addQuestionRowToModal(i);
      }
    }

    this.calculateFormWeights();
    modal.classList.add('active');
    lucide.createIcons();
  }

  closeExamModal() {
    const modal = document.getElementById('exam-modal');
    modal.classList.remove('active');
  }

  // Generates HTML row inside the modal question list builder
  addQuestionRowToModal(index, data = null) {
    const container = document.getElementById('modal-questions-list');
    const rowId = `q-row-${index}`;
    
    const type = data ? data.type : 'PG'; // Default Multiple Choice
    const text = data ? data.text : '';
    const weight = data ? data.weight : 20; // Default weight is 20 if 5 questions
    const key = data ? data.key : '';

    const rowDiv = document.createElement('div');
    rowDiv.className = 'question-row-card';
    rowDiv.id = rowId;
    rowDiv.setAttribute('data-index', index);

    // Build the keys elements depending on type
    let keyHtml = '';
    if (type === 'PG') {
      keyHtml = this.generatePGOptionsHtml(index, key);
    } else if (type === 'PGK') {
      keyHtml = this.generatePGKOptionsHtml(index, key);
    } else if (type === 'BS') {
      keyHtml = this.generateBSOptionsHtml(index, key);
    } else if (type === 'ES') {
      keyHtml = `<input type="text" class="form-input q-key-input" value="${key || ''}" placeholder="Kata kunci penilai (pisahkan dengan koma), contoh: otot, cedera, darah" style="font-size:0.85rem;">`;
    }

    rowDiv.innerHTML = `
      <div class="q-number-badge">${index}</div>
      <div class="q-content-inputs">
        <div class="form-row" style="grid-template-columns: 2fr 1fr 1fr;">
          <div class="form-group" style="margin-bottom:0;">
            <input type="text" class="form-input q-text-input" value="${text}" placeholder="Tuliskan butir teks soal..." required>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <select class="form-input q-type-select" onchange="app.handleQuestionTypeChange(${index}, this.value)">
              <option value="PG" ${type === 'PG' ? 'selected' : ''}>Pilihan Ganda</option>
              <option value="PGK" ${type === 'PGK' ? 'selected' : ''}>PG Kompleks</option>
              <option value="BS" ${type === 'BS' ? 'selected' : ''}>Benar / Salah</option>
              <option value="ES" ${type === 'ES' ? 'selected' : ''}>Esai (Essay)</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0; flex-direction:row; align-items:center; gap:0.5rem;">
            <label style="font-size:0.8rem; font-weight:700;">Bobot:</label>
            <input type="number" class="form-input q-weight-input" value="${weight}" min="1" max="100" oninput="app.calculateFormWeights()" required style="width:70px;">
            <button type="button" class="btn btn-secondary btn-icon-only btn-sm" onclick="app.deleteQuestionRow(${index})" style="border-color:var(--danger); border-radius:var(--radius-sm);">
              <i data-lucide="trash-2" style="width:14px; height:14px; color:var(--danger);"></i>
            </button>
          </div>
        </div>
        
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" style="font-size:0.75rem;">Kunci Jawaban:</label>
          <div class="key-wrapper-div" id="key-wrapper-${index}">
            ${keyHtml}
          </div>
        </div>
      </div>
    `;

    container.appendChild(rowDiv);
    lucide.createIcons();
  }

  generatePGOptionsHtml(index, selectedKey = '') {
    let html = `<div class="q-options-container" data-qindex="${index}" data-mode="single">`;
    ['A', 'B', 'C', 'D', 'E'].forEach(opt => {
      const isSelected = selectedKey === opt ? 'selected' : '';
      html += `<div class="option-btn ${isSelected}" onclick="app.selectOption(this, '${opt}')">${opt}</div>`;
    });
    html += `</div>`;
    return html;
  }

  generatePGKOptionsHtml(index, selectedKeys = []) {
    // Ensure selectedKeys is an array
    const keysArray = Array.isArray(selectedKeys) ? selectedKeys : (selectedKeys ? [selectedKeys] : []);
    
    let html = `<div class="q-options-container" data-qindex="${index}" data-mode="multiple">`;
    ['A', 'B', 'C', 'D', 'E'].forEach(opt => {
      const isSelected = keysArray.includes(opt) ? 'selected' : '';
      html += `<div class="option-btn ${isSelected}" onclick="app.selectOption(this, '${opt}')">${opt}</div>`;
    });
    html += `</div>`;
    return html;
  }

  generateBSOptionsHtml(index, selectedKey = '') {
    const isBenar = selectedKey === 'Benar' ? 'selected' : '';
    const isSalah = selectedKey === 'Salah' ? 'selected' : '';
    
    return `
      <div class="q-options-container" data-qindex="${index}" data-mode="bs">
        <div class="bs-toggle-btn ${isBenar}" onclick="app.selectBSOption(this, 'Benar')">BENAR</div>
        <div class="bs-toggle-btn ${isSalah}" onclick="app.selectBSOption(this, 'Salah')">SALAH</div>
      </div>
    `;
  }

  handleQuestionTypeChange(index, newType) {
    const wrapper = document.getElementById(`key-wrapper-${index}`);
    if (!wrapper) return;
    
    if (newType === 'PG') {
      wrapper.innerHTML = this.generatePGOptionsHtml(index);
    } else if (newType === 'PGK') {
      wrapper.innerHTML = this.generatePGKOptionsHtml(index);
    } else if (newType === 'BS') {
      wrapper.innerHTML = this.generateBSOptionsHtml(index);
    } else if (newType === 'ES') {
      wrapper.innerHTML = `<input type="text" class="form-input q-key-input" placeholder="Kata kunci penilai (pisahkan dengan koma), contoh: otot, cedera, darah" style="font-size:0.85rem;">`;
    }
  }

  // Selection toggle logic for options in question creator
  selectOption(element, val) {
    const container = element.parentNode;
    const mode = container.getAttribute('data-mode');
    
    if (mode === 'single') {
      container.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('selected'));
      element.classList.add('selected');
    } else {
      element.classList.toggle('selected');
    }
  }

  selectBSOption(element, val) {
    const container = element.parentNode;
    container.querySelectorAll('.bs-toggle-btn').forEach(btn => btn.classList.remove('selected'));
    element.classList.add('selected');
  }

  deleteQuestionRow(index) {
    const row = document.getElementById(`q-row-${index}`);
    if (row) {
      row.remove();
      this.calculateFormWeights();
      this.reorderQuestionBadges();
    }
  }

  reorderQuestionBadges() {
    const cards = document.querySelectorAll('#modal-questions-list .question-row-card');
    cards.forEach((card, idx) => {
      const newIdx = idx + 1;
      card.querySelector('.q-number-badge').innerText = newIdx;
      // Re-map attributes if needed, but simple index text keeps UI tidy
    });
  }

  // Sum weights live & update validation badge
  calculateFormWeights() {
    const weightInputs = document.querySelectorAll('#modal-questions-list .q-weight-input');
    let total = 0;
    weightInputs.forEach(input => {
      total += parseInt(input.value) || 0;
    });

    const totalText = document.getElementById('form-total-weight');
    const statusText = document.getElementById('weight-validation-status');
    
    totalText.innerText = total;

    if (total === 100) {
      totalText.style.color = 'var(--success)';
      statusText.innerHTML = '<span style="color:var(--success); font-weight:700;"><i data-lucide="check" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:4px;"></i>Bobot Sempurna (100)</span>';
    } else {
      totalText.style.color = 'var(--danger)';
      statusText.innerHTML = `<span style="color:var(--warning); font-weight:700;">Kurang/Lebih (${total - 100})! Target: 100</span>`;
    }
    lucide.createIcons();
  }

  // Bulk Generator button trigger
  bulkGenerateQuestions() {
    const countInput = document.getElementById('bulk-question-count');
    const num = parseInt(countInput.value);
    
    if (isNaN(num) || num <= 0) {
      alert('Masukkan jumlah butir soal yang valid!');
      return;
    }

    const container = document.getElementById('modal-questions-list');
    container.innerHTML = '';

    const defaultWeight = Math.round(100 / num);
    let cumulative = 0;

    for (let i = 1; i <= num; i++) {
      let weight = defaultWeight;
      cumulative += defaultWeight;
      
      // Handle rounding offset on last question
      if (i === num && cumulative !== 100) {
        weight = defaultWeight + (100 - cumulative);
      }

      this.addQuestionRowToModal(i, {
        type: 'PG',
        text: '',
        weight: weight,
        key: 'A'
      });
    }
    this.calculateFormWeights();
    countInput.value = '';
  }

  saveExam() {
    const examId = document.getElementById('form-exam-id').value;
    const name = document.getElementById('form-exam-name').value.trim();
    const subject = document.getElementById('form-exam-subject').value.trim();
    const className = document.getElementById('form-exam-class').value.trim();
    
    if (!name || !subject || !className) {
      alert('Semua kolom data ujian harus diisi!');
      return;
    }

    const cards = document.querySelectorAll('#modal-questions-list .question-row-card');
    if (cards.length === 0) {
      alert('Ujian harus memiliki minimal 1 butir soal!');
      return;
    }

    const questions = [];
    let weightSum = 0;
    let valid = true;

    cards.forEach((card, idx) => {
      const qIndex = idx + 1;
      const text = card.querySelector('.q-text-input').value.trim();
      const type = card.querySelector('.q-type-select').value;
      const weight = parseInt(card.querySelector('.q-weight-input').value) || 0;
      
      weightSum += weight;

      if (!text) {
        alert(`Soal nomor ${qIndex} tidak boleh kosong!`);
        valid = false;
        return;
      }

      // Collect key value
      let key = '';
      if (type === 'PG' || type === 'PGK') {
        const optionBtns = card.querySelectorAll('.option-btn.selected');
        if (type === 'PG') {
          key = optionBtns.length > 0 ? optionBtns[0].innerText : '';
        } else {
          key = Array.from(optionBtns).map(btn => btn.innerText);
        }
      } else if (type === 'BS') {
        const selectedBtn = card.querySelector('.bs-toggle-btn.selected');
        key = selectedBtn ? selectedBtn.innerText : '';
      } else if (type === 'ES') {
        key = card.querySelector('.q-key-input').value.trim();
      }

      if (type !== 'ES' && !key) {
        alert(`Harap tentukan kunci jawaban untuk soal nomor ${qIndex}!`);
        valid = false;
        return;
      }

      questions.push({
        id: `q-${examId || 'new'}-${Date.now()}-${qIndex}`,
        type,
        text,
        key,
        weight
      });
    });

    if (!valid) return;

    // Warning if weight is not 100, but allow saving (flexibility)
    if (weightSum !== 100) {
      const proceed = confirm(`Perhatian: Total bobot soal adalah ${weightSum}, disarankan bernilai 100. Apakah tetap ingin menyimpan?`);
      if (!proceed) return;
    }

    if (examId) {
      // Update
      const index = this.exams.findIndex(e => e.id === examId);
      if (index !== -1) {
        this.exams[index] = { ...this.exams[index], name, subject, className, questions };
        this.logActivity(`Memperbarui Ujian '${name}' (${subject})`);
      }
    } else {
      // Create
      const newExam = {
        id: `ex-${Date.now()}`,
        name,
        subject,
        className,
        questions
      };
      this.exams.push(newExam);
      this.logActivity(`Membuat Ujian Baru '${name}' (${subject})`);
    }

    this.showGlobalLoader('Menyimpan ujian...');
    DB.saveExam(examId ? this.exams.find(e=>e.id===examId) : this.exams[this.exams.length-1])
      .catch(err => this.showToast('Gagal simpan ujian: ' + err.message, 'error'))
      .finally(() => this.hideGlobalLoader());
    this.syncSubmissions();
    this.closeExamModal();
    this.renderExams();
  }

  duplicateExam(examId) {
    const original = this.exams.find(e => e.id === examId);
    if (!original) return;

    const copy = {
      ...original,
      id: `ex-dup-${Date.now()}`,
      name: `${original.name} (Salinan)`,
      // Deep copy questions
      questions: original.questions.map(q => ({
        ...q,
        id: `q-dup-${Date.now()}-${Math.floor(Math.random()*1000)}`
      }))
    };

    this.exams.push(copy);
    this.logActivity(`Menduplikasi ujian '${original.name}'`);
    DB.saveExam(copy).catch(err => this.showToast('Gagal duplikasi: ' + err.message, 'error'));
    this.syncSubmissions();
    this.renderExams();
  }

  deleteExam(examId) {
    const exam = this.exams.find(e => e.id === examId);
    if (!exam) return;

    const confirmDelete = confirm(`Apakah Anda yakin ingin menghapus ujian '${exam.name}'? Seluruh riwayat koreksi terkait ujian ini juga akan terhapus.`);
    if (confirmDelete) {
      this.exams = this.exams.filter(e => e.id !== examId);
      this.submissions = this.submissions.filter(s => s.examId !== examId);
      this.logActivity(`Menghapus Ujian '${exam.name}'`);
      DB.deleteExam(examId).catch(err => this.showToast('Gagal hapus ujian: ' + err.message, 'error'));
      DB.deleteSubmissionsByExam(examId).catch(console.error);
      this.renderExams();
    }
  }


  /* ==========================================================================
     STUDENTS CONTROLLER (DATA SISWA)
     ========================================================================== */
  renderStudents() {
    const searchVal = document.getElementById('search-student').value.toLowerCase();
    const tableBody = document.querySelector('#students-table tbody');
    tableBody.innerHTML = '';

    // Render group buttons
    const filterContainer = document.getElementById('student-class-filters');
    const classes = [...new Set(this.students.map(s => s.className))].sort();
    
    // Store selected filter inside class attribute or dataset
    const activeFilter = filterContainer.getAttribute('data-active') || 'Semua';
    
    let buttonsHtml = `<button class="btn ${activeFilter === 'Semua' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="app.filterStudentsByClass('Semua')">Semua Kelas</button>`;
    classes.forEach(c => {
      const isActive = activeFilter === c ? 'btn-primary' : 'btn-secondary';
      buttonsHtml += `<button class="btn ${isActive} btn-sm" onclick="app.filterStudentsByClass('${c}')">${c}</button>`;
    });
    filterContainer.innerHTML = buttonsHtml;

    // Filter list
    const filtered = this.students.filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchVal) || student.nisn.includes(searchVal);
      const matchesClass = activeFilter === 'Semua' || student.className === activeFilter;
      return matchesSearch && matchesClass;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding:2rem;">Tidak ada data siswa ditemukan.</td></tr>';
      return;
    }

    filtered.forEach(student => {
      tableBody.innerHTML += `
        <tr>
          <td style="font-weight:600; display:flex; align-items:center; gap:0.5rem;">
            <div class="teacher-avatar-wrapper" style="width:32px; height:32px; border-width:1px;">
              <img src="https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(student.name)}" class="teacher-avatar-img">
            </div>
            ${student.name}
          </td>
          <td style="font-family:monospace;">${student.nisn}</td>
          <td><span class="badge badge-success">${student.className}</span></td>
          <td><span class="badge badge-info">${student.major}</span></td>
          <td>
            <div style="display:flex; gap:0.4rem;">
              <button class="btn btn-secondary btn-icon-only btn-sm" onclick="app.openStudentModal('${student.id}')" title="Edit Siswa">
                <i data-lucide="edit" style="width:16px; height:16px; color:var(--primary);"></i>
              </button>
              <button class="btn btn-secondary btn-icon-only btn-sm" onclick="app.deleteStudent('${student.id}')" title="Hapus Siswa">
                <i data-lucide="trash-2" style="width:16px; height:16px; color:var(--danger);"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });
    lucide.createIcons();
  }

  filterStudentsByClass(cls) {
    const filterContainer = document.getElementById('student-class-filters');
    filterContainer.setAttribute('data-active', cls);
    this.renderStudents();
  }

  openStudentModal(studentId = '') {
    const modal = document.getElementById('student-modal');
    const title = document.getElementById('student-modal-title');
    const formId = document.getElementById('form-student-id');
    const formName = document.getElementById('form-student-name');
    const formNisn = document.getElementById('form-student-nisn');
    const formClass = document.getElementById('form-student-class');
    const formMajor = document.getElementById('form-student-major');

    if (studentId) {
      title.innerText = 'Edit Data Siswa';
      const student = this.students.find(s => s.id === studentId);
      formId.value = student.id;
      formName.value = student.name;
      formNisn.value = student.nisn;
      formClass.value = student.className;
      formMajor.value = student.major;
    } else {
      title.innerText = 'Tambah Siswa Baru';
      formId.value = '';
      formName.value = '';
      formNisn.value = '';
      formClass.value = '';
      formMajor.value = 'MIPA';
    }

    modal.classList.add('active');
  }

  closeStudentModal() {
    const modal = document.getElementById('student-modal');
    modal.classList.remove('active');
  }

  saveStudent() {
    const studentId = document.getElementById('form-student-id').value;
    const name = document.getElementById('form-student-name').value.trim();
    const nisn = document.getElementById('form-student-nisn').value.trim();
    const className = document.getElementById('form-student-class').value.trim();
    const major = document.getElementById('form-student-major').value;

    if (!name || !nisn || !className || !major) {
      alert('Semua kolom data siswa harus diisi!');
      return;
    }

    if (nisn.length !== 10 || isNaN(nisn)) {
      alert('NISN harus bernilai angka 10 digit!');
      return;
    }

    if (studentId) {
      // Update
      const index = this.students.findIndex(s => s.id === studentId);
      if (index !== -1) {
        this.students[index] = { id: studentId, name, nisn, className, major };
        this.logActivity(`Memperbarui data siswa '${name}'`);
      }
    } else {
      // Create
      const newStudent = {
        id: `std-${Date.now()}`,
        name,
        nisn,
        className,
        major
      };
      this.students.push(newStudent);
      this.logActivity(`Mendaftarkan siswa baru '${name}'`);
    }

    const studentToSave = studentId
      ? this.students.find(s => s.id === studentId)
      : this.students[this.students.length - 1];
    DB.saveStudent(studentToSave).catch(err => this.showToast('Gagal simpan siswa: ' + err.message, 'error'));
    this.syncSubmissions();
    this.closeStudentModal();
    this.renderStudents();
  }

  deleteStudent(studentId) {
    const student = this.students.find(s => s.id === studentId);
    if (!student) return;

    const confirmDelete = confirm(`Apakah Anda yakin ingin menghapus data siswa '${student.name}'? Seluruh rekap nilai terkait siswa ini juga akan dibersihkan.`);
    if (confirmDelete) {
      this.students = this.students.filter(s => s.id !== studentId);
      this.submissions = this.submissions.filter(sub => sub.studentId !== studentId);
      this.logActivity(`Menghapus data siswa '${student.name}'`);
      DB.deleteStudent(studentId).catch(err => this.showToast('Gagal hapus siswa: ' + err.message, 'error'));
      DB.deleteSubmissionsByStudent(studentId).catch(console.error);
      this.renderStudents();
    }
  }


  /* ==========================================================================
     KOREKSI ENGINE CONTROLLER (MAIN FEATURE)
     ========================================================================== */
  renderCorrections() {
    const examSelect = document.getElementById('koreksi-exam-select');
    const classSelect = document.getElementById('koreksi-class-select');
    const statusSelect = document.getElementById('koreksi-status-select');
    const tableBody = document.querySelector('#corrections-table tbody');
    tableBody.innerHTML = '';

    // Populate dropdown filters if not already set
    const selectedExam = examSelect.value;
    const selectedClass = classSelect.value;
    const selectedStatus = statusSelect.value;

    // Populate Exam Select
    let examOpts = '<option value="">-- Semua Ujian --</option>';
    this.exams.forEach(ex => {
      examOpts += `<option value="${ex.id}" ${selectedExam === ex.id ? 'selected' : ''}>${ex.name} (${ex.subject})</option>`;
    });
    examSelect.innerHTML = examOpts;

    // Populate Class Select
    const classes = [...new Set(this.students.map(s => s.className))].sort();
    let classOpts = '<option value="">-- Semua Kelas --</option>';
    classes.forEach(c => {
      classOpts += `<option value="${c}" ${selectedClass === c ? 'selected' : ''}>${c}</option>`;
    });
    classSelect.innerHTML = classOpts;

    // Filter logic
    const filtered = this.submissions.filter(sub => {
      const student = this.students.find(s => s.id === sub.studentId);
      const exam = this.exams.find(e => e.id === sub.examId);
      
      if (!student || !exam) return false;

      const matchExam = !selectedExam || sub.examId === selectedExam;
      const matchClass = !selectedClass || student.className === selectedClass;
      const matchStatus = !selectedStatus || sub.status === selectedStatus;

      return matchExam && matchClass && matchStatus;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">Tidak ada lembar jawaban ditemukan.</td></tr>';
      return;
    }

    filtered.forEach(sub => {
      const student = this.students.find(s => s.id === sub.studentId);
      const exam = this.exams.find(e => e.id === sub.examId);
      
      let statusBadge = '';
      if (sub.status === 'Selesai') {
        statusBadge = '<span class="badge badge-success">Selesai</span>';
      } else if (sub.status === 'Proses') {
        statusBadge = '<span class="badge badge-warning">Proses</span>';
      } else {
        statusBadge = '<span class="badge badge-danger">Belum</span>';
      }

      const scoreText = sub.status === 'Belum' ? '-' : `<strong>${sub.totalScore}</strong>`;

      tableBody.innerHTML += `
        <tr>
          <td style="font-weight:600;">${student.name}</td>
          <td><span class="badge badge-secondary">${student.className}</span></td>
          <td>
            <div style="display:flex; flex-direction:column;">
              <span style="font-weight:600; font-size:0.875rem;">${exam.name}</span>
              <span style="font-size:0.75rem; color:var(--text-muted);">${exam.subject}</span>
            </div>
          </td>
          <td>${statusBadge}</td>
          <td style="font-size:1.1rem; color:var(--primary);">${scoreText}</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="app.openCorrectionModal('${sub.id}')">
              <i data-lucide="check-square" style="width:14px; height:14px;"></i>Koreksi / Edit
            </button>
          </td>
        </tr>
      `;
    });
    lucide.createIcons();
  }

  // Opens the advanced double-panel correction screen
  openCorrectionModal(submissionId) {
    const submission = this.submissions.find(s => s.id === submissionId);
    if (!submission) return;

    const student = this.students.find(s => s.id === submission.studentId);
    const exam = this.exams.find(e => e.id === submission.examId);
    if (!student || !exam) return;

    // Header details
    document.getElementById('correction-modal-title').innerText = `Koreksi Ujian: ${student.name}`;
    document.getElementById('correction-modal-subtitle').innerText = `${exam.name} | Mata Pelajaran: ${exam.subject} | Kelas: ${student.className}`;
    
    // Status Select
    document.getElementById('correction-form-status').value = submission.status;

    // Store context for saving
    this.activeCorrectionSubId = submissionId;

    // Render Side-by-Side Analysis on left
    const qListContainer = document.getElementById('correction-questions-list');
    qListContainer.innerHTML = '';

    // Render direct answer inputs on right
    const editorsContainer = document.getElementById('correction-answer-editors');
    editorsContainer.innerHTML = '';

    // Perform real-time grade simulation to display initial suggestions
    const currentAnswers = { ...submission.answers };
    
    exam.questions.forEach((q, idx) => {
      const qNum = idx + 1;
      const studAns = currentAnswers[q.id];
      const correctKey = q.key;
      
      // Auto-grader suggestions
      let isCorrect = false;
      let calculatedScore = 0;
      let matchInfo = '';

      if (q.type === 'PG') {
        isCorrect = studAns === correctKey;
        calculatedScore = isCorrect ? q.weight : 0;
      } else if (q.type === 'PGK') {
        // PGK evaluation (Partial matching formula)
        const sKeys = Array.isArray(studAns) ? studAns : [];
        const cKeys = Array.isArray(correctKey) ? correctKey : [];
        
        // Exact match
        const exact = sKeys.length === cKeys.length && sKeys.every(k => cKeys.includes(k));
        if (exact) {
          calculatedScore = q.weight;
          isCorrect = true;
        } else {
          // Partial: correct choices - wrong choices
          const correctChosen = sKeys.filter(k => cKeys.includes(k)).length;
          const wrongChosen = sKeys.filter(k => !cKeys.includes(k)).length;
          const portion = cKeys.length > 0 ? (correctChosen - wrongChosen) / cKeys.length : 0;
          calculatedScore = Math.max(0, parseFloat((portion * q.weight).toFixed(1)));
          isCorrect = calculatedScore === q.weight;
        }
        matchInfo = `Cocok: ${sKeys.filter(k => cKeys.includes(k)).join(', ')}`;
      } else if (q.type === 'BS') {
        isCorrect = studAns === correctKey;
        calculatedScore = isCorrect ? q.weight : 0;
      } else if (q.type === 'ES') {
        // Essay key matches
        const tags = correctKey.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
        const textLower = (studAns || '').toLowerCase();
        let matches = [];
        
        if (tags.length > 0) {
          tags.forEach(tag => {
            if (textLower.includes(tag)) {
              matches.push(tag);
            }
          });
          // Recommended: matched / total
          const portion = matches.length / tags.length;
          calculatedScore = Math.round(portion * q.weight);
          matchInfo = matches.length > 0 
            ? `<div class="keyword-match-hint"><i data-lucide="check" style="width:12px; height:12px;"></i>Cocok Kata Kunci: ${matches.join(', ')} (${matches.length}/${tags.length})</div>`
            : '<div class="keyword-match-hint" style="color:var(--danger);"><i data-lucide="x" style="width:12px; height:12px;"></i>Tidak ada kata kunci cocok</div>';
        } else {
          calculatedScore = 0;
          matchInfo = '<div class="keyword-match-hint" style="color:var(--warning);">Tidak ada kata kunci yang diset guru.</div>';
        }
      }

      // If submission was already graded, load saved scores instead of auto-calculated
      const finalScore = (submission.status !== 'Belum' && submission.scores[q.id] !== undefined)
        ? submission.scores[q.id]
        : calculatedScore;

      // 1. Render Left panel card (Analysis & Score inputs)
      const isCorrectStyle = (q.type !== 'ES')
        ? (isCorrect ? 'border-color:var(--success);' : 'border-color:var(--danger);')
        : 'border-color:var(--border-color);';

      const statusBadge = (q.type !== 'ES')
        ? (isCorrect ? '<span class="badge badge-success">Benar</span>' : '<span class="badge badge-danger">Salah</span>')
        : '<span class="badge badge-info">Esai</span>';

      qListContainer.innerHTML += `
        <div class="question-correction-card" style="${isCorrectStyle}">
          <div class="correction-header-row">
            <span style="font-weight:700;">Soal ${qNum} (${q.type})</span>
            ${statusBadge}
          </div>
          
          <p style="font-size:0.9rem; margin-bottom:0.75rem; font-weight:500;">${q.text}</p>
          
          <div class="grading-compare">
            <div class="compare-block">
              <span class="compare-label">Kunci Jawaban</span>
              <span class="compare-value" style="color:var(--primary);">${Array.isArray(correctKey) ? correctKey.join(', ') : correctKey}</span>
            </div>
            <div class="compare-block">
              <span class="compare-label">Respon Siswa</span>
              <span class="compare-value">${Array.isArray(studAns) ? studAns.join(', ') : (studAns || '<em style="color:var(--danger);">Kosong</em>')}</span>
            </div>
          </div>
          
          ${matchInfo}
          
          <div class="flex-between mt-3">
            <span class="stat-label">Bobot Nilai: ${q.weight}</span>
            <div class="correction-score-input-wrapper">
              <label style="font-size:0.8rem; font-weight:700;">Nilai Korektor:</label>
              <input type="number" class="form-input q-correction-score" 
                     data-qid="${q.id}" 
                     data-max="${q.weight}" 
                     value="${finalScore}" 
                     min="0" max="${q.weight}" 
                     step="0.5"
                     oninput="app.recalculateCorrectionTotal()" 
                     style="width:70px; padding:0.3rem 0.5rem; text-align:center;">
              <span class="score-badge-max">/ ${q.weight}</span>
            </div>
          </div>
        </div>
      `;

      // 2. Render Right panel input editor (Allows correcting student input errors)
      let editorHtml = '';
      if (q.type === 'PG') {
        editorHtml = `
          <select class="form-input editor-input" data-qid="${q.id}" data-type="PG" onchange="app.handleAnswerEditChange('${q.id}')">
            <option value="" ${!studAns ? 'selected' : ''}>-- Kosong --</option>
            ${['A', 'B', 'C', 'D', 'E'].map(opt => `<option value="${opt}" ${studAns === opt ? 'selected' : ''}>Pilihan ${opt}</option>`).join('')}
          </select>
        `;
      } else if (q.type === 'PGK') {
        const sKeys = Array.isArray(studAns) ? studAns : [];
        editorHtml = `
          <div style="display:flex; gap:0.25rem;" class="editor-input-pgk-container" data-qid="${q.id}" data-type="PGK">
            ${['A', 'B', 'C', 'D', 'E'].map(opt => {
              const checked = sKeys.includes(opt) ? 'checked' : '';
              return `
                <label style="font-size:0.8rem; display:flex; align-items:center; gap:0.2rem; cursor:pointer; background:var(--bg-base); padding:0.25rem 0.5rem; border-radius:4px; border:1px solid var(--border-color);">
                  <input type="checkbox" value="${opt}" ${checked} onchange="app.handleAnswerEditChange('${q.id}')"> ${opt}
                </label>
              `;
            }).join('')}
          </div>
        `;
      } else if (q.type === 'BS') {
        editorHtml = `
          <select class="form-input editor-input" data-qid="${q.id}" data-type="BS" onchange="app.handleAnswerEditChange('${q.id}')">
            <option value="" ${!studAns ? 'selected' : ''}>-- Kosong --</option>
            <option value="Benar" ${studAns === 'Benar' ? 'selected' : ''}>BENAR</option>
            <option value="Salah" ${studAns === 'Salah' ? 'selected' : ''}>SALAH</option>
          </select>
        `;
      } else if (q.type === 'ES') {
        editorHtml = `
          <textarea class="form-input editor-input" data-qid="${q.id}" data-type="ES" rows="2" style="font-size:0.85rem;" oninput="app.handleAnswerEditChange('${q.id}')">${studAns || ''}</textarea>
        `;
      }

      editorsContainer.innerHTML += `
        <div style="display:flex; flex-direction:column; gap:0.25rem;">
          <span style="font-size:0.75rem; font-weight:700;">Soal ${qNum} (${q.type}):</span>
          ${editorHtml}
        </div>
      `;
    });

    this.recalculateCorrectionTotal();
    document.getElementById('correction-modal').classList.add('active');
    lucide.createIcons();
  }

  closeCorrectionModal() {
    document.getElementById('correction-modal').classList.remove('active');
    this.activeCorrectionSubId = null;
    this.renderCorrections();
  }

  // Recalculates total score dynamically as the corrector changes individual grades
  recalculateCorrectionTotal() {
    const inputs = document.querySelectorAll('.q-correction-score');
    let total = 0;
    let correctCount = 0;
    let wrongCount = 0;
    const totalQuestions = inputs.length;

    inputs.forEach(input => {
      const val = parseFloat(input.value) || 0;
      const max = parseFloat(input.getAttribute('data-max')) || 0;
      total += val;
      
      if (val === max) {
        correctCount++;
      } else {
        wrongCount++;
      }
    });

    // Score rounded to 1 decimal place
    total = parseFloat(total.toFixed(1));
    
    document.getElementById('correction-summary-total').innerText = total;
    document.getElementById('correction-summary-count').innerText = `${totalQuestions} Soal`;
    document.getElementById('correction-summary-correct').innerText = `${correctCount} Benar`;
    document.getElementById('correction-summary-wrong').innerText = `${wrongCount} Salah/Esai`;
  }

  // Listens to edits inside the "Perbaiki Jawaban Siswa Yang Keliru" section
  // It instantly updates the analysis view and recalculates values
  handleAnswerEditChange(qid) {
    // 1. Gather all values from editor panels
    const sub = this.submissions.find(s => s.id === this.activeCorrectionSubId);
    if (!sub) return;

    const exam = this.exams.find(e => e.id === sub.examId);
    const question = exam.questions.find(q => q.id === qid);

    // Grab the specific input element
    let newVal = '';
    const pgInput = document.querySelector(`.editor-input[data-qid="${qid}"][data-type="PG"]`);
    const bsInput = document.querySelector(`.editor-input[data-qid="${qid}"][data-type="BS"]`);
    const esInput = document.querySelector(`.editor-input[data-qid="${qid}"][data-type="ES"]`);
    const pgkContainer = document.querySelector(`.editor-input-pgk-container[data-qid="${qid}"]`);

    if (pgInput) {
      newVal = pgInput.value;
    } else if (bsInput) {
      newVal = bsInput.value;
    } else if (esInput) {
      newVal = esInput.value;
    } else if (pgkContainer) {
      const checked = pgkContainer.querySelectorAll('input:checked');
      newVal = Array.from(checked).map(c => c.value);
    }

    // Update temporarily inside sub object memory
    sub.answers[qid] = newVal;

    // 2. Re-trigger the analysis layout generation for this question without losing inputs
    // For simplicity, we temporarily fetch the scores card matching this qid, and update the details
    const cards = document.querySelectorAll('.question-correction-card');
    const qIndex = exam.questions.findIndex(q => q.id === qid);
    if (qIndex === -1) return;

    const card = cards[qIndex];
    const correctKey = question.key;

    // Recalculate auto suggestion
    let isCorrect = false;
    let calculatedScore = 0;
    let matchInfoHtml = '';

    if (question.type === 'PG') {
      isCorrect = newVal === correctKey;
      calculatedScore = isCorrect ? question.weight : 0;
    } else if (question.type === 'PGK') {
      const sKeys = Array.isArray(newVal) ? newVal : [];
      const cKeys = Array.isArray(correctKey) ? correctKey : [];
      const exact = sKeys.length === cKeys.length && sKeys.every(k => cKeys.includes(k));
      if (exact) {
        calculatedScore = question.weight;
        isCorrect = true;
      } else {
        const correctChosen = sKeys.filter(k => cKeys.includes(k)).length;
        const wrongChosen = sKeys.filter(k => !cKeys.includes(k)).length;
        const portion = cKeys.length > 0 ? (correctChosen - wrongChosen) / cKeys.length : 0;
        calculatedScore = Math.max(0, parseFloat((portion * question.weight).toFixed(1)));
        isCorrect = calculatedScore === question.weight;
      }
      matchInfoHtml = `Cocok: ${sKeys.filter(k => cKeys.includes(k)).join(', ')}`;
    } else if (question.type === 'BS') {
      isCorrect = newVal === correctKey;
      calculatedScore = isCorrect ? question.weight : 0;
    } else if (question.type === 'ES') {
      const tags = correctKey.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
      const textLower = (newVal || '').toLowerCase();
      let matches = [];
      if (tags.length > 0) {
        tags.forEach(tag => {
          if (textLower.includes(tag)) matches.push(tag);
        });
        calculatedScore = Math.round((matches.length / tags.length) * question.weight);
        matchInfoHtml = matches.length > 0 
          ? `<div class="keyword-match-hint"><i data-lucide="check" style="width:12px; height:12px;"></i>Cocok Kata Kunci: ${matches.join(', ')} (${matches.length}/${tags.length})</div>`
          : '<div class="keyword-match-hint" style="color:var(--danger);"><i data-lucide="x" style="width:12px; height:12px;"></i>Tidak ada kata kunci cocok</div>';
      }
    }

    // Update Card UI
    const badgeContainer = card.querySelector('.badge');
    badgeContainer.className = 'badge ' + (question.type === 'ES' ? 'badge-info' : (isCorrect ? 'badge-success' : 'badge-danger'));
    badgeContainer.innerText = question.type === 'ES' ? 'Esai' : (isCorrect ? 'Benar' : 'Salah');

    card.querySelector('.compare-value:nth-child(2)').innerText = Array.isArray(newVal) ? newVal.join(', ') : (newVal || 'Kosong');
    
    // Update key matching display if exists
    const matchHint = card.querySelector('.keyword-match-hint');
    if (matchHint) {
      matchHint.outerHTML = matchInfoHtml || '<div class="keyword-match-hint"></div>';
    } else if (matchInfoHtml) {
      // Inject after compare block
      card.querySelector('.grading-compare').insertAdjacentHTML('afterend', matchInfoHtml);
    }

    // Set score input
    const scoreInput = card.querySelector('.q-correction-score');
    scoreInput.value = calculatedScore;

    card.style.borderColor = (question.type !== 'ES') ? (isCorrect ? 'var(--success)' : 'var(--danger)') : 'var(--border-color)';
    
    this.recalculateCorrectionTotal();
    lucide.createIcons();
  }

  saveCorrection() {
    const sub = this.submissions.find(s => s.id === this.activeCorrectionSubId);
    if (!sub) return;

    const student = this.students.find(s => s.id === sub.studentId);
    const exam = this.exams.find(e => e.id === sub.examId);

    // Collect score inputs
    const scoreInputs = document.querySelectorAll('.q-correction-score');
    const scores = {};
    let totalScore = 0;

    scoreInputs.forEach(input => {
      const qid = input.getAttribute('data-qid');
      const val = parseFloat(input.value) || 0;
      scores[qid] = val;
      totalScore += val;
    });

    totalScore = parseFloat(totalScore.toFixed(1));

    // Get status
    const status = document.getElementById('correction-form-status').value;

    // Apply updates to original state
    sub.scores = scores;
    sub.totalScore = totalScore;
    sub.status = status;
    sub.gradedAt = new Date().toISOString();

    this.logActivity(`Koreksi Lembar ${student.name} (${exam.name}) - Nilai: ${totalScore}`);
    this.showGlobalLoader('Menyimpan hasil koreksi...');
    DB.saveSubmission(sub)
      .then(() => this.showToast('Hasil koreksi tersimpan!', 'success'))
      .catch(err => this.showToast('Gagal simpan koreksi: ' + err.message, 'error'))
      .finally(() => this.hideGlobalLoader());
    this.closeCorrectionModal();
    this.renderCorrections();
  }


  /* ==========================================================================
     EXPORT CONTROLLER (EKSPORT VIEW)
     ========================================================================== */
  renderExport() {
    // 1. Populate Class select
    const classSelect = document.getElementById('export-class-select');
    const classes = [...new Set(this.students.map(s => s.className))].sort();
    
    const prevClass = classSelect.value;
    let classOpts = '<option value="">-- Pilih Kelas --</option>';
    classes.forEach(c => {
      classOpts += `<option value="${c}" ${prevClass === c ? 'selected' : ''}>${c}</option>`;
    });
    classSelect.innerHTML = classOpts;

    // 2. Populate subject list checkboxes
    const subContainer = document.getElementById('export-subject-checkboxes');
    const subjects = [...new Set(this.exams.map(e => e.subject))].sort();
    subContainer.innerHTML = '';
    
    if (subjects.length === 0) {
      subContainer.innerHTML = '<span class="text-muted" style="font-size:0.85rem;">Belum ada data mata pelajaran.</span>';
    } else {
      subjects.forEach(sub => {
        subContainer.innerHTML += `
          <label style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem; cursor:pointer; font-size:0.9rem;">
            <input type="checkbox" class="export-subject-cb" value="${sub}" checked>
            <span>${sub}</span>
          </label>
        `;
      });
    }

    // 3. Populate student dropdown for PDF report card
    const studentSelect = document.getElementById('export-pdf-student-select');
    const prevStud = studentSelect.value;
    let studOpts = '<option value="">-- Pilih Siswa --</option>';
    this.students.sort((a,b) => a.name.localeCompare(b.name)).forEach(s => {
      studOpts += `<option value="${s.id}" ${prevStud === s.id ? 'selected' : ''}>${s.name} (${s.className})</option>`;
    });
    studentSelect.innerHTML = studOpts;

    // 4. Populate exam select for WA Berita Acara
    const waExamSelect = document.getElementById('export-wa-exam-select');
    const prevWaExam = waExamSelect.value;
    let waExamOpts = '<option value="">-- Pilih Ujian --</option>';
    this.exams.forEach(ex => {
      waExamOpts += `<option value="${ex.id}" ${prevWaExam === ex.id ? 'selected' : ''}>${ex.name} (${ex.subject} - ${ex.className})</option>`;
    });
    waExamSelect.innerHTML = waExamOpts;

    // Trigger initial WA text preview
    this.updateWAPreviewText();
  }

  updateWAPreviewText() {
    const select = document.getElementById('export-wa-exam-select');
    const preview = document.getElementById('wa-preview-text');
    const examId = select.value;

    if (!examId) {
      preview.value = "Pilih salah satu ujian terlebih dahulu untuk melihat pratinjau Berita Acara.";
      return;
    }

    const exam = this.exams.find(e => e.id === examId);
    if (!exam) return;

    // Gather metrics for WhatsApp Text
    const classStudents = this.students.filter(s => s.className === exam.className);
    const examSubmissions = this.submissions.filter(s => s.examId === exam.id);
    const completed = examSubmissions.filter(s => s.status === 'Selesai');
    
    let avgScore = 0;
    let maxScore = 0;
    let minScore = 100;
    let passCount = 0; // KKM is 70 by default

    if (completed.length > 0) {
      const sum = completed.reduce((acc, s) => acc + s.totalScore, 0);
      avgScore = (sum / completed.length).toFixed(1);
      
      const scoresList = completed.map(s => s.totalScore);
      maxScore = Math.max(...scoresList);
      minScore = Math.min(...scoresList);
      passCount = completed.filter(s => s.totalScore >= 70).length;
    } else {
      minScore = 0;
    }

    const passRate = completed.length > 0 ? Math.round((passCount / completed.length) * 100) : 0;

    const dateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const msg = `*BERITA ACARA HASIL EVALUASI UJIAN*
----------------------------------------
*Sekolah:* ${this.profile.school}
*Tahun Ajaran:* ${this.profile.academicYear}
*Guru Pengampu:* ${this.profile.name} (NIP: ${this.profile.nip})

*Detail Pelaksanaan:*
- Nama Ujian: ${exam.name}
- Mata Pelajaran: ${exam.subject}
- Kelas Sasaran: ${exam.className}
- Tanggal Laporan: ${dateStr}

*Ringkasan Statistik Kelas:*
- Jumlah Peserta Terdaftar: ${classStudents.length} Siswa
- Sudah Dikoreksi: ${completed.length} Siswa
- Rata-rata Nilai: ${avgScore}
- Nilai Tertinggi: ${maxScore}
- Nilai Terendah: ${minScore}
- Kelulusan (KKM >= 70): ${passCount} dari ${completed.length} Siswa (${passRate}%)

Catatan: Laporan ini dibuat otomatis secara resmi oleh sistem *KoreksiSoal*. Terima kasih.`;

    preview.value = msg;
  }

  copyWAText() {
    const text = document.getElementById('wa-preview-text').value;
    if (!text || text.startsWith("Pilih salah satu")) {
      alert("Pratinjau kosong, pilih ujian terlebih dahulu.");
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      alert("Teks Berita Acara berhasil disalin ke clipboard! Silakan paste langsung ke WhatsApp.");
      this.logActivity(`Menyalin berita acara WhatsApp ke clipboard`);
    }).catch(err => {
      console.error("Gagal menyalin: ", err);
    });
  }

  sendWA() {
    const text = document.getElementById('wa-preview-text').value;
    if (!text || text.startsWith("Pilih salah satu")) {
      alert("Pratinjau kosong, pilih ujian terlebih dahulu.");
      return;
    }

    this.logActivity(`Mengirim berita acara WhatsApp ke server API WA`);
    const encoded = encodeURIComponent(text);
    const url = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  }

  // Exports multiple subjects and a class rekap into spreadsheet
  exportExcel() {
    const classVal = document.getElementById('export-class-select').value;
    if (!classVal) {
      alert('Harap pilih kelas sasaran ekspor!');
      return;
    }

    // Get checked subjects
    const checkedBoxes = document.querySelectorAll('.export-subject-cb:checked');
    const selectedSubjects = Array.from(checkedBoxes).map(cb => cb.value);

    if (selectedSubjects.length === 0) {
      alert('Harap centang minimal satu mata pelajaran!');
      return;
    }

    // Get students in this class
    const classStudents = this.students.filter(s => s.className === classVal).sort((a,b) => a.name.localeCompare(b.name));
    if (classStudents.length === 0) {
      alert('Tidak ada siswa di kelas tersebut.');
      return;
    }

    // Build Excel headers dynamically based on selected subjects
    // For each subject, find all exams for this class. 
    // Format column headers: e.g. "Matematika - UTS", "PJOK - Harian 1", etc.
    const columns = ['NISN', 'Nama Siswa', 'Kelas'];
    const examMap = []; // references to exams that are columns

    selectedSubjects.forEach(sub => {
      const subExams = this.exams.filter(e => e.className === classVal && e.subject === sub);
      subExams.forEach(ex => {
        columns.push(`${ex.subject} - ${ex.name}`);
        examMap.push(ex);
      });
    });

    columns.push('Rata-Rata Akhir');

    // Build JSON rows
    const excelRows = classStudents.map(student => {
      const rowData = {
        'NISN': student.nisn,
        'Nama Siswa': student.name,
        'Kelas': student.className
      };

      let scoresSum = 0;
      let scoredExamsCount = 0;

      examMap.forEach(ex => {
        const key = `${ex.subject} - ${ex.name}`;
        // Find submission
        const sub = this.submissions.find(s => s.examId === ex.id && s.studentId === student.id);
        if (sub && sub.status === 'Selesai') {
          rowData[key] = sub.totalScore;
          scoresSum += sub.totalScore;
          scoredExamsCount++;
        } else {
          rowData[key] = '-'; // Not finished/not submitted
        }
      });

      rowData['Rata-Rata Akhir'] = scoredExamsCount > 0 ? parseFloat((scoresSum / scoredExamsCount).toFixed(1)) : '-';
      return rowData;
    });

    // Generate SheetJS structures
    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Rekap Nilai ${classVal}`);

    // Trigger download
    XLSX.writeFile(workbook, `Rekap_Nilai_${classVal}_(${new Date().toLocaleDateString('id-ID')}).xlsx`);
    this.logActivity(`Mengekspor rekap nilai kelas ${classVal} ke format Excel`);
  }

  // Generates and downloads the PDF report card layout
  exportPDF() {
    const studentId = document.getElementById('export-pdf-student-select').value;
    if (!studentId) {
      alert('Harap pilih siswa untuk cetak PDF Raport!');
      return;
    }

    const student = this.students.find(s => s.id === studentId);
    if (!student) return;

    // Populates printing targets
    document.getElementById('pdf-school-header').innerText = this.profile.school.toUpperCase();
    document.getElementById('pdf-student-name').innerText = student.name;
    document.getElementById('pdf-student-nisn').innerText = student.nisn;
    document.getElementById('pdf-student-class').innerText = `${student.className} / ${student.major}`;
    document.getElementById('pdf-academic-year').innerText = this.profile.academicYear;
    document.getElementById('pdf-teacher-name').innerText = this.profile.name;
    document.getElementById('pdf-teacher-nip').innerText = this.profile.nip;

    document.getElementById('pdf-teacher-signature').innerText = this.profile.name;
    document.getElementById('pdf-teacher-signature-nip').innerText = `NIP: ${this.profile.nip}`;

    // Get current date
    const dateOpts = { day: 'numeric', month: 'long', year: 'numeric' };
    const dateFormatted = new Date().toLocaleDateString('id-ID', dateOpts);
    document.getElementById('pdf-date-location').innerHTML = `Jakarta, ${dateFormatted}<br>Guru Mata Pelajaran`;

    // Fetch grades rows
    const tbody = document.getElementById('pdf-grades-tbody');
    tbody.innerHTML = '';

    // Find all exams matching the student's class
    const studentExams = this.exams.filter(e => e.className === student.className);
    
    if (studentExams.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="border: 1px solid black; padding: 10px; text-align: center; font-style:italic;">Belum ada pelaksanaan ujian untuk kelas siswa ini.</td></tr>';
    } else {
      studentExams.forEach((ex, idx) => {
        const sub = this.submissions.find(s => s.examId === ex.id && s.studentId === student.id);
        const score = (sub && sub.status === 'Selesai') ? sub.totalScore : '-';
        
        let predikat = '-';
        if (score !== '-') {
          if (score >= 90) predikat = 'Sangat Baik (A)';
          else if (score >= 80) predikat = 'Baik (B)';
          else if (score >= 70) predikat = 'Cukup (C)';
          else predikat = 'Perlu Bimbingan (D)';
        }

        tbody.innerHTML += `
          <tr>
            <td style="border: 1px solid black; padding: 8px; text-align: center;">${idx + 1}</td>
            <td style="border: 1px solid black; padding: 8px; font-weight: bold;">${ex.subject}</td>
            <td style="border: 1px solid black; padding: 8px;">${ex.name}</td>
            <td style="border: 1px solid black; padding: 8px; text-align: center; font-weight: bold; font-size: 1.1rem; color: black;">${score}</td>
            <td style="border: 1px solid black; padding: 8px; text-align: center;">${predikat}</td>
          </tr>
        `;
      });
    }

    // Trigger html2pdf configuration
    const element = document.getElementById('report-card-printout');
    const opt = {
      margin:       10,
      filename:     `Raport_Nilai_${student.name.replace(/\s+/g, '_')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Temporarily make it visible for html2pdf renderer
    element.style.display = 'block';

    html2pdf().set(opt).from(element).save().then(() => {
      element.style.display = 'none'; // hide it back
      this.logActivity(`Mengekspor PDF Raport Nilai siswa '${student.name}'`);
    }).catch(err => {
      console.error(err);
      element.style.display = 'none';
      alert('Gagal menghasilkan PDF!');
    });
  }


  /* ==========================================================================
     SETTINGS & PROFILE CONTROLLER
     ========================================================================== */
  renderSettings() {
    document.getElementById('setting-name').value = this.profile.name;
    document.getElementById('setting-nip').value = this.profile.nip;
    document.getElementById('setting-school').value = this.profile.school;
    document.getElementById('setting-year').value = this.profile.academicYear;

    // Load avatar previews
    const grid = document.getElementById('avatar-grid-container');
    grid.innerHTML = '';

    Object.keys(this.defaultAvatars).forEach(avKey => {
      const isSelected = this.profile.avatar === avKey && !this.profile.customPhoto ? 'selected' : '';
      grid.innerHTML += `
        <div class="avatar-item ${isSelected}" data-avatar="${avKey}" onclick="app.selectSettingsAvatar('${avKey}')">
          <img src="${this.defaultAvatars[avKey]}">
        </div>
      `;
    });

    this.updateSettingAvatarPreview();
  }

  updateSettingAvatarPreview() {
    const preview = document.getElementById('setting-avatar-preview');
    const resetBtn = document.getElementById('btn-reset-photo');

    if (this.profile.customPhoto) {
      preview.src = this.profile.customPhoto;
      resetBtn.style.display = 'block';
    } else {
      preview.src = this.defaultAvatars[this.profile.avatar] || this.defaultAvatars['avatar-1'];
      resetBtn.style.display = 'none';
    }
  }

  selectSettingsAvatar(avKey) {
    this.profile.avatar = avKey;
    this.profile.customPhoto = ''; // Clear custom photo if user selects built-in
    
    document.querySelectorAll('.avatar-item').forEach(item => {
      if (item.getAttribute('data-avatar') === avKey) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });

    this.updateSettingAvatarPreview();
  }

  uploadCustomPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert('Ukuran foto terlalu besar! Maksimal size adalah 1MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.profile.customPhoto = e.target.result;
      this.updateSettingAvatarPreview();
      // Remove selected border from avatar gallery items
      document.querySelectorAll('.avatar-item').forEach(item => item.classList.remove('selected'));
    };
    reader.readAsDataURL(file);
  }

  resetCustomPhoto() {
    this.profile.customPhoto = '';
    this.profile.avatar = 'avatar-1';
    this.renderSettings();
  }

  saveProfile(event) {
    event.preventDefault();

    const name = document.getElementById('setting-name').value.trim();
    const nip = document.getElementById('setting-nip').value.trim();
    const school = document.getElementById('setting-school').value.trim();
    const academicYear = document.getElementById('setting-year').value.trim();

    if (!name || !nip || !school || !academicYear) {
      alert('Semua kolom profil harus diisi!');
      return;
    }

    this.profile.name = name;
    this.profile.nip = nip;
    this.profile.school = school;
    this.profile.academicYear = academicYear;

    this.saveState();
    DB.saveProfile(this.profile).then(() => {
      this.showToast('Profil berhasil disimpan!', 'success');
    }).catch(err => this.showToast('Gagal simpan profil: ' + err.message, 'error'));
    this.logActivity('Mengupdate detail profil guru');
    this.renderHeaderProfile();
  }

  changeAccentTheme(themeName) {
    this.activeTheme = themeName;
    DB.saveTheme(themeName);
    this.applyTheme();
  }

  toggleDarkMode() {
    this.darkMode = !this.darkMode;
    DB.saveDarkMode(this.darkMode);
    this.applyTheme();
  }


  /* ==========================================================================
     GLOBAL EVENTS WIRE-UP
     ========================================================================== */
  setupEventListeners() {
    // 1. Navigation clicks
    document.querySelectorAll('[data-target]').forEach(elem => {
      elem.addEventListener('click', (e) => {
        const view = elem.getAttribute('data-target');
        if (view) this.switchView(view);
      });
    });

    // 2. Dark mode header button toggle
    const toggleDmHeader = document.getElementById('toggle-dark-mode');
    if (toggleDmHeader) {
      toggleDmHeader.addEventListener('click', () => this.toggleDarkMode());
    }

    // 3. Setting View dark mode toggle
    const toggleDmSettings = document.getElementById('setting-toggle-dark-mode');
    if (toggleDmSettings) {
      toggleDmSettings.addEventListener('click', () => this.toggleDarkMode());
    }

    // 4. Accent theme color clicks
    const themePicker = document.getElementById('theme-picker-container');
    if (themePicker) {
      themePicker.querySelectorAll('.theme-dot').forEach(dot => {
        dot.addEventListener('click', () => {
          const t = dot.getAttribute('data-theme');
          this.changeAccentTheme(t);
        });
      });
    }

    // 5. Exam Modal clicks
    const btnAddExam = document.getElementById('add-exam-btn');
    if (btnAddExam) btnAddExam.addEventListener('click', () => this.openExamModal());

    const btnCloseExam = document.getElementById('close-exam-modal');
    if (btnCloseExam) btnCloseExam.addEventListener('click', () => this.closeExamModal());

    const btnCancelExam = document.getElementById('cancel-exam-modal');
    if (btnCancelExam) btnCancelExam.addEventListener('click', () => this.closeExamModal());

    const btnSaveExam = document.getElementById('save-exam-btn');
    if (btnSaveExam) btnSaveExam.addEventListener('click', () => this.saveExam());

    const btnBulkGen = document.getElementById('btn-bulk-generate-questions');
    if (btnBulkGen) btnBulkGen.addEventListener('click', () => this.bulkGenerateQuestions());

    // Search exams input
    const inputSearchExam = document.getElementById('search-exam');
    if (inputSearchExam) {
      inputSearchExam.addEventListener('input', () => this.renderExams());
    }

    // 6. Student Modal clicks
    const btnAddStudent = document.getElementById('add-student-btn');
    if (btnAddStudent) btnAddStudent.addEventListener('click', () => this.openStudentModal());

    const btnCloseStudent = document.getElementById('close-student-modal');
    if (btnCloseStudent) btnCloseStudent.addEventListener('click', () => this.closeStudentModal());

    const btnCancelStudent = document.getElementById('cancel-student-modal');
    if (btnCancelStudent) btnCancelStudent.addEventListener('click', () => this.closeStudentModal());

    const btnSaveStudent = document.getElementById('save-student-btn');
    if (btnSaveStudent) btnSaveStudent.addEventListener('click', () => this.saveStudent());

    // Search students input
    const inputSearchStudent = document.getElementById('search-student');
    if (inputSearchStudent) {
      inputSearchStudent.addEventListener('input', () => this.renderStudents());
    }

    // 7. Correction Modal clicks
    const btnCloseCorrection = document.getElementById('close-correction-modal');
    if (btnCloseCorrection) btnCloseCorrection.addEventListener('click', () => this.closeCorrectionModal());

    const btnCancelCorrection = document.getElementById('cancel-correction-modal');
    if (btnCancelCorrection) btnCancelCorrection.addEventListener('click', () => this.closeCorrectionModal());

    const btnSaveCorrection = document.getElementById('save-correction-btn');
    if (btnSaveCorrection) btnSaveCorrection.addEventListener('click', () => this.saveCorrection());

    // Correction filters change
    const correctionFilters = ['koreksi-exam-select', 'koreksi-class-select', 'koreksi-status-select'];
    correctionFilters.forEach(fid => {
      const elem = document.getElementById(fid);
      if (elem) elem.addEventListener('change', () => this.renderCorrections());
    });

    // 8. Export Clicks & Previews
    const waExamSelect = document.getElementById('export-wa-exam-select');
    if (waExamSelect) waExamSelect.addEventListener('change', () => this.updateWAPreviewText());

    const btnCopyWa = document.getElementById('btn-copy-wa');
    if (btnCopyWa) btnCopyWa.addEventListener('click', () => this.copyWAText());

    const btnSendWa = document.getElementById('btn-send-wa');
    if (btnSendWa) btnSendWa.addEventListener('click', () => this.sendWA());

    const btnExportExcel = document.getElementById('btn-export-excel');
    if (btnExportExcel) btnExportExcel.addEventListener('click', () => this.exportExcel());

    const btnExportPdf = document.getElementById('btn-export-pdf');
    if (btnExportPdf) btnExportPdf.addEventListener('click', () => this.exportPDF());

    // 9. Profile Upload files
    const uploadPhoto = document.getElementById('setting-upload-photo');
    if (uploadPhoto) {
      uploadPhoto.addEventListener('change', (e) => this.uploadCustomPhoto(e));
    }

    const btnResetPhoto = document.getElementById('btn-reset-photo');
    if (btnResetPhoto) {
      btnResetPhoto.addEventListener('click', () => this.resetCustomPhoto());
    }

    const formProfile = document.getElementById('profile-form');
    if (formProfile) {
      formProfile.addEventListener('submit', (e) => this.saveProfile(e));
    }
  }
}

// Instantiate and Boot App on DOM Load
const app = new KoreksiSoalApp();
document.addEventListener('DOMContentLoaded', () => {
  app.init();  // async — handles DB init, login check, and data loading
});
