import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";

const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

/**
 * Transcribes a local audio file URI via OpenAI Whisper API.
 * Supports both native (file://) and web (blob:) URIs.
 * Returns the transcribed text, or null if it fails / empty.
 */
export async function transcribeAudio(
  fileUri: string,
  apiKey: string,
  language = "pt"
): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return await transcribeWeb(fileUri, apiKey, language);
    }
    return await transcribeNative(fileUri, apiKey, language);
  } catch (e) {
    console.warn("[Whisper] Error:", e);
    return null;
  }
}

/**
 * Web: fetch the blob URL, build a proper FormData with a File object,
 * and POST to OpenAI Whisper.
 */
async function transcribeWeb(
  blobUri: string,
  apiKey: string,
  language: string
): Promise<string | null> {
  // Fetch the blob from the blob: URL created by expo-av on web
  const response = await fetch(blobUri);
  const blob = await response.blob();

  const formData = new FormData();
  formData.append("model", "whisper-1");
  formData.append("language", language);
  formData.append("response_format", "json");
  formData.append("file", blob, "recording.webm");

  const res = await fetch(WHISPER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    console.warn("[Whisper] HTTP error", res.status, await res.text());
    return null;
  }

  const json = (await res.json()) as { text?: string };
  return json.text?.trim() || null;
}

/**
 * Native (iOS/Android): read via FileSystem as base64, build multipart
 * body manually (Expo doesn't support FormData with blobs well on native).
 */
async function transcribeNative(
  fileUri: string,
  apiKey: string,
  language: string
): Promise<string | null> {
  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    encoding: "base64" as any,
  });

  const boundary = `----FormdataExpo${Date.now()}`;
  const CRLF = "\\r\\n";

  const ext = fileUri.split(".").pop()?.toLowerCase() ?? "m4a";
  const mimeType = ext === "wav" ? "audio/wav" : ext === "mp3" ? "audio/mpeg" : "audio/m4a";
  const filename = `recording.${ext}`;

  const preamble =
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="model"${CRLF}${CRLF}` +
    `whisper-1${CRLF}` +
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="language"${CRLF}${CRLF}` +
    `${language}${CRLF}` +
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="response_format"${CRLF}${CRLF}` +
    `json${CRLF}` +
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
    `Content-Transfer-Encoding: base64${CRLF}` +
    `Content-Type: ${mimeType}${CRLF}${CRLF}`;
  const postamble = `${CRLF}--${boundary}--${CRLF}`;

  const body = preamble + base64 + postamble;

  const res = await fetch(WHISPER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    console.warn("[Whisper] HTTP error", res.status, await res.text());
    return null;
  }

  const json = (await res.json()) as { text?: string };
  return json.text?.trim() || null;
}
