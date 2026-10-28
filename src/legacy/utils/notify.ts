// @ts-nocheck -- lightweight replacement for blocking window.alert()
import { toast } from 'sonner';

const SUCCESS = /(success|saved|updated|duplicated|created)/i;
const ERROR = /(could not|failed|already exists|no template|error)/i;

/** Show a toast instead of a blocking alert. Kind is inferred from the message. */
export function notify(message: string, kind?: 'success' | 'error' | 'warning') {
  const text = String(message).replace(/!+$/, '');
  const k = kind || (ERROR.test(text) ? 'error' : SUCCESS.test(text) ? 'success' : 'warning');
  // Same message never stacks twice.
  const opts = { id: text };
  if (k === 'success') toast.success(text, opts);
  else if (k === 'error') toast.error(text, { ...opts, duration: 6000 });
  else toast.warning(text, opts);
}

const FIELDS = {
  customerName: ['input[placeholder="Enter customer name"]', 0],
  customerMobile: ['input[placeholder="10-digit mobile number"]', 0],
  customerGstin: ['input[placeholder="GSTIN number"]', 0],
  shipMobile: ['input[placeholder="10-digit mobile number"]', 1],
  shipGstin: ['input[placeholder="GSTIN number"]', 1],
};

function clearInline(input) {
  input.removeAttribute('aria-invalid');
  input.classList.remove('hb-field-invalid');
  const id = input.getAttribute('data-hb-error-id');
  if (id) document.getElementById(id)?.remove();
  input.removeAttribute('data-hb-error-id');
}

/** Validation feedback: highlights + focuses the field with an inline message, plus one toast. */
export function invalidField(field: keyof typeof FIELDS | null, message: string) {
  notify(message, 'warning');
  if (typeof document === 'undefined') return;
  let el = null;
  if (field && FIELDS[field]) {
    const [sel, idx] = FIELDS[field];
    el = document.querySelectorAll(sel)[idx] || null;
  }
  if (!el) {
    if (field === null) {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => /add product/i.test(b.textContent || ''));
      btn?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }
  clearInline(el);
  const id = `hb-err-${Math.random().toString(36).slice(2, 8)}`;
  const msg = document.createElement('p');
  msg.id = id;
  msg.className = 'hb-inline-error';
  msg.setAttribute('role', 'alert');
  msg.textContent = message;
  el.setAttribute('aria-invalid', 'true');
  el.setAttribute('aria-describedby', id);
  el.setAttribute('data-hb-error-id', id);
  el.classList.add('hb-field-invalid');
  el.insertAdjacentElement('afterend', msg);
  el.addEventListener('input', () => clearInline(el), { once: true });
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.focus({ preventScroll: true });
}
