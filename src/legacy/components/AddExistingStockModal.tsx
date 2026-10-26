// @ts-nocheck -- original Hisaaboo code, type-checked loosely
import { useState, useEffect, useRef } from 'react';
import { X, Save, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { ProductCatalogItem, SupplierData } from '../types';
import { todayLocal, validateStock, prepareStockPurchase, commitStockPurchase } from '../utils/addStock';

const optionalFields = [
  ['billNumber', 'Supplier Invoice/Bill Number', 'text'],
  ['batchNumber', 'Batch/Lot Number', 'text'],
  ['serialNumbers', 'Serial Number(s)', 'text'],
  ['manufacturingDate', 'Manufacturing Date', 'date'],
  ['expiryDate', 'Expiry Date', 'date'],
  ['warrantyPeriod', 'Warranty Period', 'text'],
  ['warrantyExpiryDate', 'Warranty Expiry Date', 'date'],
  ['storageLocation', 'Storage Location / Warehouse', 'text'],
];

interface Props {
  isOpen: boolean; onClose: () => void;
  onSave: (product: ProductCatalogItem) => void | Promise<void>;
  product: ProductCatalogItem; suppliers: SupplierData[];
}

export function AddExistingStockModal({ isOpen, onClose, onSave, product, suppliers }: Props) {
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState(String(product.purchasePrice ?? ''));
  const [supplier, setSupplier] = useState('');
  const [date, setDate] = useState(todayLocal);
  const [notes, setNotes] = useState('');
  const [details, setDetails] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const operation = useRef<ReturnType<typeof prepareStockPurchase> | null>(null);
  const quantityRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuantity(''); setPrice(String(product.purchasePrice ?? ''));
    setSupplier(''); setDate(todayLocal()); setNotes(''); setDetails({}); setError('');
    operation.current = null;
    const body = document.body;
    const oldOverflow = body.style.overflow;
    const oldPosition = body.style.position;
    const oldTop = body.style.top;
    const oldWidth = body.style.width;
    const scrollY = window.scrollY;
    body.style.overflow = 'hidden'; body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`; body.style.width = '100%';
    quantityRef.current?.focus({ preventScroll: true });
    return () => {
      body.style.overflow = oldOverflow; body.style.position = oldPosition;
      body.style.top = oldTop; body.style.width = oldWidth;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen, product.id]);

  if (!isOpen) return null;
  const amount = Number(quantity) * Number(price);
  let valid = quantity.trim() !== '' && price.trim() !== '';
  try { validateStock(Number(quantity), Number(price)); } catch { valid = false; }
  const close = () => { if (!busy.current) onClose(); };
  const handleSave = async (event) => {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true; setSaving(true); setError('');
    try {
      if (!valid) throw new Error('Enter a positive quantity and a valid per-unit price.');
      if (!operation.current) operation.current = prepareStockPurchase(product, {
        id: crypto.randomUUID(), quantity: Number(quantity), price: Number(price),
        supplier, date, notes, details,
      });
      const pending = operation.current;
      const { error: saveError } = await supabase.rpc('record_product_stock_purchase', { payload: {
        ...pending.purchase, balanceAfter: pending.movement.balanceAfter,
      } });
      if (saveError) throw new Error('Purchase history could not be saved. Please retry.');
      commitStockPurchase(pending);
      await onSave(pending.updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stock could not be saved. Please retry.');
    } finally { busy.current = false; setSaving(false); }
  };
  const fieldClass = 'w-full min-w-0 max-w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring';
  const labelClass = 'mb-1 block text-sm font-medium text-foreground';
  const locked = saving || operation.current !== null;

  return (
    <div className="stock-modal-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-stock-backdrop" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}>
      <form role="dialog" aria-modal="true" aria-labelledby="add-stock-title" onSubmit={handleSave} className="stock-modal-panel flex w-full min-w-0 max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted p-4">
          <div className="min-w-0"><h3 id="add-stock-title" className="text-lg font-semibold">Add Stock</h3><p className="break-words text-sm text-muted-foreground">{product.name}</p></div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close Add Stock" onClick={close} disabled={saving}><X /></Button>
        </header>
        <div data-stock-scroll className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain p-4">
          <div className="flex items-center gap-2 border-b border-border pb-3"><Package className="size-4 text-muted-foreground" /><span>Current Stock</span><strong className="ml-auto">{product.stockQuantity} {product.unit}</strong></div>
          <fieldset disabled={locked} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0"><label htmlFor="stock-quantity" className={labelClass}>Quantity to Add ({product.unit}) *</label><input ref={quantityRef} id="stock-quantity" name="addQuantity" type="number" inputMode="decimal" min="0" step="any" required value={quantity} onChange={e => setQuantity(e.target.value)} className={fieldClass} /></div>
            <div className="min-w-0"><label htmlFor="stock-price" className={labelClass}>Purchase Price per {product.unit} (Rs.) *</label><input id="stock-price" name="purchasePrice" type="number" inputMode="decimal" min="0" step="any" required value={price} onChange={e => setPrice(e.target.value)} className={fieldClass} /></div>
            <div className="min-w-0"><label htmlFor="stock-supplier" className={labelClass}>Supplier Name</label><input id="stock-supplier" value={supplier} onChange={e => setSupplier(e.target.value)} list="stock-supplier-list" className={fieldClass} /><datalist id="stock-supplier-list">{suppliers.map(s => <option key={s.id} value={s.firmName} />)}</datalist></div>
            <div className="min-w-0"><label htmlFor="stock-date" className={labelClass}>Purchase Date</label><input id="stock-date" type="date" required value={date} onChange={e => setDate(e.target.value)} className={fieldClass} /></div>
            {optionalFields.map(([key, label, type]) => <div key={key} className="min-w-0"><label htmlFor={`stock-${key}`} className={labelClass}>{label}</label><input id={`stock-${key}`} type={type} value={details[key] || ''} onChange={e => setDetails(current => ({ ...current, [key]: e.target.value }))} className={fieldClass} /></div>)}
            <div className="min-w-0 sm:col-span-2"><label htmlFor="stock-notes" className={labelClass}>Notes</label><textarea id="stock-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={fieldClass} /></div>
          </fieldset>
          <div className="border-t border-border pt-3 text-sm">New Stock After Addition: <strong>{product.stockQuantity + (valid ? Number(quantity) : 0)} {product.unit}</strong></div>
        </div>
        <footer className="shrink-0 space-y-3 border-t border-border bg-muted p-4">
          <div className="flex flex-wrap items-center justify-between gap-1 text-sm"><span>Total Purchase Cost</span><output className="font-semibold">Rs. {(Number.isFinite(amount) ? amount : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</output></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={close} disabled={saving}>Cancel</Button><Button type="submit" className="bg-stock-action text-stock-action-foreground hover:bg-stock-action/90" disabled={!valid || saving}><Save />{saving ? 'Saving...' : operation.current ? 'Retry Save Stock' : 'Save Stock'}</Button></div>
        </footer>
      </form>
    </div>
  );
}
