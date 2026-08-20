"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJstDateString = getJstDateString;
exports.getDateKey = getDateKey;
exports.getCounterId = getCounterId;
exports.calcExpiresAt = calcExpiresAt;
exports.padTicketNumber = padTicketNumber;
// Lambdaの実行環境はUTCで動作するため、JST(UTC+9)の日付として扱う必要がある。
// date.getTime() に9時間を加算してからUTCゲッターで年月日を取り出すことで、
// タイムゾーン設定に依存せずJST基準の日付を求めている。
function toJstParts(date) {
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return {
        year: jst.getUTCFullYear(),
        month: jst.getUTCMonth() + 1,
        day: jst.getUTCDate(),
    };
}
function pad(n) {
    return n.toString().padStart(2, "0");
}
// "2026-08-17" 形式のJST日付文字列を返す
function getJstDateString(date = new Date()) {
    const { year, month, day } = toJstParts(date);
    return `${year}-${pad(month)}-${pad(day)}`;
}
// Ticketsテーブルのパーティションキー用 "DATE#2026-08-17"
function getDateKey(date = new Date()) {
    return `DATE#${getJstDateString(date)}`;
}
// Countersテーブルのパーティションキー用 "COUNTER#2026-08-17"
function getCounterId(date = new Date()) {
    return `COUNTER#${getJstDateString(date)}`;
}
// TTL用: 発券日の翌々日 0:00(JST)のUnixタイムスタンプ(秒)を返す。
// 例: 8/17発券分 → 8/19 00:00 JST が削除対象時刻となる。
// Date.UTCは日をまたぐ加算(月末・年末含む)を自動的に繰り上げてくれるため、
// 「day + 2」「hour -9」をそのまま渡してよい(JSTの0時はUTCでは前日15時のため)。
function calcExpiresAt(date = new Date()) {
    const { year, month, day } = toJstParts(date);
    const utcMillis = Date.UTC(year, month - 1, day + 2, -9, 0, 0);
    return Math.floor(utcMillis / 1000);
}
// ticketNumber(数値)を5桁ゼロ埋め文字列に変換する(範囲Queryのため桁数を揃える)
function padTicketNumber(n) {
    return n.toString().padStart(5, "0");
}
