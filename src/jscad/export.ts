import { objSerializer, stlSerializer } from "@jscad/io";

export type JscadExportFormat = "stl" | "obj";

export type ExportedFile = {
  extension: "stl" | "obj";
  mime: string;
  filename: string;
  bytes: Uint8Array;
};

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function exportGeometryToFile(
  geometry: any,
  format: JscadExportFormat,
  name = "model"
): ExportedFile {
  const safeName = (name || "model").replace(/[^a-zA-Z0-9._-]+/g, "_");

  if (format === "stl") {
    const parts = stlSerializer.serialize({ binary: false }, geometry);
    const text = Array.isArray(parts) ? parts.join("") : String(parts);
    return {
      extension: "stl",
      mime: "model/stl",
      filename: `${safeName}.stl`,
      bytes: encodeUtf8(text),
    };
  }

  const parts = objSerializer.serialize({}, geometry);
  const text = Array.isArray(parts) ? parts.join("") : String(parts);
  return {
    extension: "obj",
    mime: "model/obj",
    filename: `${safeName}.obj`,
    bytes: encodeUtf8(text),
  };
}

