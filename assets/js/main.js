const lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
const messages = {
  ar: {
    success: 'تم إرسال طلبك. سنرد عليك خلال يوم عمل.',
    failure: 'تعذّر إرسال الطلب. راسلنا مباشرة على ',
    mail: 'فتحنا تطبيق البريد ورسالتك جاهزة، اضغط إرسال من هناك.',
    subject: 'طلب مشروع جديد من ',
    fields: ['الاسم', 'البريد الإلكتروني', 'رقم الهاتف', 'الخدمات', 'تفاصيل المشروع'],
  },
  en: {
    success: "Request sent. We'll reply within one business day.",
    failure: "The request couldn't be sent. Email us directly at ",
    mail: 'Your email app is open with the message ready. Press send there.',
    subject: 'New project request from ',
    fields: ['Name', 'Email', 'Phone', 'Services', 'Project details'],
  },
}[lang];

document.querySelectorAll('[data-year]').forEach((element) => {
  element.textContent = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en', {
    useGrouping: false,
  }).format(new Date().getFullYear());
});

async function setupNavigation() {
  if (!Object.hasOwn(HTMLElement.prototype, 'popover')) {
    await import('https://unpkg.com/@oddbird/popover-polyfill@0.7.3/dist/popover.min.js');
  }
  const header = document.querySelector('.site-header');
  const row = header.querySelector('.header-row');
  const menu = header.querySelector('.site-menu');
  let measuredWidth = -1;
  let measuring = false;
  const isOpen = () => menu.matches(':is(:popover-open, .\\:popover-open)');

  function measure() {
    const width = row.clientWidth;
    if (measuring || (!header.classList.contains('is-wide') && width <= measuredWidth)) return;
    measuring = true;
    measuredWidth = width;
    const wasOpen = isOpen();
    header.classList.add('is-measuring');
    // Removing the attribute releases the top-layer positioning for measurement.
    if (wasOpen) menu.hidePopover();
    menu.removeAttribute('popover');
    header.classList.add('is-wide');
    const fits = row.scrollWidth <= row.clientWidth;
    if (!fits) {
      header.classList.remove('is-wide');
      menu.setAttribute('popover', 'auto');
      if (wasOpen) menu.showPopover();
    }
    requestAnimationFrame(() => {
      header.classList.remove('is-measuring');
      measuring = false;
    });
  }
  new ResizeObserver(measure).observe(header);
  new ResizeObserver(measure).observe(menu);
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a') && menu.hasAttribute('popover') && isOpen()) menu.hidePopover();
  });
  measure();
}
setupNavigation().catch((error) => console.warn('Navigation enhancement unavailable.', error));

const form = document.querySelector('.contact-form');
if (form) {
  const fields = [...form.querySelectorAll('[data-error]')];
  const announcer = form.querySelector('[data-field-announcer]');
  const status = form.querySelector('.form-status');
  const submit = form.querySelector('[type="submit"]');
  const supportsUserInvalid = CSS.supports('selector(:user-invalid)');
  const dirty = new WeakSet();
  let announceTimer;
  let suppressAnnouncements = false;

  function sync(field, invalid) {
    field.setAttribute('aria-invalid', String(invalid));
    if (!supportsUserInvalid) field.classList.toggle('user-invalid-fallback', invalid);
    const describedBy = (field.getAttribute('aria-describedby') || '').split(/\s+/)
      .filter((id) => id && id !== field.dataset.error);
    if (invalid) describedBy.push(field.dataset.error);
    if (describedBy.length) field.setAttribute('aria-describedby', describedBy.join(' '));
    else field.removeAttribute('aria-describedby');
  }

  fields.forEach((field) => {
    const onInteraction = () => {
      const invalid = supportsUserInvalid ? field.matches(':user-invalid') : dirty.has(field) && !field.validity.valid;
      const becameInvalid = invalid && field.getAttribute('aria-invalid') !== 'true';
      sync(field, invalid);
      if (becameInvalid || !invalid) clearTimeout(announceTimer);
      if (becameInvalid && !suppressAnnouncements) {
        announceTimer = setTimeout(() => {
          if (field.getAttribute('aria-invalid') === 'true') {
            announcer.textContent = document.getElementById(field.dataset.error).textContent;
          }
        }, 500);
      }
    };
    field.addEventListener('blur', onInteraction);
    field.addEventListener('change', onInteraction);
    field.addEventListener('input', () => {
      dirty.add(field);
      suppressAnnouncements = false;
      if (field.validity.valid) {
        sync(field, false);
        clearTimeout(announceTimer);
        announcer.textContent = '';
      }
    });
  });
  form.addEventListener('invalid', (event) => {
    clearTimeout(announceTimer);
    announcer.textContent = '';
    suppressAnnouncements = true;
    if (event.target.dataset.error) {
      dirty.add(event.target);
      sync(event.target, true);
    }
  }, true);

  form.addEventListener('reset', () => {
    clearTimeout(announceTimer);
    announcer.textContent = '';
    fields.forEach((field) => { dirty.delete(field); sync(field, false); });
    suppressAnnouncements = false;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    clearTimeout(announceTimer);
    submit.disabled = true;
    status.textContent = '';
    const data = new FormData(form);
    try {
      if (String(data.get('company_website') || '').trim()) {
        status.textContent = messages.success;
        return;
      }
      const endpoint = form.dataset.endpoint.trim();
      if (endpoint) {
        const response = await fetch(endpoint, {
          method: 'POST', body: data, headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        status.textContent = messages.success;
        form.reset();
      } else {
        const values = ['name', 'email', 'phone'].map((name) => String(data.get(name) || ''));
        values.push(data.getAll('services').join(', '), String(data.get('message') || ''));
        const body = values.map((value, i) => `${messages.fields[i]}: ${value}`).join('\r\n')
          .replace(/\r?\n/g, '\r\n');
        const subject = messages.subject + data.get('name');
        location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        status.textContent = messages.mail;
      }
    } catch {
      status.textContent = messages.failure + form.dataset.mailto + '.';
    } finally {
      submit.disabled = false;
    }
  });
}
