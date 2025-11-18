// Instant navigation with optimistic UI updates
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function useInstantNavigation() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = (href: string) => {
    startTransition(() => {
      router.push(href);
    });
  };

  return { navigate, isPending };
}

// Prefetch links on hover for instant navigation
export function usePrefetch() {
  const router = useRouter();

  const prefetch = (href: string) => {
    router.prefetch(href);
  };

  return { prefetch };
}
