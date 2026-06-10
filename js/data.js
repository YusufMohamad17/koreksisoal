const DEFAULT_PROFILE = {
  name: "Budi Santoso, S.Pd.",
  nip: "19900512 201503 1 002",
  school: "SMA Negeri 1 Jakarta",
  academicYear: "2025/2026",
  avatar: "avatar-1", // Predefined avatar
  customPhoto: "" // Base64 if uploaded
};

const DEFAULT_STUDENTS = [
  // Class XI-MIPA-1
  { id: "std-1", name: "Ahmad Fauzi", nisn: "0082910401", className: "XI-MIPA-1", major: "MIPA" },
  { id: "std-2", name: "Bella Citra", nisn: "0082910402", className: "XI-MIPA-1", major: "MIPA" },
  { id: "std-3", name: "Candra Wijaya", nisn: "0082910403", className: "XI-MIPA-1", major: "MIPA" },
  { id: "std-4", name: "Dina Lestari", nisn: "0082910404", className: "XI-MIPA-1", major: "MIPA" },
  { id: "std-5", name: "Eko Prasetyo", nisn: "0082910405", className: "XI-MIPA-1", major: "MIPA" },

  // Class XI-MIPA-2
  { id: "std-6", name: "Farah Nabila", nisn: "0082910406", className: "XI-MIPA-2", major: "MIPA" },
  { id: "std-7", name: "Galih Saputra", nisn: "0082910407", className: "XI-MIPA-2", major: "MIPA" },
  { id: "std-8", name: "Hana Safitri", nisn: "0082910408", className: "XI-MIPA-2", major: "MIPA" },
  { id: "std-9", name: "Indra Wijaya", nisn: "0082910409", className: "XI-MIPA-2", major: "MIPA" },
  { id: "std-10", name: "Jasmine Putri", nisn: "0082910410", className: "XI-MIPA-2", major: "MIPA" },

  // Class XI-IPS-1
  { id: "std-11", name: "Kevin Sanjaya", nisn: "0082910411", className: "XI-IPS-1", major: "IPS" },
  { id: "std-12", name: "Larasati", nisn: "0082910412", className: "XI-IPS-1", major: "IPS" },
  { id: "std-13", name: "Muhammad Rizky", nisn: "0082910413", className: "XI-IPS-1", major: "IPS" },
  { id: "std-14", name: "Nadia Utami", nisn: "0082910414", className: "XI-IPS-1", major: "IPS" },
  { id: "std-15", name: "Oki Setiawan", nisn: "0082910415", className: "XI-IPS-1", major: "IPS" }
];

const DEFAULT_EXAMS = [
  {
    id: "ex-1",
    name: "Penilaian Harian Kebugaran Jasmani",
    subject: "PJOK",
    className: "XI-MIPA-1",
    questions: [
      { id: "q-1-1", type: "PG", text: "Apa komponen utama daya tahan kardiorespirasi?", key: "A", weight: 20 },
      { id: "q-1-2", type: "PG", text: "Latihan push-up bertujuan melatih kekuatan otot apa?", key: "C", weight: 20 },
      { id: "q-1-3", type: "PGK", text: "Manakah yang termasuk latihan kelenturan? (Pilih semua yang benar)", key: ["B", "D"], weight: 20 },
      { id: "q-1-4", type: "BS", text: "Denyut nadi maksimal dihitung dengan rumus 220 dikurangi usia.", key: "Benar", weight: 20 },
      { id: "q-1-5", type: "ES", text: "Jelaskan pentingnya melakukan pemanasan sebelum berolahraga!", key: "cedera, otot, siap, aliran darah", weight: 20 }
    ]
  },
  {
    id: "ex-2",
    name: "Ujian Harian Fisika - Dinamika Gerak",
    subject: "IPA",
    className: "XI-MIPA-2",
    questions: [
      { id: "q-2-1", type: "PG", text: "Bunyi Hukum Newton II berhubungan dengan hubungan antara gaya, massa, dan...?", key: "B", weight: 25 },
      { id: "q-2-2", type: "BS", text: "Gaya gesek selalu searah dengan arah kecenderungan gerak benda.", key: "Salah", weight: 25 },
      { id: "q-2-3", type: "PGK", text: "Faktor apa saja yang memengaruhi besarnya gaya gravitasi antara dua benda?", key: ["A", "C"], weight: 25 },
      { id: "q-2-4", type: "ES", text: "Sebutkan dan jelaskan penerapan Hukum Newton III dalam kehidupan sehari-hari!", key: "aksi, reaksi, dayung, roket, dorong", weight: 25 }
    ]
  },
  {
    id: "ex-3",
    name: "Penilaian Sumatif Toleransi Beragama",
    subject: "Agama",
    className: "XI-IPS-1",
    questions: [
      { id: "q-3-1", type: "PG", text: "Sikap saling menghormati perbedaan keyakinan disebut?", key: "D", weight: 20 },
      { id: "q-3-2", type: "PG", text: "Menjaga kerukunan antar umat beragama merupakan pengamalan sila ke...?", key: "A", weight: 20 },
      { id: "q-3-3", type: "BS", text: "Konsep moderasi beragama berarti mencampuradukkan ajaran ibadah antar agama.", key: "Salah", weight: 20 },
      { id: "q-3-4", type: "PGK", text: "Pilih perilaku yang mencerminkan kerukunan beragama di sekolah!", key: ["B", "C", "D"], weight: 20 },
      { id: "q-3-5", type: "ES", text: "Tuliskan pendapatmu tentang bagaimana cara mencegah radikalisme di kalangan pelajar!", key: "toleransi, edukasi, dialog, terbuka", weight: 20 }
    ]
  }
];

const DEFAULT_SUBMISSIONS = [
  // Submissions for ex-1 (PJOK - Class XI-MIPA-1)
  {
    id: "sub-1",
    examId: "ex-1",
    studentId: "std-1", // Ahmad Fauzi
    answers: {
      "q-1-1": "A",
      "q-1-2": "C",
      "q-1-3": ["B", "D"],
      "q-1-4": "Benar",
      "q-1-5": "Pemanasan penting untuk meregangkan otot agar tidak terjadi cedera saat olahraga berat serta melancarkan aliran darah."
    },
    scores: {
      "q-1-1": 20,
      "q-1-2": 20,
      "q-1-3": 20,
      "q-1-4": 20,
      "q-1-5": 20
    },
    totalScore: 100,
    status: "Selesai", // Selesai / Proses / Belum
    gradedAt: "2026-06-09T14:30:00Z"
  },
  {
    id: "sub-2",
    examId: "ex-1",
    studentId: "std-2", // Bella Citra
    answers: {
      "q-1-1": "B", // wrong (correct: A)
      "q-1-2": "C", // correct
      "q-1-3": ["B"], // partial (correct: B, D)
      "q-1-4": "Benar", // correct
      "q-1-5": "Supaya tidak kaku dan tidak kaget saat berolahraga."
    },
    scores: {
      "q-1-1": 0,
      "q-1-2": 20,
      "q-1-3": 10, // partial score
      "q-1-4": 20,
      "q-1-5": 10 // essay custom score
    },
    totalScore: 60,
    status: "Selesai",
    gradedAt: "2026-06-09T14:45:00Z"
  },
  {
    id: "sub-3",
    examId: "ex-1",
    studentId: "std-3", // Candra Wijaya
    answers: {
      "q-1-1": "A",
      "q-1-2": "A", // wrong
      "q-1-3": ["A", "C"], // wrong
      "q-1-4": "Salah", // wrong
      "q-1-5": "Menghindari kram otot."
    },
    scores: {
      "q-1-1": 20,
      "q-1-2": 0,
      "q-1-3": 0,
      "q-1-4": 0,
      "q-1-5": 0 // not evaluated/low key match
    },
    totalScore: 20,
    status: "Belum",
    gradedAt: ""
  },
  {
    id: "sub-4",
    examId: "ex-1",
    studentId: "std-4", // Dina Lestari
    answers: {
      "q-1-1": "A",
      "q-1-2": "C",
      "q-1-3": ["B", "D"],
      "q-1-4": "Benar",
      "q-1-5": "Pemanasan memperlancar aliran oksigen ke seluruh tubuh dan membuat otot kita lebih fleksibel sehingga siap olahraga."
    },
    scores: {
      "q-1-1": 20,
      "q-1-2": 20,
      "q-1-3": 20,
      "q-1-4": 20,
      "q-1-5": 20
    },
    totalScore: 100,
    status: "Proses", // marked as in-progress (essay pending formal check)
    gradedAt: "2026-06-09T15:10:00Z"
  },

  // Submissions for ex-2 (Fisika - Class XI-MIPA-2)
  {
    id: "sub-5",
    examId: "ex-2",
    studentId: "std-6", // Farah Nabila
    answers: {
      "q-2-1": "B",
      "q-2-2": "Salah",
      "q-2-3": ["A", "C"],
      "q-2-4": "Penerapan hukum Newton III adalah ketika mendayung perahu, air didorong ke belakang (aksi) dan perahu melaju ke depan (reaksi). Serta peluncuran roket menyemburkan gas (aksi) dan terdorong ke atas (reaksi)."
    },
    scores: {
      "q-2-1": 25,
      "q-2-2": 25,
      "q-2-3": 25,
      "q-2-4": 25
    },
    totalScore: 100,
    status: "Selesai",
    gradedAt: "2026-06-09T16:00:00Z"
  },
  {
    id: "sub-6",
    examId: "ex-2",
    studentId: "std-7", // Galih Saputra
    answers: {
      "q-2-1": "C", // wrong
      "q-2-2": "Salah", // correct
      "q-2-3": ["A"], // partial
      "q-2-4": "Ketika kita mendorong tembok tetapi tembok tidak bergerak."
    },
    scores: {
      "q-2-1": 0,
      "q-2-2": 25,
      "q-2-3": 12.5,
      "q-2-4": 5
    },
    totalScore: 42.5,
    status: "Selesai",
    gradedAt: "2026-06-09T16:15:00Z"
  }
];

const DEFAULT_ACTIVITIES = [
  { id: "act-1", text: "Membuat Ujian 'Penilaian Harian Kebugaran Jasmani'", timestamp: "2026-06-09T08:00:00Z" },
  { id: "act-2", text: "Mengoreksi jawaban siswa Ahmad Fauzi (PJOK - Nilai: 100)", timestamp: "2026-06-09T14:30:00Z" },
  { id: "act-3", text: "Mengoreksi jawaban siswa Bella Citra (PJOK - Nilai: 60)", timestamp: "2026-06-09T14:45:00Z" },
  { id: "act-4", text: "Mengekspor rekap nilai kelas XI-MIPA-1 ke format Excel", timestamp: "2026-06-09T15:20:00Z" }
];
