/**
 * ============================================================================
 * SCHOOL EQUIPMENT CHECKER - SCRIPT.JS
 * Logika AI Teachable Machine, Kamera Real-Time, Analisis Warna & Kelayakan
 * ============================================================================
 */

// 1. URL Model Teachable Machine (disimpan di baris paling atas agar mudah diganti)
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/pveJJipMn/";

// 2. Ambang Batas Kelayakan (Threshold Feasibility = 60%)
const FEASIBILITY_THRESHOLD = 0.60;

// Variabel Global untuk menyimpan referensi Model dan Kamera
let model = null;
let webcam = null;
let maxPredictions = 0;
let isCameraRunning = false;
let animationFrameId = null;

// Referensi Elemen Antarmuka (DOM Elements)
const aiStatusPill = document.getElementById("aiStatusPill");
const statusDot = document.getElementById("statusDot");
const aiStatusText = document.getElementById("aiStatusText");

const btnToggleCamera = document.getElementById("btnToggleCamera");
const btnCameraIcon = document.getElementById("btnCameraIcon");
const btnCameraText = document.getElementById("btnCameraText");

const cameraPlaceholder = document.getElementById("cameraPlaceholder");
const webcamContainer = document.getElementById("webcamContainer");
const scanOverlay = document.getElementById("scanOverlay");

const eligibilityBadge = document.getElementById("eligibilityBadge");
const mainResultDisplay = document.getElementById("mainResultDisplay");
const resultIcon = document.getElementById("resultIcon");
const resultLabel = document.getElementById("resultLabel");
const resultSubtext = document.getElementById("resultSubtext");

const feasibilityPercent = document.getElementById("feasibilityPercent");
const feasibilityBar = document.getElementById("feasibilityBar");
const feasibilityNote = document.getElementById("feasibilityNote");
const feasibilityState = document.getElementById("feasibilityState");

const recommendationCard = document.getElementById("recommendationCard");
const recIcon = document.getElementById("recIcon");
const recTitle = document.getElementById("recTitle");
const recMessage = document.getElementById("recMessage");

const wasteDesc = document.getElementById("wasteDesc");

const detectedColorDot = document.getElementById("detectedColorDot");
const detectedColorText = document.getElementById("detectedColorText");
const detectedShapeText = document.getElementById("detectedShapeText");

// Elemen Modal Peringatan / Error
const errorDialog = document.getElementById("errorDialog");
const dialogIcon = document.getElementById("dialogIcon");
const dialogTitle = document.getElementById("dialogTitle");
const dialogMessage = document.getElementById("dialogMessage");
const btnDialogClose = document.getElementById("btnDialogClose");

// Mapping ikon dan deskripsi untuk setiap label Teachable Machine
const OBJECT_CONFIG = {
  "Pulpen": {
    icon: "🖊️",
    displayName: "Pulpen",
    shapeDesc: "Silinder memanjang (Alat Tulis)"
  },
  "Tip X": {
    icon: "❌",
    displayName: "Tip X",
    shapeDesc: "Botol mini / Pita Koreksi"
  },
  "Sepatu": {
    icon: "👞",
    displayName: "Sepatu",
    shapeDesc: "Alas Kaki Tertutup"
  }
};

/**
 * Inisialisasi Aplikasi ketika halaman web selesai dimuat
 */
window.addEventListener("DOMContentLoaded", async () => {
  // Pasang event listener tombol modal dialog
  btnDialogClose.addEventListener("click", () => {
    errorDialog.style.display = "none";
  });

  // Pasang event listener tombol Mulai/Hentikan Kamera
  btnToggleCamera.addEventListener("click", toggleCamera);

  // Muat model Teachable Machine saat web dibuka
  await loadTeachableMachineModel();
});

/**
 * Fungsi: Memuat model Teachable Machine dari MODEL_URL
 */
async function loadTeachableMachineModel() {
  try {
    // Tampilkan indikator status sedang memuat
    aiStatusText.textContent = "Memuat AI...";
    statusDot.className = "status-dot pulsing";
    btnToggleCamera.disabled = true;

    const modelJsonURL = MODEL_URL + "model.json";
    const metadataJsonURL = MODEL_URL + "metadata.json";

    // Memuat model gambar menggunakan pustaka tmImage
    model = await tmImage.load(modelJsonURL, metadataJsonURL);
    maxPredictions = model.getTotalClasses();

    // Perbarui status jika model berhasil dimuat
    aiStatusText.textContent = "AI Siap Digunakan";
    statusDot.className = "status-dot ready";
    btnToggleCamera.disabled = false;
    btnToggleCamera.title = "Klik untuk mengaktifkan kamera perangkat";

    console.log("Model Teachable Machine berhasil dimuat. Jumlah kelas:", maxPredictions);
  } catch (error) {
    console.error("Gagal memuat model Teachable Machine:", error);
    aiStatusText.textContent = "Gagal Memuat AI";
    statusDot.className = "status-dot";
    statusDot.style.backgroundColor = "#dc2626";

    showErrorDialog(
      "Gagal Memuat Model AI",
      "Tidak dapat memuat model Teachable Machine. Pastikan koneksi internet aktif dan tautan model valid:\n" + MODEL_URL,
      "🌐"
    );
  }
}

/**
 * Fungsi: Mengaktifkan atau menghentikan kamera perangkat
 */
async function toggleCamera() {
  if (isCameraRunning) {
    stopCamera();
  } else {
    await startCamera();
  }
}

/**
 * Fungsi: Menyalakan kamera dan memulai loop deteksi real-time
 */
async function startCamera() {
  // Periksa apakah browser mendukung fitur kamera (getUserMedia)
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showErrorDialog(
      "Browser Tidak Mendukung",
      "Peramban (browser) Anda tidak mendukung akses kamera secara langsung. Silakan gunakan Google Chrome, Microsoft Edge, atau Mozilla Firefox versi terbaru.",
      "🚫"
    );
    return;
  }

  try {
    btnToggleCamera.disabled = true;
    aiStatusText.textContent = "Mengakses Kamera...";
    statusDot.className = "status-dot pulsing";

    // Konfigurasi ukuran webcam (lebar, tinggi, mirror/flip horizontal)
    const flip = true; // mirror mode agar interaktif seperti cermin
    const width = 400;
    const height = 400;
    webcam = new tmImage.Webcam(width, height, flip);

    // Minta izin kamera pengguna
    await webcam.setup();
    await webcam.play();

    // Bersihkan kontainer webcam dan masukkan canvas video Teachable Machine
    webcamContainer.innerHTML = "";
    webcamContainer.appendChild(webcam.canvas);

    // Tampilkan tampilan kamera aktif dan sembunyikan placeholder
    cameraPlaceholder.style.display = "none";
    scanOverlay.style.display = "flex";

    // Ubah status dan tampilan tombol
    isCameraRunning = true;
    btnToggleCamera.disabled = false;
    btnToggleCamera.className = "btn btn-danger";
    btnCameraIcon.textContent = "⏹";
    btnCameraText.textContent = "Hentikan Kamera";

    aiStatusText.textContent = "Mendeteksi Real-Time";
    statusDot.className = "status-dot active";

    // Mulai animasi loop prediksi
    animationFrameId = window.requestAnimationFrame(detectionLoop);
  } catch (err) {
    btnToggleCamera.disabled = false;
    aiStatusText.textContent = "AI Siap Digunakan";
    statusDot.className = "status-dot ready";
    console.error("Kesalahan akses kamera:", err);

    // Penanganan jenis-jenis error kamera
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      showErrorDialog(
        "Izin Kamera Ditolak",
        "Aplikasi tidak diizinkan mengakses kamera Anda. Silakan izinkan akses kamera pada ikon gembok di bilah alamat browser lalu coba lagi.",
        "🔒"
      );
    } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      showErrorDialog(
        "Kamera Tidak Ditemukan",
        "Tidak ada perangkat kamera yang terdeteksi di laptop/HP Anda. Sambungkan webcam lalu coba lagi.",
        "📷"
      );
    } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
      showErrorDialog(
        "Kamera Sedang Digunakan",
        "Kamera kemungkinan sedang dipakai oleh aplikasi lain (seperti Zoom, Teams, atau tab lain). Tutup aplikasi tersebut terlebih dahulu.",
        "⚠️"
      );
    } else {
      showErrorDialog(
        "Gagal Membuka Kamera",
        "Terjadi masalah saat menghubungkan ke kamera: " + (err.message || err.name),
        "⚠️"
      );
    }
  }
}

/**
 * Fungsi: Menghentikan kamera dan loop prediksi
 */
function stopCamera() {
  if (animationFrameId) {
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (webcam) {
    webcam.stop();
  }

  isCameraRunning = false;

  // Kembalikan tampilan kamera ke placeholder awal
  webcamContainer.innerHTML = "";
  cameraPlaceholder.style.display = "flex";
  scanOverlay.style.display = "none";

  // Perbarui tombol
  btnToggleCamera.className = "btn btn-primary";
  btnCameraIcon.textContent = "▶";
  btnCameraText.textContent = "Mulai Kamera";

  aiStatusText.textContent = "Model Siap (Kamera Nonaktif)";
  statusDot.className = "status-dot ready";

  // Reset tampilan karakteristik dan hasil
  resetDisplaysToIdle();
}

/**
 * Loop Frame Prediksi Real-Time
 */
async function detectionLoop() {
  if (!isCameraRunning) return;

  // Perbarui frame webcam
  webcam.update();

  // Jalankan prediksi AI
  await runPrediction();

  // Lanjutkan loop frame berikutnya
  animationFrameId = window.requestAnimationFrame(detectionLoop);
}

/**
 * Menjalankan prediksi model Teachable Machine terhadap frame canvas kamera
 */
async function runPrediction() {
  if (!model || !webcam || !webcam.canvas) return;

  // AI menganalisis gambar dari kamera
  const predictions = await model.predict(webcam.canvas);

  // Cari prediksi dengan tingkat probabilitas (feasibility) tertinggi
  let topPrediction = predictions[0];
  for (let i = 1; i < predictions.length; i++) {
    if (predictions[i].probability > topPrediction.probability) {
      topPrediction = predictions[i];
    }
  }

  // Analisis karakteristik warna dari area tengah kamera
  const dominantColor = detectDominantColor(webcam.canvas);

  // Perbarui Tampilan Antarmuka Hasil Deteksi
  updateInterface(predictions, topPrediction, dominantColor);
}

/**
 * Menganalisis warna dominan pada bagian tengah gambar kamera
 */
function detectDominantColor(canvas) {
  try {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    // Ambil sampel area tengah (40x40 piksel)
    const sampleSize = 40;
    const startX = Math.max(0, Math.floor((width - sampleSize) / 2));
    const startY = Math.max(0, Math.floor((height - sampleSize) / 2));

    const imgData = ctx.getImageData(startX, startY, sampleSize, sampleSize);
    const data = imgData.data;

    let totalR = 0, totalG = 0, totalB = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      totalR += data[i];
      totalG += data[i + 1];
      totalB += data[i + 2];
    }

    const avgR = Math.round(totalR / pixelCount);
    const avgG = Math.round(totalG / pixelCount);
    const avgB = Math.round(totalB / pixelCount);

    const hexColor = rgbToHex(avgR, avgG, avgB);
    const colorName = getColorName(avgR, avgG, avgB);

    return { name: colorName, hex: hexColor };
  } catch (e) {
    return { name: "Tidak terdeteksi", hex: "#cbd5e1" };
  }
}

/**
 * Mengonversi nilai RGB menjadi nama warna umum dalam Bahasa Indonesia
 */
function getColorName(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  // Deteksi tingkat kegelapan dan kecerahan
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  if (brightness < 45) return "Hitam";
  if (brightness > 220 && diff < 25) return "Putih";
  if (diff < 20) {
    return brightness < 130 ? "Abu-abu Gelap" : "Abu-abu";
  }

  // Deteksi HSL hue
  let hue = 0;
  if (max === r) {
    hue = ((g - b) / diff) % 6;
  } else if (max === g) {
    hue = (b - r) / diff + 2;
  } else {
    hue = (r - g) / diff + 4;
  }
  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;

  if (hue >= 340 || hue < 15) {
    return brightness > 150 ? "Pink / Merah Muda" : "Merah";
  } else if (hue >= 15 && hue < 45) {
    return brightness < 100 ? "Cokelat" : "Oranye";
  } else if (hue >= 45 && hue < 70) {
    return "Kuning";
  } else if (hue >= 70 && hue < 165) {
    return "Hijau";
  } else if (hue >= 165 && hue < 260) {
    return "Biru";
  } else if (hue >= 260 && hue < 320) {
    return "Ungu";
  } else {
    return "Pink";
  }
}

function rgbToHex(r, g, b) {
  const toHex = (n) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Memperbarui Tampilan Antarmuka (UI) berdasarkan hasil prediksi AI
 */
function updateInterface(allPredictions, topPrediction, colorInfo) {
  const label = topPrediction.className.trim();
  const probability = topPrediction.probability;
  const percentValue = Math.round(probability * 100);
  const isFeasible = probability >= FEASIBILITY_THRESHOLD;

  // 1. Perbarui Karakteristik Benda (Warna & Bentuk)
  detectedColorDot.style.backgroundColor = colorInfo.hex;
  detectedColorText.textContent = `${colorInfo.name} (${colorInfo.hex})`;

  const config = OBJECT_CONFIG[label] || {
    icon: "📦",
    displayName: label,
    shapeDesc: "Peralatan Sekolah"
  };

  detectedShapeText.textContent = config.displayName;

  // 2. Perbarui Tingkat Kelayakan (Feasibility Percentage & Bar)
  feasibilityPercent.textContent = `${percentValue}%`;
  feasibilityBar.style.width = `${percentValue}%`;

  if (isFeasible) {
    feasibilityBar.style.background = "linear-gradient(90deg, #10b981 0%, #059669 100%)";
    feasibilityState.textContent = "Memenuhi Syarat (>60%)";
    feasibilityState.style.color = "#059669";
  } else {
    feasibilityBar.style.background = "linear-gradient(90deg, #f59e0b 0%, #d97706 100%)";
    feasibilityState.textContent = "Di Bawah Batas (<60%)";
    feasibilityState.style.color = "#d97706";
  }

  // 3. Perbarui Nilai Breakdown Setiap Kelas
  allPredictions.forEach((pred) => {
    const classKey = pred.className.trim().replace(/\s+/g, "");
    const scoreEl = document.getElementById(`score-${classKey}`);
    const barEl = document.getElementById(`bar-${classKey}`);
    const rowEl = document.getElementById(`item-${classKey}`);

    const pScore = Math.round(pred.probability * 100);

    if (scoreEl) scoreEl.textContent = `${pScore}%`;
    if (barEl) barEl.style.width = `${pScore}%`;
    if (rowEl) {
      if (pred.className.trim() === label && isFeasible) {
        rowEl.classList.add("active-class");
      } else {
        rowEl.classList.remove("active-class");
      }
    }
  });

  // 4. ATURAN HASIL DETEKSI & SARAN
  applyDetectionRules(label, probability, isFeasible, config);
}

/**
 * Menerapkan Aturan Hasil Deteksi, Kelayakan Sekolah, dan Rekomendasi Sampah
 */
function applyDetectionRules(label, probability, isFeasible, config) {
  // Efek highlight pada kartu utama jika terdeteksi
  mainResultDisplay.classList.add("highlight");

  if (isFeasible) {
    // KELAYAKAN >= 60%
    resultIcon.textContent = config.icon;
    resultLabel.textContent = config.displayName;

    if (label === "Pulpen") {
      // Aturan: Jika bentuk = Pulpen dan feasibility >= 60%
      // Tampilkan: “🖊️ Pulpen” | “Silakan buang ke tempat sampah ANORGANIK.”
      eligibilityBadge.className = "eligibility-status-badge status-passed";
      eligibilityBadge.textContent = "LAYAK DIPAKAI SEKOLAH";

      resultSubtext.textContent = "Benda terdeteksi layak sebagai alat tulis sekolah (Pulpen).";

      recommendationCard.className = "recommendation-card valid-card";
      recIcon.textContent = "🖊️";
      recTitle.textContent = "🖊️ Pulpen - Layak Sekolah";
      recMessage.innerHTML = `
        <strong>Status:</strong> Benda terverifikasi sebagai Pulpen layak pakai untuk sekolah.<br>
        <strong>Kelayakan:</strong> Memenuhi standar alat tulis kelas (&gt;60%).<br>
        <em>Gunakan untuk menulis tugas dan mencatat pelajaran dengan rapi.</em>
      `;

      // Rekomendasi tempat sampah sesuai spesifikasi prompt
      wasteDesc.innerHTML = `
        <strong>🖊️ Pulpen:</strong> Silakan buang ke tempat sampah <strong>ANORGANIK</strong> jika tinta sudah habis atau bagian plastik pulpen patah.
      `;

    } else if (label === "Tip X") {
      // Aturan: Jika label = Tip X dan feasibility >= 60%
      // Tampilkan: “❌ Tip X” | “Benda tersebut tidak dapat dideteksi sebagai Tip X.”
      eligibilityBadge.className = "eligibility-status-badge status-rejected";
      eligibilityBadge.textContent = "TIDAK LAYAK / TIDAK SESUAI";

      resultSubtext.textContent = "Benda tersebut tidak dapat dideteksi sebagai Tip X.";

      recommendationCard.className = "recommendation-card invalid-card";
      recIcon.textContent = "❌";
      recTitle.textContent = "❌ Tip X";
      recMessage.innerHTML = `
        <strong>Benda tersebut tidak dapat dideteksi sebagai Tip X.</strong><br>
        Benda ini tidak memenuhi kriteria Tip X standar sekolah atau bentuknya belum sesuai. Periksa kembali wadah koreksi Anda.
      `;

      wasteDesc.innerHTML = `
        <strong>❌ Tip X:</strong> Jika Tip X kering, bocor, atau rusak, buang sisa wadah plastiknya ke tempat sampah <strong>ANORGANIK</strong> / residu berbahaya agar tidak mengotori meja sekolah.
      `;

    } else if (label === "Sepatu") {
      // Aturan: Jika label = Sepatu dan feasibility >= 60%
      // Tampilkan: “👞 Sepatu” | “Sepatu tersebut tidak sesuai untuk sekolah.”
      eligibilityBadge.className = "eligibility-status-badge status-rejected";
      eligibilityBadge.textContent = "TIDAK SESUAI SEKOLAH";

      resultSubtext.textContent = "Sepatu tersebut tidak sesuai untuk sekolah.";

      recommendationCard.className = "recommendation-card invalid-card";
      recIcon.textContent = "👞";
      recTitle.textContent = "👞 Sepatu";
      recMessage.innerHTML = `
        <strong>Sepatu tersebut tidak sesuai untuk sekolah.</strong><br>
        Tata tertib sekolah umumnya mewajibkan <strong>Sepatu Hitam Polos</strong> bertali/tertutup. Pastikan sepatu yang Anda gunakan sesuai dengan aturan seragam sekolah.
      `;

      wasteDesc.innerHTML = `
        <strong>👞 Sepatu:</strong> Sepatu lama yang sudah sobek atau rusak berat disarankan untuk diperbaiki ke pengrajin sol sepatu atau dibuang ke tempat sampah residu sekolah.
      `;
    }

  } else {
    // KELAYAKAN < 60% (Di bawah batas kelayakan)
    eligibilityBadge.className = "eligibility-status-badge status-low";
    eligibilityBadge.textContent = "BELUM LAYAK (< 60%)";

    resultIcon.textContent = config.icon;
    resultLabel.textContent = `${config.displayName} (?)`;
    resultSubtext.textContent = `Tingkat kelayakan belum mencapai 60% (${Math.round(probability * 100)}%). Arahkan benda lebih dekat ke kamera.`;

    recommendationCard.className = "recommendation-card";
    recIcon.textContent = "⏳";
    recTitle.textContent = "Pemeriksaan Belum Selesai";

    if (label === "Pulpen") {
      recMessage.innerHTML = `
        <strong>🖊️ Pulpen:</strong> Benda tersebut tidak dapat dideteksi sebagai pulpen (kelayakan &lt;60%). Posisikan pulpen tepat di tengah kotak pemindai.
      `;
    } else if (label === "Tip X") {
      recMessage.innerHTML = `
        <strong>❌ Tip X:</strong> Benda tersebut tidak dapat dideteksi sebagai Tip X (kelayakan &lt;60%). Pastikan pencahayaan cukup terang.
      `;
    } else if (label === "Sepatu") {
      recMessage.innerHTML = `
        <strong>👞 Sepatu:</strong> Sepatu tersebut tidak sesuai untuk sekolah (kelayakan &lt;60%). Tunjukkan sepatu secara menyeluruh ke kamera.
      `;
    } else {
      recMessage.innerHTML = "Benda belum dapat diidentifikasi secara akurat. Dekatkan benda ke kamera.";
    }

    wasteDesc.textContent = "Kelayakan masih di bawah 60%. Silakan posisikan benda sekolah lebih dekat sebelum memverifikasi rekomendasi kelayakan & kebersihan.";
  }
}

/**
 * Mereset tampilan ke keadaan siap saat kamera dimatikan
 */
function resetDisplaysToIdle() {
  eligibilityBadge.className = "eligibility-status-badge status-idle";
  eligibilityBadge.textContent = "Kamera Nonaktif";

  mainResultDisplay.classList.remove("highlight");
  resultIcon.textContent = "🔍";
  resultLabel.textContent = "Belum Ada Benda";
  resultSubtext.textContent = "Nyalakan kamera dan arahkan benda ke layar";

  feasibilityPercent.textContent = "0%";
  feasibilityBar.style.width = "0%";
  feasibilityState.textContent = "Menunggu";

  recommendationCard.className = "recommendation-card";
  recIcon.textContent = "📋";
  recTitle.textContent = "Saran & Hasil Evaluasi";
  recMessage.textContent = "Nyalakan kamera dan arahkan benda sekolah ke hadapan kamera untuk melihat evaluasi kelayakan secara otomatis.";

  wasteDesc.textContent = "Kebersihan sekolah adalah tanggung jawab bersama. Gunakan tempat sampah yang tepat sesuai jenis bahannya.";

  detectedColorDot.style.backgroundColor = "#cbd5e1";
  detectedColorText.textContent = "Menunggu kamera...";
  detectedShapeText.textContent = "Menunggu kamera...";

  ["Pulpen", "TipX", "Sepatu"].forEach((item) => {
    const scoreEl = document.getElementById(`score-${item}`);
    const barEl = document.getElementById(`bar-${item}`);
    const rowEl = document.getElementById(`item-${item}`);
    if (scoreEl) scoreEl.textContent = "0%";
    if (barEl) barEl.style.width = "0%";
    if (rowEl) rowEl.classList.remove("active-class");
  });
}

/**
 * Menampilkan Kotak Dialog Pesan Error yang Ramah Siswa
 */
function showErrorDialog(title, message, icon = "⚠️") {
  dialogTitle.textContent = title;
  dialogMessage.textContent = message;
  dialogIcon.textContent = icon;
  errorDialog.style.display = "flex";
}
