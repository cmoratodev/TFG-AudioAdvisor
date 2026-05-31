/**
 * Streaming POST with real byte-level progress.
 *
 * `fetch` only exposes progress on the download side. For upload progress we
 * need `XMLHttpRequest.upload.onprogress`, so this helper wraps it in a
 * Promise that resolves with a Response-ish shape. Callers can keep treating
 * it as an ordinary HTTP call.
 */
export interface ProgressResponse {
  ok: boolean
  status: number
  bodyText: string
}

export function uploadWithProgress(
  url: string,
  body: FormData,
  onProgress: (loaded: number, total: number) => void,
): Promise<ProgressResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total)
    }
    xhr.onload = () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        bodyText: xhr.responseText,
      })
    }
    xhr.onerror = () => reject(new Error('Error de red'))
    xhr.onabort = () => reject(new Error('Subida cancelada'))
    xhr.send(body)
  })
}
