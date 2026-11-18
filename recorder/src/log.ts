// Timestamped logging. systemd keeps these: `journalctl -u flowstate-recorder -f`.
const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19)
export const log = {
  info: (...a: unknown[]) => console.log(stamp(), 'INFO ', ...a),
  warn: (...a: unknown[]) => console.warn(stamp(), 'WARN ', ...a),
  error: (...a: unknown[]) => console.error(stamp(), 'ERROR', ...a),
}
export const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))
