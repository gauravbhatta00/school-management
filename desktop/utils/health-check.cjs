'use strict';

const net = require('net');

const EXPECTED_STATUS = 'ok';
const EXPECTED_SERVICE = 'school-management-backend';

/**
 * True if something accepts a TCP connection on host:port. Used to tell
 * "nothing is there" apart from "something is there" before we decide
 * whether it's safe to start Django.
 */
function probePort(host, port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

/**
 * Fetches the health endpoint once and validates the exact expected shape
 * (see backend/config/desktop_views.py::health). Never throws; resolves
 * { ok: true } on a match or { ok: false, reason } otherwise.
 */
async function checkHealthOnce(url, timeoutMs = 1500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return { ok: false, reason: `unexpected HTTP status ${response.status}` };
    }

    let body;
    try {
      body = await response.json();
    } catch {
      return { ok: false, reason: 'response was not valid JSON' };
    }

    if (body?.status !== EXPECTED_STATUS || body?.service !== EXPECTED_SERVICE) {
      return { ok: false, reason: `unexpected response body: ${JSON.stringify(body)}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Polls the health endpoint until it matches the expected shape or the
 * bounded timeout elapses. Never rejects; always resolves { ok, reason }.
 */
async function waitForHealthy(url, { timeoutMs = 30000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastReason = 'timed out before the first health check completed';

  while (Date.now() < deadline) {
    const result = await checkHealthOnce(url, Math.min(intervalMs * 3, 2000));
    if (result.ok) return { ok: true };
    lastReason = result.reason;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return { ok: false, reason: lastReason };
}

/**
 * Bounded TCP-reachability poll, used to wait for the Vite dev server
 * (which has no JSON health endpoint of its own).
 */
async function waitForPortOpen(host, port, { timeoutMs = 30000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probePort(host, port)) return { ok: true };
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return { ok: false, reason: `nothing listening on ${host}:${port} after ${timeoutMs}ms` };
}

module.exports = {
  probePort,
  checkHealthOnce,
  waitForHealthy,
  waitForPortOpen,
  EXPECTED_STATUS,
  EXPECTED_SERVICE,
};
