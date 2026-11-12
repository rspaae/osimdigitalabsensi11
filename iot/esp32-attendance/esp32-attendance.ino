/*
 * OSIS MPK SMKN 11 BANDUNG — Attendance & Management System
 * Firmware Scanner Presensi RFID ESP32 DevKit V1
 *
 * Hardware (Project Owner Decision):
 *   - ESP32 DevKit V1 (30 pins)
 *   - MFRC522 RFID Reader (SPI: SS=5, RST=4, SCK=18, MOSI=23, MISO=19)
 *   - LCD 16x2 I2C (PCF8574: SDA=21, SCL=22, Alamat 0x27)
 *   - CATATAN: TIDAK MENGGUNAKAN BUZZER (Dihapus sepenuhnya sesuai keputusan PO).
 *     Seluruh umpan balik ditampilkan melalui layar LCD 16x2.
 *
 * Catatan Keamanan:
 *   - Kredensial Wi-Fi & Device API Key dimuat dari "secrets.h" (diabaikan git).
 *   - Menggunakan HTTPS dengan verifikasi sertifikat Root CA (WiFiClientSecure).
 *   - DILARANG menggunakan setInsecure().
 *   - Waktu kehadiran murni ditentukan oleh server (ESP32 tidak mengirim jam).
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <time.h>

#include "config.h"

// Sertakan secrets.h jika ada, jika tidak sertakan secrets.example.h agar tetap bisa dicompile
#if __has_include("secrets.h")
#include "secrets.h"
#else
#include "secrets.example.h"
#endif

// Inisialisasi Perangkat Keras
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, LCD_COLS, LCD_ROWS);
MFRC522 rfc(RFID_SS_PIN, RFID_RST_PIN);
WiFiClientSecure secureClient;
WiFiClient localClient;

// State Tracking
String lastScannedUid = "";
unsigned long lastScanMillis = 0;
unsigned long lastHeartbeatMillis = 0;

bool beginServerRequest(HTTPClient &client, const String &url) {
  if (url.startsWith("https://")) {
    secureClient.stop();
    secureClient.setCACert(SERVER_ROOT_CA);
    secureClient.setTimeout(HTTP_TIMEOUT_MS / 1000);
    return client.begin(secureClient, url);
  }

#if defined(ALLOW_LOCAL_HTTP) && ALLOW_LOCAL_HTTP
  if (url.startsWith("http://")) {
    Serial.println("PERINGATAN: HTTP lokal aktif; API key tidak terenkripsi di jaringan.");
    return client.begin(localClient, url);
  }
#endif

  Serial.println("URL ditolak. HTTPS wajib kecuali ALLOW_LOCAL_HTTP aktif untuk uji lokal.");
  return false;
}

// ============================================================================
// DISPLAY HELPERS (LCD 16x2)
// ============================================================================

void displayLcd(const String &line1, const String &line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1.substring(0, 16));
  lcd.setCursor(0, 1);
  lcd.print(line2.substring(0, 16));
}

void showReadyScreen() {
  displayLcd("SMKN 11 BANDUNG", "Tempel Kartu...");
}

// ============================================================================
// NETWORK SETUP & MONITORING
// ============================================================================

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;

  displayLcd("Menghubungkan...", "WiFi: " + String(WIFI_SSID));
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttemptTime = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < WIFI_TIMEOUT_MS) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi Connected! IP: ");
    Serial.println(WiFi.localIP());
    displayLcd("WiFi Terhubung!", "Sinkron Jam...");

    // Sinkronisasi waktu NTP agar validasi sertifikat HTTPS TLS valid
    Serial.print("Sinkronisasi waktu via NTP...");
    configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");
    time_t now = time(nullptr);
    int retryTime = 0;
    while (now < 1700000000 && retryTime < 20) {
      delay(500);
      Serial.print(".");
      now = time(nullptr);
      retryTime++;
    }
    Serial.println();
    struct tm timeinfo;
    if (getLocalTime(&timeinfo)) {
      Serial.printf("Waktu sekarang: %04d-%02d-%02d %02d:%02d:%02d WIB\n",
                    timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
                    timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
    } else {
      Serial.println("Peringatan: NTP timeout, lanjut mencoba...");
    }

    displayLcd("WiFi Terhubung!", WiFi.localIP().toString());
    delay(1500);
    showReadyScreen();
  } else {
    Serial.println("WiFi Connection Failed!");
    displayLcd("WiFi Gagal!", "Cek Konfigurasi");
    delay(2000);
  }
}

// ============================================================================
// RFID NORMALIZATION & PROCESSING
// ============================================================================

/**
 * Normalisasi UID kartu ke format kanonikal heksadesimal uppercase tanpa pemisah.
 * Setiap byte diwakili tepat 2 karakter dengan zero-padding jika < 0x10.
 * Contoh hasil: "0A1B05FF", "5C45059E"
 */
String normalizeUid(MFRC522::Uid *uid) {
  String normalized = "";
  for (byte i = 0; i < uid->size; i++) {
    if (uid->uidByte[i] < 0x10) {
      normalized += "0";
    }
    normalized += String(uid->uidByte[i], HEX);
  }
  normalized.toUpperCase();
  return normalized;
}

// ============================================================================
// HTTP / API INTEGRATION
// ============================================================================

void sendAttendanceScan(const String &rfidUid) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Error: WiFi tidak tersambung saat memindai!");
    displayLcd("Koneksi Putus!", "Reconnecting...");
    delay(1000);
    connectWifi();
    return;
  }

  // UID tidak ditampilkan di LCD (hanya di Serial Monitor) agar kode kartu tidak bocor.
  displayLcd("Scanning...", "Mohon tunggu");

  HTTPClient https;
  String targetUrl = String(SERVER_BASE_URL) + String(API_SCAN_PATH);

  if (!beginServerRequest(https, targetUrl)) {
    Serial.println("Gagal memulai sesi server!");
    displayLcd("Server Error", "Cek URL/Mode");
    delay(2000);
    showReadyScreen();
    return;
  }

  https.addHeader("Content-Type", "application/json");
  https.addHeader("Authorization", "Bearer " + String(DEVICE_API_KEY));
  https.setTimeout(HTTP_TIMEOUT_MS);

  // Siapkan payload JSON
  StaticJsonDocument<256> reqDoc;
  reqDoc["device_code"] = DEVICE_CODE;
  reqDoc["rfid_uid"] = rfidUid;

  String requestPayload;
  serializeJson(reqDoc, requestPayload);

  Serial.print("Mengirim scan ke: ");
  Serial.println(targetUrl);

  int httpCode = -1;
  int retries = 0;

  while (httpCode <= 0 && retries <= MAX_HTTP_RETRIES) {
    httpCode = https.POST(requestPayload);
    if (httpCode <= 0) {
      retries++;
      Serial.printf("HTTP Request gagal, error: %s. Retry %d/%d\n",
                    https.errorToString(httpCode).c_str(), retries, MAX_HTTP_RETRIES);
      delay(500);
    }
  }

  if (httpCode <= 0) {
    Serial.printf("Request gagal permanen: %s\n", https.errorToString(httpCode).c_str());
    displayLcd("KONEKSI TIMEOUT", "Coba Lagi");
    delay(2500);
    https.end();
    showReadyScreen();
    return;
  }

  String responseBody = https.getString();
  Serial.printf("HTTP Status: %d\n", httpCode);

  StaticJsonDocument<512> resDoc;
  DeserializationError jsonErr = deserializeJson(resDoc, responseBody);

  if (jsonErr) {
    Serial.print("JSON Parse error: ");
    Serial.println(jsonErr.c_str());
    displayLcd("RESPON RUSAK", "JSON Malformed");
    delay(2500);
    https.end();
    showReadyScreen();
    return;
  }

  // ==========================================================================
  // EVALUASI RESPON BERDASARKAN API RESPONSE CONTRACT (MILESTONE 15)
  // ==========================================================================
  if (httpCode == 200 || httpCode == 201) {
    bool isSuccess = resDoc["success"] | false;
    if (isSuccess && resDoc.containsKey("data")) {
      const char* memberName = resDoc["data"]["member_name"] | "Anggota";
      const char* status = resDoc["data"]["status"] | "HADIR";
      bool isDuplicate = resDoc["data"]["is_duplicate"] | false;

      Serial.printf("Presensi Sukses: %s - Status: %s (Duplicate: %d)\n",
                    memberName, status, isDuplicate);

      String statusStr = String(status);

      if (isDuplicate) {
        if (statusStr == "DI_LUAR_JADWAL") {
          displayLcd(String(memberName), "DI LUAR JADWAL");
        } else {
          displayLcd(String(memberName), "SUDAH: " + statusStr);
        }
      } else {
        if (statusStr == "DI_LUAR_JADWAL") {
          displayLcd(String(memberName), "DI LUAR JADWAL");
        } else if (statusStr == "TERLAMBAT") {
          displayLcd(String(memberName), "STATUS:TERLAMBAT");
        } else {
          displayLcd(String(memberName), "STATUS: " + statusStr);
        }
      }
    } else {
      displayLcd("GAGAL PRESENSI", "Data Tdk Valid");
    }
  } else {
    // Penanganan Error Terstruktur Berdasarkan Machine-Readable Error Code (Maks 16 char/baris)
    const char* errCode = resDoc["code"] | "";
    const char* errorMsg = resDoc["error"] | "Kesalahan";
    Serial.printf("API Error [%d | %s]: %s\n", httpCode, errCode, errorMsg);

    String codeStr = String(errCode);

    if (codeStr == "CUTOFF_TIME_EXCEEDED") {
      displayLcd("BATAS WKT HABIS", "Absensi Ditutup");
    } else if (codeStr == "SCHEDULE_NO_MATCH") {
      displayLcd("JADWAL TDK ADA", "Cek Jam Piket");
    } else if (codeStr == "SCHEDULE_AMBIGUOUS") {
      displayLcd("JADWAL BENTROK", "Hubungi Admin");
    } else if (codeStr == "CYCLE_NOT_CONFIGURED") {
      displayLcd("SIKLUS TDK ADA", "Set di Dashboard");
    } else if (codeStr == "DEVICE_AUTH_FAILED" || httpCode == 401) {
      displayLcd("DEVICE DITOLAK", "Auth Key Salah");
    } else if (codeStr == "DEVICE_INACTIVE") {
      displayLcd("DEVICE NONAKTIF", "Hubungi Admin");
    } else if (codeStr == "MEMBER_NOT_FOUND" || (httpCode == 404 && codeStr != "MEMBER_INACTIVE")) {
      displayLcd("KARTU DITOLAK", "Belum Terdaftar");
    } else if (codeStr == "MEMBER_INACTIVE") {
      displayLcd("ANGGOTA NONAKTIF", "Hubungi Admin");
    } else if (codeStr == "VALIDATION_ERROR" || httpCode == 400) {
      displayLcd("FORMAT SALAH", "Cek Data Kartu");
    } else if (codeStr == "CONFLICT" || httpCode == 409) {
      displayLcd("SUDAH TERCATAT", "Duplikasi Scan");
    } else {
      displayLcd("SERVER ERROR", "Hubungi Admin");
    }
  }

  delay(SCAN_COOLDOWN_MS);
  https.end();
  showReadyScreen();
}

void sendDeviceHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String targetUrl = String(SERVER_BASE_URL) + String(API_HEARTBEAT_PATH);
  if (!beginServerRequest(http, targetUrl)) {
    Serial.println("Heartbeat gagal dimulai; cek URL server dan mode HTTP lokal.");
    return;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + String(DEVICE_API_KEY));
  http.setTimeout(HTTP_TIMEOUT_MS);

  StaticJsonDocument<128> reqDoc;
  reqDoc["device_code"] = DEVICE_CODE;
  String payload;
  serializeJson(reqDoc, payload);

  int status = http.POST(payload);
  if (status > 0) {
    String response = http.getString();
    StaticJsonDocument<256> resDoc;
    DeserializationError jsonErr = deserializeJson(resDoc, response);
    bool connected = !jsonErr && (resDoc["success"] | false) &&
                     (resDoc["data"]["connected"] | false);
    Serial.printf("Heartbeat HTTP %d: %s\n", status, connected ? "terhubung" : "ditolak");
    if (!connected) Serial.println(response);
  } else {
    Serial.printf("Heartbeat gagal: %s\n", http.errorToString(status).c_str());
  }
  http.end();
}

// ============================================================================
// MAIN SETUP & LOOP
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n--- OSIS MPK SMKN 11 BANDUNG: ATTENDANCE SCANNER ---");

  // Inisialisasi LCD
  Wire.begin();
  lcd.init();
  lcd.backlight();
  displayLcd("OSIS MPK 11 BDG", "Inisialisasi...");

  // Inisialisasi SPI & RC522 RFID
  SPI.begin();
  rfc.PCD_Init();
  delay(100);

  // Cek modul MFRC522
  byte version = rfc.PCD_ReadRegister(rfc.VersionReg);
  if (version == 0x00 || version == 0xFF) {
    Serial.println("Peringatan: Komunikasi dengan MFRC522 gagal! Periksa kabel SPI.");
    displayLcd("RFID RC522 Error", "Periksa Kabel!");
    delay(2000);
  } else {
    Serial.printf("MFRC522 terdeteksi (Versi firmware: 0x%02X)\n", version);
  }

  // Koneksi Wi-Fi Awal
  connectWifi();
}

void loop() {
  // 1. Pantau status koneksi Wi-Fi secara berkala
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
    return;
  }

  if (lastHeartbeatMillis == 0 || millis() - lastHeartbeatMillis >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatMillis = millis();
    sendDeviceHeartbeat();
  }

  // 2. Periksa apakah kartu baru didekatkan
  if (!rfc.PICC_IsNewCardPresent()) {
    // Jika kartu sudah diangkat dan melewati jeda penghapusan, bersihkan cache UID terakhir
    if (lastScannedUid != "" && millis() - lastScanMillis > CARD_REMOVAL_DELAY_MS) {
      lastScannedUid = "";
    }
    delay(50);
    return;
  }

  // 3. Baca serial kartu
  if (!rfc.PICC_ReadCardSerial()) {
    delay(50);
    return;
  }

  // 4. Normalisasi UID ke format kanonikal hex uppercase
  String currentUid = normalizeUid(&(rfc.uid));

  // 5. Cegah scan berulang jika kartu masih berada di atas reader
  if (currentUid == lastScannedUid && millis() - lastScanMillis < SCAN_COOLDOWN_MS) {
    // Kartu yang sama masih ditempelkan, abaikan tanpa kirim request
    rfc.PICC_HaltA();
    rfc.PCD_StopCrypto1();
    return;
  }

  // Catat UID dan timestamp pemindaian
  lastScannedUid = currentUid;
  lastScanMillis = millis();

  Serial.println("----------------------------------------");
  Serial.print("Kartu RFID terdeteksi. UID: ");
  Serial.println(currentUid);

  // Kirim data ke backend (umpan balik visual melalui LCD)
  sendAttendanceScan(currentUid);

  // Hentikan komunikasi dengan kartu untuk scan saat ini
  rfc.PICC_HaltA();
  rfc.PCD_StopCrypto1();
}
