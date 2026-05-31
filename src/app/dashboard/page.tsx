'use client';

import { useState, useRef, useCallback, useEffect, type ChangeEvent, type DragEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Upload, Loader2, AudioLines, MessageSquareText, TrendingUp, Music, Tag, Clock, Image as ImageIcon } from 'lucide-react';
import { uploadWithProgress } from '@/lib/upload-with-progress';
import { toast } from '@/store/useToastStore';

const ACCEPTED_EXTENSIONS = ['.wav', '.mp3'];
const ACCEPTED_MIME = ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/mp3'];
const MAX_FILE_SIZE_MB = 50;

const ACCEPTED_COVER_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_COVER_MB = 5;

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
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState<string>('Otro');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Object-URL bookkeeping for the cover preview thumbnail. Revoke the
  // previous URL when the file changes so we don't leak blob handles.
  // The `set-state-in-effect` rule flags any setState inside an effect, but
  // here the state literally mirrors an external resource (a Blob URL) that
  // needs a cleanup callback — exactly what useEffect is for.
  useEffect(() => {
    if (!coverFile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

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

  const onCoverSelected = useCallback((selected: File) => {
    setError(null);
    if (!ACCEPTED_COVER_MIME.includes(selected.type)) {
      setError('Portada no soportada. Usa JPG, PNG o WebP.');
      return;
    }
    if (selected.size > MAX_COVER_MB * 1024 * 1024) {
      setError(`La portada supera ${MAX_COVER_MB} MB.`);
      return;
    }
    setCoverFile(selected);
  }, []);

  const handleCoverChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (selected) onCoverSelected(selected);
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
    setUploadProgress(0);

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
    if (coverFile) form.append('cover', coverFile);

    try {
      const res = await uploadWithProgress('/api/tracks', form, (loaded, total) => {
        setUploadProgress(total > 0 ? loaded / total : 0);
      });

      if (!res.ok) {
        let message = 'No se pudo subir la pista.';
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
    toast.success('Pista publicada', 'Ya está disponible para feedback.');
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
    <div className="container mx-auto max-w-6xl px-4 sm:px-8 py-12 min-h-[calc(100vh-4rem)]">
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">Subir Pista</h1>
        <p className="text-zinc-500 font-medium text-lg">
          Añade una nueva pista para recibir feedback técnico preciso.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-12 lg:gap-24 items-start">
        <div>
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
        className={`border-2 border-dashed rounded-2xl p-12 sm:p-16 transition-all flex flex-col items-center justify-center text-center group min-h-[420px] shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 ${
          file
            ? 'border-zinc-200 bg-zinc-50'
            : isDragging
              ? 'border-zinc-950 bg-zinc-50 cursor-pointer'
              : 'border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 cursor-pointer'
        }`}
      >
        {file ? (
          <>
            <div className="w-20 h-20 rounded-full bg-zinc-950 text-white flex items-center justify-center mb-6">
              <Upload size={32} />
            </div>
            <h3 className="font-semibold text-xl mb-2 break-all max-w-md">{file.name}</h3>
            <p className="text-sm text-zinc-500 mb-5 font-mono">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                setTitle('');
                setCoverFile(null);
              }}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-950 underline"
            >
              Elegir otro archivo
            </button>
          </>
        ) : (
          <>
            {isUploading ? (
              <Loader2 size={56} className="animate-spin text-zinc-400 mb-6" />
            ) : (
              <Upload size={56} className="text-zinc-400 group-hover:text-zinc-950 transition-colors mb-6" />
            )}
            <h3 className="font-semibold text-xl sm:text-2xl mb-3">
              {isDragging ? 'Suelta para añadir' : 'Haz clic o arrastra el archivo'}
            </h3>
            <p className="text-base text-zinc-500 max-w-sm">
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

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
              Portada{' '}
              <span className="text-zinc-400 normal-case font-normal tracking-normal">
                (opcional)
              </span>
            </label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="relative w-20 h-20 rounded-lg border border-zinc-200 bg-zinc-50 hover:border-zinc-950 hover:bg-white transition-colors flex items-center justify-center overflow-hidden shrink-0 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2"
                aria-label={coverPreview ? 'Cambiar portada' : 'Subir portada'}
              >
                {coverPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverPreview}
                    alt="Vista previa de la portada"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon size={22} className="text-zinc-400" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                {coverFile ? (
                  <>
                    <p className="text-sm font-medium text-zinc-950 truncate">
                      {coverFile.name}
                    </p>
                    <p className="text-xs text-zinc-500 font-mono">
                      {(coverFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <button
                      type="button"
                      onClick={() => setCoverFile(null)}
                      className="mt-1 text-xs font-medium text-zinc-500 hover:text-zinc-950 underline"
                    >
                      Quitar
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-zinc-500 leading-relaxed">
                    Sin portada usaremos una por defecto según el género.{' '}
                    <span className="text-zinc-400">JPG, PNG o WebP · Máx. 5 MB</span>
                  </p>
                )}
              </div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleCoverChange}
                className="hidden"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={isUploading || !title.trim()}
            className="w-full h-10 rounded-lg bg-zinc-950 text-white font-medium hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isUploading && <Loader2 size={16} className="animate-spin" />}
            {isUploading ? 'Subiendo…' : 'Publicar pista'}
          </button>

          {isUploading && (
            <div className="space-y-1.5" aria-live="polite">
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

        {/* Info sidebar — gives the page enough weight that the footer
            doesn't dominate when the dropzone is empty, while teaching the
            user what to expect after publishing. The left border (visible
            only on lg+) acts as the divider between columns; combined with
            pl-12 it carves a generous, intentional gutter. */}
        <aside className="space-y-8 lg:sticky lg:top-24 lg:border-l lg:border-zinc-200 lg:pl-16">
          <InfoCard
            title="Qué pasa al publicar"
            steps={[
              {
                icon: AudioLines,
                title: 'Análisis automático',
                body:
                  'Detectamos clipping, picos, silencios, dinámica baja y problemas espectrales en segundos.',
              },
              {
                icon: MessageSquareText,
                title: 'Feedback ancla­do al segundo',
                body:
                  'Otros productores comentan haciendo clic en la onda. Cada hallazgo apunta a un instante exacto.',
              },
              {
                icon: TrendingUp,
                title: 'XP y rangos',
                body:
                  'Cada Útil que marques o recibas suma puntos. De Hierro a Leyenda según tu actividad.',
              },
            ]}
          />

          <TipsCard
            title="Para conseguir más feedback"
            tips={[
              { icon: Music, text: 'WAV da mejor análisis que MP3 — más datos, menos artefactos.' },
              { icon: Tag, text: 'Etiqueta el género correcto para llegar al oyente adecuado.' },
              { icon: Clock, text: 'Pistas de 1–5 min reciben respuesta más rápido que tracks largos.' },
            ]}
          />
        </aside>
      </div>
    </div>
  );
}

interface Step {
  icon: typeof AudioLines;
  title: string;
  body: string;
}

function InfoCard({ title, steps }: { title: string; steps: Step[] }) {
  return (
    <div>
      <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-5">
        {title}
      </h2>
      <ol className="space-y-6">
        {steps.map(({ icon: Icon, title: stepTitle, body }, idx) => (
          <li key={stepTitle} className="flex gap-4">
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 flex items-center justify-center">
                <Icon size={20} />
              </div>
              {idx < steps.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-1/2 -translate-x-1/2 top-12 bottom-[-1.5rem] w-px bg-zinc-200"
                />
              )}
            </div>
            <div className="min-w-0 pb-2">
              <p className="text-base font-semibold text-zinc-950">{stepTitle}</p>
              <p className="text-sm text-zinc-600 leading-relaxed mt-1">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

interface Tip {
  icon: typeof AudioLines;
  text: ReactNode;
}

function TipsCard({ title, tips }: { title: string; tips: Tip[] }) {
  return (
    <div className="pt-6 border-t border-zinc-200">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-5">
        {title}
      </h2>
      <ul className="space-y-5">
        {tips.map(({ icon: Icon, text }, idx) => (
          <li
            key={idx}
            className="flex gap-3 items-start text-base text-zinc-700 leading-relaxed"
          >
            <Icon size={18} className="text-zinc-400 shrink-0 mt-1" aria-hidden />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
