import { useEffect, useRef, useState } from 'react';

interface ProgressiveMediaPreviewProps {
  alt: string;
  className?: string;
  eager?: boolean;
  kind: 'image' | 'video' | 'document' | 'other';
  lqipDataUrl?: string | null;
  onOpen?: () => void;
  posterUrl?: string | null;
  previewUrl?: string | null;
}

export function ProgressiveMediaPreview({
  alt,
  className = '',
  eager = false,
  kind,
  lqipDataUrl,
  onOpen,
  posterUrl,
  previewUrl,
}: ProgressiveMediaPreviewProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(eager);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (eager || !ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '600px 0px' },
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [eager]);

  const interactive = Boolean(onOpen);
  const resolvedImageUrl = kind === 'image' ? previewUrl : posterUrl;

  return (
    <div ref={ref} className={`relative w-full h-full overflow-hidden bg-muted/40 ${className}`}>
      {!isReady && (
        <div
          className="absolute inset-0 cv-media-shell"
          style={lqipDataUrl ? { backgroundImage: `url(${lqipDataUrl})` } : undefined}
        >
          <div className="absolute inset-0 cv-shimmer opacity-40" />
        </div>
      )}

      {shouldLoad && kind === 'image' && resolvedImageUrl && (
        interactive ? (
          <button type="button" onClick={onOpen} className="block w-full h-full">
            <img
              src={resolvedImageUrl}
              alt={alt}
              loading={eager ? 'eager' : 'lazy'}
              decoding="async"
              fetchPriority={eager ? 'high' : 'auto'}
              className={`w-full h-full object-cover transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`}
              onLoad={(event) => {
                event.currentTarget.decode?.().catch(() => undefined).finally(() => setIsReady(true));
              }}
            />
          </button>
        ) : (
          <img
            src={resolvedImageUrl}
            alt={alt}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={eager ? 'high' : 'auto'}
            className={`w-full h-full object-cover transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`}
            onLoad={(event) => {
              event.currentTarget.decode?.().catch(() => undefined).finally(() => setIsReady(true));
            }}
          />
        )
      )}

      {shouldLoad && kind === 'video' && previewUrl && (
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster={posterUrl ?? undefined}
          className={`w-full h-full object-cover transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`}
          onLoadedData={() => setIsReady(true)}
          onClick={onOpen}
        >
          <source src={previewUrl} />
        </video>
      )}

      {shouldLoad && kind === 'video' && !previewUrl && posterUrl && (
        interactive ? (
          <button type="button" onClick={onOpen} className="block w-full h-full">
            <img
              src={posterUrl}
              alt={alt}
              loading={eager ? 'eager' : 'lazy'}
              decoding="async"
              className={`w-full h-full object-cover transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`}
              onLoad={(event) => {
                event.currentTarget.decode?.().catch(() => undefined).finally(() => setIsReady(true));
              }}
            />
          </button>
        ) : (
          <img
            src={posterUrl}
            alt={alt}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            className={`w-full h-full object-cover transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`}
            onLoad={(event) => {
              event.currentTarget.decode?.().catch(() => undefined).finally(() => setIsReady(true));
            }}
          />
        )
      )}

      {shouldLoad && kind !== 'image' && kind !== 'video' && posterUrl && (
        <img
          src={posterUrl}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className={`w-full h-full object-cover transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`}
          onLoad={(event) => {
            event.currentTarget.decode?.().catch(() => undefined).finally(() => setIsReady(true));
          }}
        />
      )}
    </div>
  );
}
