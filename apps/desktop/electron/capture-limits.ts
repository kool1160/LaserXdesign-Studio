/**
 * Single source of truth for privileged capture size limits (M14 G5).
 *
 * The IPC schema, the pre-dialog check in the controller, and the privileged
 * writer all derive from these constants. Defining the ceiling in only one
 * place is the point: three independently written limits would drift, and a
 * payload permitted by the schema but rejected by the writer would prompt
 * the user for a destination before failing.
 *
 * Deliberately free of Node imports so the schema module can share it
 * without pulling filesystem APIs into the preload bundle.
 */

/** 64 MiB: far above any realistic preview capture, far below memory risk. */
export const MAX_CAPTURE_BYTES = 64 * 1024 * 1024;

/**
 * Exact base64 length of `MAX_CAPTURE_BYTES`: base64 encodes each 3-byte
 * group as 4 characters, padding the final group. Derived rather than
 * hand-tuned so the transport ceiling cannot drift from the byte ceiling.
 */
export const MAX_CAPTURE_BASE64_LENGTH = Math.ceil(MAX_CAPTURE_BYTES / 3) * 4;
