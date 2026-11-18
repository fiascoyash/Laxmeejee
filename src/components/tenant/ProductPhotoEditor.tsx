import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { db as supabase } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { ProductPhoto } from './ProductPhoto';

export function ProductPhotoEditor({ path, name, onChange, onBusy }: { path?: string; name: string; onChange: (path: string) => void; onBusy: (busy: boolean) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    supabase.from('shop_products').select('image_path').limit(0).then(({ error }) => { if (active) setEnabled(!error); });
    return () => { active = false; };
  }, []);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Choose a JPG, PNG or WebP photo.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Choose a photo smaller than 5 MB.'); return; }
    setBusy(true); onBusy(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Sign in to upload a product photo.');
      const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
      const newPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('product-photos').upload(newPath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      onChange(newPath);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not upload photo. Try again.'); }
    finally { setBusy(false); onBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  }

  return <div className="space-y-2 border-t pt-4 text-foreground">
    <p className="text-sm font-medium">Product photo (optional)</p>
    <div className="flex flex-wrap items-center gap-3">
      <ProductPhoto path={path} name={name || 'Product'} />
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Product photo" className="hidden" onChange={e => void upload(e.target.files?.[0])} />
      <Button type="button" variant="outline" disabled={busy || !enabled} onClick={() => fileInput.current?.click()}><Upload />{busy ? 'Uploading…' : path ? 'Replace photo' : 'Upload photo'}</Button>
      {path && <Button type="button" variant="ghost" size="icon" title="Remove photo" aria-label="Remove photo" disabled={busy} onClick={() => onChange('')}><Trash2 /></Button>}
    </div>
    {!enabled && <p className="text-sm text-muted-foreground">Photo uploads are awaiting store setup permission.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}