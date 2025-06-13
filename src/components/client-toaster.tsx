
'use client';

import { Toaster as ShadCNToaster } from "@/components/ui/toaster";
import { useEffect, useState } from "react";

export default function ClientToaster() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null; 
  }

  return <ShadCNToaster />;
}
