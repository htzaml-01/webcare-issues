// WebCare Issue Reporting - Interactive Logic (Desktop & Mobile)
document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initTimelineInteractions();
  initDropzone();
  initFormValidation();
  initGlassCard3DTilt();
  initSmoothScroll();
});

/* ==========================================================================
   1. MOBILE DRAWER MENU
   ========================================================================== */
function initMobileMenu() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const drawer = document.getElementById('mobileNavDrawer');

  if (!menuBtn || !drawer) return;

  menuBtn.addEventListener('click', () => {
    menuBtn.classList.toggle('open');
    drawer.classList.toggle('open');
  });

  // Close drawer when clicking a link
  const links = drawer.querySelectorAll('.mobile-nav-link');
  links.forEach(link => {
    link.addEventListener('click', () => {
      menuBtn.classList.remove('open');
      drawer.classList.remove('open');
    });
  });

  // Close drawer when clicking outside
  document.addEventListener('click', (e) => {
    if (!menuBtn.contains(e.target) && !drawer.contains(e.target)) {
      menuBtn.classList.remove('open');
      drawer.classList.remove('open');
    }
  });
}

/* ==========================================================================
   2. TIMELINE INTERACTION
   ========================================================================== */
function initTimelineInteractions() {
  const steps = document.querySelectorAll('.timeline-item');

  steps.forEach((step) => {
    step.addEventListener('click', () => {
      steps.forEach(s => s.classList.remove('active'));
      step.classList.add('active');
    });
  });
}

/* ==========================================================================
   3. DRAG & DROP / TOUCH FILE UPLOAD
   ========================================================================== */
let attachedFiles = [];

function initDropzone() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const previewList = document.getElementById('filePreviewList');

  if (!dropzone || !fileInput) return;

  // Drag events for Desktop
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
  });

  // File Input Selection for Desktop & Mobile
  fileInput.addEventListener('change', async (e) => {
    await handleFiles(e.target.files);
  });

  async function handleFiles(files) {
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 25 * 1024 * 1024) {
        alert(`File "${file.name}" exceeds the 25MB limit.`);
        continue;
      }
      const processed = await processFile(file);
      attachedFiles.push(processed);
    }
    renderFilePreviews();
  }

  function processFile(file) {
    return new Promise((resolve) => {
      const isImage = file.type.startsWith('image/');
      const reader = new FileReader();

      reader.onload = (e) => {
        const rawDataUrl = e.target.result;
        if (isImage) {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDimension = 1200;
            let width = img.width;
            let height = img.height;

            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolve({
              name: file.name,
              size: file.size,
              type: file.type || 'image/jpeg',
              dataUrl: optimizedDataUrl,
              blob: file,
              isImage: true
            });
          };
          img.onerror = () => {
            resolve({
              name: file.name,
              size: file.size,
              type: file.type,
              dataUrl: rawDataUrl,
              blob: file,
              isImage: true
            });
          };
          img.src = rawDataUrl;
        } else {
          resolve({
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: rawDataUrl,
            blob: file,
            isImage: false
          });
        }
      };

      reader.onerror = () => {
        resolve({
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: '',
          isImage: isImage
        });
      };

      reader.readAsDataURL(file);
    });
  }

  function renderFilePreviews() {
    previewList.innerHTML = '';

    attachedFiles.forEach((file, idx) => {
      const pill = document.createElement('div');
      pill.className = 'file-preview-item';

      if (file.isImage && file.dataUrl) {
        const thumb = document.createElement('img');
        thumb.src = file.dataUrl;
        thumb.style.width = '24px';
        thumb.style.height = '24px';
        thumb.style.objectFit = 'cover';
        thumb.style.borderRadius = '3px';
        thumb.style.marginRight = '6px';
        pill.appendChild(thumb);
      }

      const nameSpan = document.createElement('span');
      nameSpan.textContent = `${file.name} (${formatFileSize(file.size)})`;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'file-preview-remove';
      removeBtn.innerHTML = '&times;';
      removeBtn.title = 'Remove file';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        attachedFiles.splice(idx, 1);
        renderFilePreviews();
      });

      pill.appendChild(nameSpan);
      pill.appendChild(removeBtn);
      previewList.appendChild(pill);
    });
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

/* ==========================================================================
   4. FORM VALIDATION & SUBMISSION MODAL
   ========================================================================== */
function initFormValidation() {
  const form = document.getElementById('projectContactForm');
  const nameInput = document.getElementById('userName');
  const emailInput = document.getElementById('userEmail');
  const countryCodeSelect = document.getElementById('countryCode');
  const phoneInput = document.getElementById('userPhone');
  const companyInput = document.getElementById('userCompany');
  const detailsTextarea = document.getElementById('projectDetails');
  const submitBtn = document.getElementById('submitBtn');

  const modal = document.getElementById('successModal');
  const modalSummary = document.getElementById('modalSummary');
  const closeModalBtn = document.getElementById('closeModalBtn');

  if (!form) return;

  // Real-time error removal for all text/textarea inputs
  [nameInput, emailInput, phoneInput, companyInput, detailsTextarea].forEach(input => {
    if (!input) return;
    input.addEventListener('input', () => {
      const group = input.closest('.form-field');
      if (group && group.classList.contains('has-error')) {
        group.classList.remove('has-error');
      }
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let isValid = true;

    // 1. Validate Name (Required)
    const nameField = document.getElementById('field-name');
    if (!nameInput.value.trim()) {
      if (nameField) nameField.classList.add('has-error');
      isValid = false;
    } else {
      if (nameField) nameField.classList.remove('has-error');
    }

    // 2. Validate Email (Required & Valid Format)
    const emailField = document.getElementById('field-email');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailInput.value.trim() || !emailRegex.test(emailInput.value.trim())) {
      if (emailField) emailField.classList.add('has-error');
      isValid = false;
    } else {
      if (emailField) emailField.classList.remove('has-error');
    }

    // 3. Validate WhatsApp Phone (Required)
    const phoneField = document.getElementById('field-phone');
    const digitsOnly = phoneInput.value.trim().replace(/[^0-9]/g, '');
    if (!phoneInput.value.trim() || digitsOnly.length < 6) {
      if (phoneField) phoneField.classList.add('has-error');
      isValid = false;
    } else {
      if (phoneField) phoneField.classList.remove('has-error');
    }

    // 4. Validate Website URL (Required)
    const companyField = document.getElementById('field-company');
    if (!companyInput.value.trim()) {
      if (companyField) companyField.classList.add('has-error');
      isValid = false;
    } else {
      if (companyField) companyField.classList.remove('has-error');
    }

    // 5. Validate Issue Details (Required)
    const detailsField = document.getElementById('field-details') || detailsTextarea.closest('.form-field');
    if (!detailsTextarea.value.trim()) {
      if (detailsField) detailsField.classList.add('has-error');
      isValid = false;
    } else {
      if (detailsField) detailsField.classList.remove('has-error');
    }

    // Note: Attached files (images, pdf, docx, zip) are OPTIONAL and not required

    if (!isValid) {
      // Scroll to first invalid field and focus it
      const firstError = form.querySelector('.has-error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const targetInput = firstError.querySelector('input, textarea');
        if (targetInput) targetInput.focus();
      }
      return;
    }

    // 1. Instantly Generate Sequential Ticket ID (#00001, #00002, ...)
    const fileCount = attachedFiles.length;
    const ticketId = generateSequentialTicketId();

    // Format Phone with Selected Country Code
    let formattedPhone = '';
    if (phoneInput && phoneInput.value.trim()) {
      const cCode = countryCodeSelect ? countryCodeSelect.value : '+62';
      let numOnly = phoneInput.value.trim().replace(/^0+/, '').replace(/[^0-9]/g, '');
      formattedPhone = numOnly ? `${cCode} ${numOnly}` : '';
    }

    const newTicket = {
      id: ticketId,
      reporter: nameInput.value.trim(),
      email: emailInput.value.trim(),
      phone: formattedPhone,
      website: companyInput.value.trim() || 'example.com',
      details: detailsTextarea.value.trim() || 'Customer reported a website issue.',
      fileCount: fileCount,
      files: attachedFiles.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type,
        dataUrl: f.dataUrl,
        isImage: f.isImage
      })),
      status: 'pending', // 'pending', 'working', 'done'
      createdAt: new Date().toISOString(),
      timeStr: 'Just now'
    };

    // Button loading animation state
    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.innerHTML = `
      <span class="btn-text">Submitting Issue Ticket...</span>
    `;
    submitBtn.disabled = true;

    // Asynchronous Submission Handler (Supabase & LocalStorage)
    (async () => {
      // 1. If Supabase is configured, upload attachments and insert ticket
      if (window.WebCareSupabase && window.WebCareSupabase.isConfigured()) {
        try {
          // Attempt storage upload for files with blob
          for (let i = 0; i < newTicket.files.length; i++) {
            const rawAttached = attachedFiles[i];
            if (rawAttached && rawAttached.blob) {
              const publicStorageUrl = await window.WebCareSupabase.uploadAttachment(rawAttached, ticketId);
              if (publicStorageUrl) {
                newTicket.files[i].storageUrl = publicStorageUrl;
              }
            }
          }
          await window.WebCareSupabase.insertTicket(newTicket);
        } catch (sbErr) {
          console.warn('Supabase submit warning (fallback to local):', sbErr);
        }
      }

      // 2. Always sync locally for instant responsiveness
      try {
        const stored = JSON.parse(localStorage.getItem('webcare_tickets') || '[]');
        stored.unshift(newTicket);
        localStorage.setItem('webcare_tickets', JSON.stringify(stored));
        
        // Broadcast to any open Admin tab immediately
        if ('BroadcastChannel' in window) {
          const channel = new BroadcastChannel('webcare_sync_channel');
          channel.postMessage({ type: 'NEW_TICKET', ticket: newTicket });
          channel.close();
        }
      } catch (err) {
        console.error('Error saving ticket to storage:', err);
      }

      // Restore button
      submitBtn.innerHTML = originalBtnHTML;
      submitBtn.disabled = false;

      // Show Summary in Modal
      modalSummary.innerHTML = `
        <p><strong>Ticket ID:</strong> <span style="color:#0052ff; font-weight:700;">${ticketId}</span></p>
        <p><strong>Reporter:</strong> ${escapeHtml(newTicket.reporter)} (${escapeHtml(newTicket.email)})</p>
        ${formattedPhone ? `<p><strong>WhatsApp:</strong> ${escapeHtml(formattedPhone)}</p>` : ''}
        ${companyInput.value ? `<p><strong>Website:</strong> ${escapeHtml(companyInput.value)}</p>` : ''}
        ${detailsTextarea.value ? `<p><strong>Description:</strong> ${escapeHtml(newTicket.details.substring(0, 80))}${newTicket.details.length > 80 ? '...' : ''}</p>` : ''}
        ${fileCount > 0 ? `<p><strong>Attached Proof:</strong> ${fileCount} screenshot(s)/file(s)</p>` : ''}
      `;

      // Open Modal
      modal.classList.add('active');

      // Reset form
      form.reset();
      attachedFiles = [];
      const previewList = document.getElementById('filePreviewList');
      if (previewList) previewList.innerHTML = '';
    })();
  });

  if (closeModalBtn && modal) {
    closeModalBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  }

  function generateSequentialTicketId() {
    let seq = 1;
    try {
      const rawSeq = localStorage.getItem('webcare_ticket_seq');
      const stored = JSON.parse(localStorage.getItem('webcare_tickets') || '[]');
      
      if (rawSeq) {
        seq = parseInt(rawSeq, 10) + 1;
      } else {
        let maxNum = 0;
        stored.forEach(t => {
          const match = (t.id || '').match(/\d+/);
          if (match) {
            const num = parseInt(match[0], 10);
            if (num > maxNum) maxNum = num;
          }
        });
        seq = maxNum > 0 ? maxNum + 1 : 1;
      }
      localStorage.setItem('webcare_ticket_seq', seq.toString());
    } catch (err) {
      seq = 1;
    }
    return '#' + String(seq).padStart(5, '0');
  }

  function escapeHtml(string) {
    return String(string).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

/* ==========================================================================
   5. 3D GLASS CARD TILT (Desktop only)
   ========================================================================== */
function initGlassCard3DTilt() {
  const card = document.getElementById('formCard');
  if (!card) return;

  if (window.innerWidth > 992) {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -2.5;
      const rotateY = ((x - centerX) / centerX) * 2.5;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    });
  }
}


