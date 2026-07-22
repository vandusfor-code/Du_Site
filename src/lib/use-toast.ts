"use client";

import { useCallback, useRef, useState } from "react";

export function useToast(duration = 2600) {
  const [toast, setToast] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string) => {
      setToast(message);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setToast(null), duration);
    },
    [duration]
  );

  return { toast, showToast };
}
