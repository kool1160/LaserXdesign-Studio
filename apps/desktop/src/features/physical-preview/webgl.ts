export function isWebglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return (
      canvas.getContext("webgl2") !== null || canvas.getContext("webgl") !== null
    );
  } catch {
    return false;
  }
}
