'use client';

import { useState, useRef, useCallback, useEffect, type ChangeEvent, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Upload, Loader2 } from 'lucide-react';

const ACCEPTED_EXTENSIONS = ['.wav', '.mp3'];
const ACCEPTED_MIME = ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/mp3'];
const MAX_FILE_SIZE_MB = 50;

const GENRES = ['Electrónica', 'Pop', 'Hip Hop', 'Acústico', 'Jazz', 'Rock', 'Otro'] as const;

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

export default function DashboardPage() {
  const router = useRouter();
  const { status } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState<string>('Otro');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin?callbackUrl=/dashboard');
    }
  }, [status, router]);

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
    setTitle((curr) => curr || selected.name.replace(/\.[^/.]+$/, ''));
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
    if (!file || !title.trim()) return;
    setError(null);
    setIsUploading(true);

    const duration = await probeDuration(file);
    if (!duration) {
      setError('No se pudo leer la duración del archivo.');
      setIsUploading(false);
      return;
    }

    const form = new FormData();
    form.append('file', file);
    form.append('title', title.trim());
    form.append('genre', genre);
    form.append('duration', String(duration));

    const res = await fetch('/api/tracks', { method: 'POST', body: form });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? 'No se pudo subir la pista.');
      setIsUploading(false);
      return;
    }

    setIsUploading(false);
    router.push('/my-tracks');
    router.refresh();
  };

  if (status === 'loading') {
    return (
      <div className="container py-10 max-w-2xl mx-auto">
        <div className="h-72 bg-zinc-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="container py-10 max-w-2xl mx-auto px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Subir Pista</h1>
        <p className="text-zinc-500 font-medium">Añade una nueva pista para recibir feedback preciso.</p>
      </div>

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
        aria-label="Zona para subir archivo de audio"
        className={`border-2 border-dashed rounded-xl p-10 transition-all flex flex-col items-center justify-center text-center group min-h-[240px] shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 ${
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
            <h3 className="font-semibold text-lg mb-1">{file.name}</h3>
            <p className="text-xs text-zinc-500 mb-3 font-mono">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                setTitle('');
              }}
              className="text-xs font-medium text-zinc-600 hover:text-zinc-950 underline"
            >
              Elegir otro archivo
            </button>
          </>
        ) : (
          <>
            {isUploading ? (
              <Loader2 size={40} className="animate-spin text-zinc-400 mb-4" />
            ) : (
              <Upload size={40} className="text-zinc-400 group-hover:text-zinc-950 transition-colors mb-4" />
            )}
            <h3 className="font-semibold text-lg mb-1">
              {isDragging ? 'Suelta para añadir' : 'Haz clic o arrastra el archivo'}
            </h3>
            <p className="text-sm text-zinc-500 max-w-sm">
              Formatos: <span className="font-mono">.WAV</span>,{' '}
              <span className="font-mono">.MP3</span> · Máx. {MAX_FILE_SIZE_MB} MB
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
        <div className="mt-6 space-y-4 bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <div>
            <label
              htmlFor="title"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5"
            >
              Título
            </label>
            <input
              id="title"
              type="text"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Midnight Echoes"
              className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 transition"
            />
          </div>
          <div>
            <label
              htmlFor="genre"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5"
            >
              Género
            </label>
            <select
              id="genre"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 transition"
            >
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={isUploading || !title.trim()}
            className="w-full h-10 rounded-lg bg-zinc-950 text-white font-medium hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isUploading && <Loader2 size={16} className="animate-spin" />}
            {isUploading ? 'Subiendo a Supabase...' : 'Publicar pista'}
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 text-sm text-red-600 font-medium px-4 py-3 bg-red-50 border border-red-200 rounded-lg"
        >
          {error}
        </div>
      )}
    </div>
  );
}
