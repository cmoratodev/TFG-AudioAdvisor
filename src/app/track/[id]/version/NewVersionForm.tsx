'use client';

import { useState, useRef, useCallback, type ChangeEvent, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Loader2 } from 'lucide-react';
import { uploadWithProgress } from '@/lib/upload-with-progress';
import { toast } from '@/store/useToastStore';

const ACCEPTED_EXTENSIONS = ['.wav', '.mp3'];
const ACCEPTED_MIME = ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/mp3'];
const MAX_FILE_SIZE_MB = 50;

function isAcceptedAudio(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return (
    ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext)) || ACCEPTED_MIME.includes(file.type)
  );
}

function probeDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';

    const cleanup = () => {
      URL.revokeObjectURL(url);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('error', onError);
    };
    const onLoaded = () => {
      const d = Number.isFinite(audio.duration) ? audio.duration : undefined;
      cleanup();
      resolve(d);
    };
    const onError = () => {
      cleanup();
      resolve(undefined);
    };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('error', onError);
    audio.src = url;

    setTimeout(() => {
      cleanup();
      resolve(undefined);
    }, 4000);
  });
}

interface Props {
  trackId: string;
}

export function NewVersionForm({ trackId }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const onFileSelected = useCallback((selected: File) => {
    setError(null);
    if (!isAcceptedAudio(selected)) {
      setError('Formato no soportado. Solo se aceptan archivos .WAV y .MP3.');
      return;
    }
    if (selected.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`El archivo supera el límite de ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    setFile(selected);
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (selected) onFileSelected(selected);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const selected = e.dataTransfer.files?.[0];
    if (selected) onFileSelected(selected);
  };

  const submit = async () => {
    if (!file) return;
    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    const duration = await probeDuration(file);
    if (!duration) {
      setError('No se pudo leer la duración del archivo.');
      setIsUploading(false);
      return;
    }

    const form = new FormData();
    form.append('file', file);
    form.append('duration', String(duration));

    try {
      const res = await uploadWithProgress(
        `/api/tracks/${trackId}/versions`,
        form,
        (loaded, total) => {
          setUploadProgress(total > 0 ? loaded / total : 0);
        },
      );

      if (!res.ok) {
        let message = 'No se pudo subir la versión.';
        try {
          const data = JSON.parse(res.bodyText) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          // Body wasn't JSON — keep the default message.
        }
        setError(message);
        setIsUploading(false);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red durante la subida.');
      setIsUploading(false);
      return;
    }

    setIsUploading(false);
    toast.success('Nueva versión publicada', 'Los comentarios anteriores siguen accesibles.');
    router.push(`/track/${trackId}`);
    router.refresh();
  };

  return (
    <>
      <div
        onClick={() => !file && fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!file) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        role={file ? undefined : 'button'}
        tabIndex={file ? -1 : 0}
        onKeyDown={(e) => {
          if (!file && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        aria-label="Zona para subir el nuevo archivo de audio"
        className={`border-2 border-dashed rounded-xl p-10 transition-all flex flex-col items-center justify-center text-center group min-h-[220px] shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 ${
          file
            ? 'border-zinc-200 bg-zinc-50'
            : isDragging
              ? 'border-zinc-950 bg-zinc-50 cursor-pointer'
              : 'border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 cursor-pointer'
        }`}
      >
        {file ? (
          <>
            <div className="w-14 h-14 rounded-full bg-zinc-950 text-white flex items-center justify-center mb-4">
              <Upload size={22} />
            </div>
            <h3 className="font-semibold text-lg mb-1 break-all">{file.name}</h3>
            <p className="text-xs text-zinc-500 mb-3 font-mono">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
              className="text-xs font-medium text-zinc-600 hover:text-zinc-950 underline"
            >
              Elegir otro archivo
            </button>
          </>
        ) : (
          <>
            {isUploading ? (
              <Loader2 size={36} className="animate-spin text-zinc-400 mb-4" />
            ) : (
              <Upload size={36} className="text-zinc-400 group-hover:text-zinc-950 transition-colors mb-4" />
            )}
            <h3 className="font-semibold text-base mb-1">
              {isDragging ? 'Suelta para añadir' : 'Haz clic o arrastra el archivo'}
            </h3>
            <p className="text-sm text-zinc-500">
              .WAV / .MP3 · Máx. {MAX_FILE_SIZE_MB} MB
            </p>
          </>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".wav,.mp3,audio/wav,audio/mpeg"
          className="hidden"
        />
      </div>

      {file && (
        <>
          <button
            type="button"
            onClick={submit}
            disabled={isUploading}
            className="mt-6 w-full h-11 rounded-lg bg-zinc-950 text-white font-medium hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isUploading && <Loader2 size={16} className="animate-spin" />}
            {isUploading ? 'Subiendo…' : 'Publicar nueva versión'}
          </button>

          {isUploading && (
            <div className="mt-3 space-y-1.5" aria-live="polite">
              <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full bg-zinc-950 transition-[width] duration-150 ease-out"
                  style={{ width: `${Math.round(uploadProgress * 100)}%` }}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(uploadProgress * 100)}
                  aria-label="Progreso de subida"
                />
              </div>
              <p className="text-xs text-zinc-500 font-mono tabular-nums text-right">
                {uploadProgress >= 1
                  ? 'Procesando audio en el servidor…'
                  : `${Math.round(uploadProgress * 100)}%`}
              </p>
            </div>
          )}
        </>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 text-sm text-red-600 font-medium px-4 py-3 bg-red-50 border border-red-200 rounded-lg"
        >
          {error}
        </div>
      )}
    </>
  );
}
