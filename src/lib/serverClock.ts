/*
 * The server's clock, estimated from API responses.
 *
 * A shared session stores absolute times ("the shot clock runs out at T").
 * Phone clocks can be seconds apart, so every phone uses the server's time
 * instead. Then they all show the same number of seconds left.
 */

let offset = 0
/** Round trip of the best sample so far. A shorter round trip gives a better estimate. */
let bestRtt = Infinity

/**
 * Current time on the server, in whole epoch ms (the API stores integers).
 * Falls back to this phone's clock until synced.
 */
export function serverNow() {
  return Math.round(Date.now() + offset)
}

/**
 * Learn from a response that carried `serverTime`, for a request sent at
 * `sentAt` and answered at `receivedAt` (both `Date.now()`).
 */
export function syncServerClock(serverTime: number, sentAt: number, receivedAt: number) {
  const rtt = receivedAt - sentAt
  if (!Number.isFinite(serverTime) || rtt < 0) return
  // Slowly forget the old best, so a phone that switched networks still adapts.
  bestRtt += 20
  if (rtt > bestRtt) return
  bestRtt = rtt
  // The server read its clock about halfway through the round trip.
  offset = serverTime + rtt / 2 - receivedAt
}
