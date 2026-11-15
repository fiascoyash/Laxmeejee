import { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export function ProductPhoto({ path, name, className = 'h-24 w-24' }: { path?: string | null; name: string; className?: string }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setUrl(''); setFailed(false);
    if (path) supabase.storage.from('product-photos').createSignedUrl(path, 3600).then(({ data }) => {
      if (active) setUrl(data?.signedUrl || '');
    });
    return () => { active = false; };
  }, [path]);
  return <div className={`${className} flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground`}>
    {url && !failed ? <img src={url} alt={name} loading="lazy" className="h-full w-full object-contain" onError={() => setFailed(true)} /> : <ImageIcon aria-label="No product photo" className="size-8" />}
  </div>;
}