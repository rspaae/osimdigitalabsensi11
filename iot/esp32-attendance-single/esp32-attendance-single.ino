/*
 * OSIS MPK SMKN 11 BANDUNG — Attendance Scanner (Single File Version)
 * Hardware: ESP32 DevKit V1 + RC522 RFID + LCD 16x2 I2C
 *
 * Wiring:
 *   RC522: SDA→5, SCK→18, MOSI→23, MISO→19, RST→4, GND→GND, 3.3V→3.3V
 *   LCD I2C: SDA→21, SCL→22, VCC→5V, GND→GND
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

// Kredensial Wi-Fi & perangkat (WIFI_SSID, WIFI_PASSWORD, DEVICE_CODE,
// DEVICE_API_KEY) dibaca dari secrets.h yang diabaikan Git.
#include "secrets.h"

// ============================================================================
// KONFIGURASI
// ============================================================================

// Server
#define SERVER_BASE_URL  "https://osimdigitalabsensi11.vercel.app"
#define ALLOW_LOCAL_HTTP 0

// ============================================================================
// PIN & KONSTANTA HARDWARE
// ============================================================================

#define RFID_SS_PIN   5
#define RFID_RST_PIN  4
#define LCD_I2C_ADDR  0x27
#define LCD_COLS      16
#define LCD_ROWS      2

#define API_SCAN_PATH        "/api/v1/attendance/scan"
#define API_HEARTBEAT_PATH   "/api/v1/devices/heartbeat"

#define WIFI_TIMEOUT_MS         15000
#define HTTP_TIMEOUT_MS         10000
#define SCAN_COOLDOWN_MS        3000
#define CARD_REMOVAL_DELAY_MS   1500
#define MAX_HTTP_RETRIES        2
#define HEARTBEAT_INTERVAL_MS   15000

// ============================================================================
// ROOT CA — GTS Root R1 (Google Trust Services) & ISRG Root X1
// Vercel domain *.vercel.app menggunakan Google Trust Services (GTS Root R1).
// ============================================================================

const char* SERVER_ROOT_CA = \
"-----BEGIN CERTIFICATE-----\n" \
"MIIFVzCCAz+gAwIBAgINAgPlk28xsBNJiGuiFzANBgkqhkiG9w0BAQwFADBHMQsw\n" \
"CQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEU\n" \
"MBIGA1UEAxMLR1RTIFJvb3QgUjEwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAw\n" \
"MDAwWjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZp\n" \
"Y2VzIExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjEwggIiMA0GCSqGSIb3DQEBAQUA\n" \
"A4ICDwAwggIKAoICAQC2EQKLHuOhd5s73L+UPreVp0A8of2C+X0yBoJx9vaMf/vo\n" \
"27xqLpeXo4xL+Sv2sfnOhB2x+cWX3u+58qPpvBKJXqeqUqv4IyfLpLGcY9vXmX7w\n" \
"Cl7raKb0xlpHDU0QM+NOsROjyBhsS+z8CZDfnWQpJSMHobTSPS5g4M/SCYe7zUjw\n" \
"TcLCeoiKu7rPWRnWr4+wB7CeMfGCwcDfLqZtbBkOtdh+JhpFAz2weaSUKK0Pfybl\n" \
"qAj+lug8aJRT7oM6iCsVlgmy4HqMLnXWnOunVmSPlk9orj2XwoSPwLxAwAtcvfaH\n" \
"szVsrBhQf4TgTM2S0yDpM7xSma8ytSmzJSq0SPly4cpk9+aCEI3oncKKiPo4Zor8\n" \
"Y/kB+Xj9e1x3+naH+uzfsQ55lVe0vSbv1gHR6xYKu44LtcXFilWr06zqkUspzBmk\n" \
"MiVOKvFlRNACzqrOSbTqn3yDsEB750Orp2yjj32JgfpMpf/VjsPOS+C12LOORc92\n" \
"wO1AK/1TD7Cn1TsNsYqiA94xrcx36m97PtbfkSIS5r762DL8EGMUUXLeXdYWk70p\n" \
"aDPvOmbsB4om3xPXV2V4J95eSRQAogB/mqghtqmxlbCluQ0WEdrHbEg8QOB+DVrN\n"
"VjzRlwW5y0vtOUucxD/SVRNuJLDWcfr0wbrM7Rv1/oFB2ACYPTrIrnqYNxgFlQID\n" \
"AQABo0IwQDAOBgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4E\n" \
"FgQU5K8rJnEaK0gnhS9SZizv8IkTcT4wDQYJKoZIhvcNAQEMBQADggIBAJ+qQibb\n" \
"C5u+/x6Wki4+omVKapi6Ist9wTrYggoGxval3sBOh2Z5ofmmWJyq+bXmYOfg6LEe\n" \
"QkEzCzc9zolwFcq1JKjPa7XSQCGYzyI0zzvFIoTgxQ6KfF2I5DUkzps+GlQebtuy\n" \
"h6f88/qBVRRiClmpIgUxPoLW7ttXNLwzldMXG+gnoot7TiYaelpkttGsN/H9oPM4\n" \
"7HLwEXWdyzRSjeZ2axfG34arJ45JK3VmgRAhpuo+9K4l/3wV3s6MJT/KYnAK9y8J\n" \
"ZgfIPxz88NtFMN9iiMG1D53Dn0reWVlHxYciNuaCp+0KueIHoI17eko8cdLiA6Ef\n" \
"MgfdG+RCzgwARWGAtQsgWSl4vflVy2PFPEz0tv/bal8xa5meLMFrUKTX5hgUvYU/\n" \
"Z6tGn6D/Qqc6f1zLXbBwHSs09dR2CQzreExZBfMzQsNhFRAbd03OIozUhfJFfbdT\n" \
"6u9AWpQKXCBfTkBdYiJ23//OYb2MI3jSNwLgjt7RETeJ9r/tSQdirpLsQBqvFAnZ\n" \
"0E6yove+7u7Y/9waLd64NnHi/Hm3lCXRSHNboTXns5lndcEZOitHTtNCjv0xyBZm\n" \
"2tIMPNuzjsmhDYAPexZ3FL//2wmUspO8IFgV6dtxQ/PeEMMA3KgqlbbC1j+Qa3bb\n" \
"bP6MvPJwNQzcmRk13NfIRmPVNnGuV/u3gm3c\n" \
"-----END CERTIFICATE-----\n" \
"-----BEGIN CERTIFICATE-----\n" \
"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\n" \
"-----END CERTIFICATE-----\n";

// ============================================================================
// INISIALISASI HARDWARE
// ============================================================================

LiquidCrystal_I2C lcd(LCD_I2C_ADDR, LCD_COLS, LCD_ROWS);
MFRC522 rfc(RFID_SS_PIN, RFID_RST_PIN);
WiFiClientSecure secureClient;
WiFiClient localClient;

String lastScannedUid = "";
unsigned long lastScanMillis = 0;
unsigned long lastHeartbeatMillis = 0;

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Menulis satu baris LCD tanpa lcd.clear() agar tampilan tidak berkedip.
 * Sisa karakter lama ditimpa spasi sampai penuh LCD_COLS kolom.
 */
void printLcdLine(uint8_t row, const String &text) {
  lcd.setCursor(0, row);
  String line = text.substring(0, LCD_COLS);
  while (line.length() < LCD_COLS) {
    line += ' ';
  }
  lcd.print(line);
}

void displayLcd(const String &line1, const String &line2) {
  printLcdLine(0, line1);
  printLcdLine(1, line2);
}

/**
 * Layar saat menunggu respons server.
 * UID kartu SENGAJA tidak ditampilkan di LCD (hanya di Serial Monitor)
 * agar kode kartu tidak terbaca orang lain di depan perangkat.
 */
void showScanningScreen() {
  displayLcd("Scanning...", "Mohon tunggu");
}

void showReadyScreen() {
  displayLcd("ABSENSI DIGITAL", "Silahkan Tap....");
}

// ============================================================================
// WIFI
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
    while (now < 1700000000 && retryTime < 20) { // Menunggu hingga melewati thn 2023+
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
// HTTP HELPER
// ============================================================================

bool beginServerRequest(HTTPClient &client, const String &url) {
  if (url.startsWith("https://")) {
    secureClient.stop(); // Bersihkan socket lama sebelum koneksi baru
    secureClient.setCACert(SERVER_ROOT_CA);
    secureClient.setTimeout(HTTP_TIMEOUT_MS / 1000);
    return client.begin(secureClient, url);
  }

#if defined(ALLOW_LOCAL_HTTP) && ALLOW_LOCAL_HTTP
  if (url.startsWith("http://")) {
    Serial.println("PERINGATAN: HTTP lokal aktif; API key tidak terenkripsi.");
    return client.begin(localClient, url);
  }
#endif

  Serial.println("URL ditolak. HTTPS wajib.");
  return false;
}

// ============================================================================
// RFID UID NORMALIZATION
// ============================================================================

String normalizeUid(MFRC522::Uid *uid) {
  String normalized = "";
  for (byte i = 0; i < uid->size; i++) {
    if (uid->uidByte[i] < 0x10) normalized += "0";
    normalized += String(uid->uidByte[i], HEX);
  }
  normalized.toUpperCase();
  return normalized;
}

// ============================================================================
// ATTENDANCE SCAN
// ============================================================================

void sendAttendanceScan(const String &rfidUid) {
  if (WiFi.status() != WL_CONNECTED) {
    displayLcd("Koneksi Putus!", "Reconnecting...");
    delay(1000);
    connectWifi();
    return;
  }

  // UID tidak ditampilkan di LCD; hanya "Scanning..." lalu hasil nama/status.
  showScanningScreen();

  HTTPClient https;
  String targetUrl = String(SERVER_BASE_URL) + String(API_SCAN_PATH);

  if (!beginServerRequest(https, targetUrl)) {
    displayLcd("Server Error", "Cek URL/Mode");
    delay(2000);
    showReadyScreen();
    return;
  }

  https.addHeader("Content-Type", "application/json");
  https.addHeader("Authorization", "Bearer " + String(DEVICE_API_KEY));
  https.setTimeout(HTTP_TIMEOUT_MS);

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
      Serial.printf("HTTP gagal, retry %d/%d\n", retries, MAX_HTTP_RETRIES);
      delay(500);
    }
  }

  if (httpCode <= 0) {
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
    displayLcd("RESPON RUSAK", "JSON Malformed");
    delay(2500);
    https.end();
    showReadyScreen();
    return;
  }

  if (httpCode == 200 || httpCode == 201) {
    bool isSuccess = resDoc["success"] | false;
    if (isSuccess && resDoc.containsKey("data")) {
      const char* memberName = resDoc["data"]["member_name"] | "Anggota";
      const char* status     = resDoc["data"]["status"]      | "HADIR";
      bool isDuplicate       = resDoc["data"]["is_duplicate"] | false;

      Serial.printf("Sukses: %s - %s (dup: %d)\n", memberName, status, isDuplicate);

      String statusStr = String(status);
      if (isDuplicate) {
        displayLcd(String(memberName), statusStr == "DI_LUAR_JADWAL" ? "DI LUAR JADWAL" : "SUDAH: " + statusStr);
      } else {
        if (statusStr == "DI_LUAR_JADWAL")  displayLcd(String(memberName), "DI LUAR JADWAL");
        else if (statusStr == "TERLAMBAT")  displayLcd(String(memberName), "STATUS:TERLAMBAT");
        else                                displayLcd(String(memberName), "STATUS: " + statusStr);
      }
    } else {
      displayLcd("GAGAL PRESENSI", "Data Tdk Valid");
    }
  } else {
    const char* errCode = resDoc["code"] | "";
    Serial.printf("API Error [%d | %s]\n", httpCode, errCode);
    String codeStr = String(errCode);

    if      (codeStr == "CUTOFF_TIME_EXCEEDED") displayLcd("BATAS WKT HABIS", "Absensi Ditutup");
    else if (codeStr == "SCHEDULE_NO_MATCH")    displayLcd("JADWAL TDK ADA",  "Cek Jam Piket");
    else if (codeStr == "SCHEDULE_AMBIGUOUS")   displayLcd("JADWAL BENTROK",   "Hubungi Admin");
    else if (codeStr == "CYCLE_NOT_CONFIGURED") displayLcd("SIKLUS TDK ADA",  "Set di Dashboard");
    else if (codeStr == "ACTIVITY_CANCELLED")   displayLcd("KEGIATAN LIBUR",  "Tidak Ada Piket");
    else if (codeStr == "DEVICE_AUTH_FAILED" || httpCode == 401) displayLcd("DEVICE DITOLAK", "Auth Key Salah");
    else if (codeStr == "DEVICE_INACTIVE")      displayLcd("DEVICE NONAKTIF", "Hubungi Admin");
    else if (codeStr == "MEMBER_NOT_FOUND")     displayLcd("KARTU DITOLAK",   "Belum Terdaftar");
    else if (codeStr == "MEMBER_INACTIVE")      displayLcd("ANGGOTA NONAKTIF","Hubungi Admin");
    else if (codeStr == "VALIDATION_ERROR")     displayLcd("FORMAT SALAH",    "Cek Data Kartu");
    else                                        displayLcd("SERVER ERROR",     "Hubungi Admin");
  }

  delay(SCAN_COOLDOWN_MS);
  https.end();
  showReadyScreen();
}

// ============================================================================
// HEARTBEAT
// ============================================================================

void sendDeviceHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String targetUrl = String(SERVER_BASE_URL) + String(API_HEARTBEAT_PATH);
  if (!beginServerRequest(http, targetUrl)) return;

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
    bool ok = !deserializeJson(resDoc, response) && (resDoc["success"] | false);
    Serial.printf("Heartbeat HTTP %d: %s\n", status, ok ? "terhubung" : "ditolak");
  } else {
    Serial.printf("Heartbeat gagal: %s\n", http.errorToString(status).c_str());
  }
  http.end();
}

// ============================================================================
// SETUP & LOOP
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n--- OSIS MPK SMKN 11 BANDUNG: ATTENDANCE SCANNER ---");

  Wire.begin();
  lcd.init();
  lcd.backlight();
  displayLcd("ABSENSI DIGITAL", "OSIM");
  delay(1200);

  SPI.begin();
  rfc.PCD_Init();
  delay(100);

  byte version = rfc.PCD_ReadRegister(rfc.VersionReg);
  if (version == 0x00 || version == 0xFF) {
    Serial.println("MFRC522 tidak terdeteksi! Periksa kabel SPI.");
    displayLcd("RFID RC522 Error", "Periksa Kabel!");
    delay(2000);
  } else {
    Serial.printf("MFRC522 OK (v0x%02X)\n", version);
  }

  connectWifi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
    return;
  }

  if (lastHeartbeatMillis == 0 || millis() - lastHeartbeatMillis >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatMillis = millis();
    sendDeviceHeartbeat();
  }

  if (!rfc.PICC_IsNewCardPresent()) {
    if (lastScannedUid != "" && millis() - lastScanMillis > CARD_REMOVAL_DELAY_MS) {
      lastScannedUid = "";
    }
    delay(50);
    return;
  }

  if (!rfc.PICC_ReadCardSerial()) {
    delay(50);
    return;
  }

  String currentUid = normalizeUid(&(rfc.uid));

  if (currentUid == lastScannedUid && millis() - lastScanMillis < SCAN_COOLDOWN_MS) {
    rfc.PICC_HaltA();
    rfc.PCD_StopCrypto1();
    return;
  }

  lastScannedUid = currentUid;
  lastScanMillis = millis();

  Serial.println("----------------------------------------");
  Serial.print("Kartu RFID terdeteksi. UID: ");
  Serial.println(currentUid);

  sendAttendanceScan(currentUid);

  rfc.PICC_HaltA();
  rfc.PCD_StopCrypto1();
}
