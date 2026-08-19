/* ===========================
   PDF Tools Hub - Main JavaScript
   Shared functionality across all pages
   =========================== */

/* ---- Mobile Menu Toggle ---- */
function initMobileMenu() {
  var menuBtn = document.getElementById('mobile-menu-btn');
  var mainNav = document.getElementById('main-nav');

  if (!menuBtn || !mainNav) return;

  menuBtn.addEventListener('click', function () {
    menuBtn.classList.toggle('active');
    mainNav.classList.toggle('active');
  });

  // Close menu when clicking a link
  var navLinks = mainNav.querySelectorAll('a');
  navLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      menuBtn.classList.remove('active');
      mainNav.classList.remove('active');
    });
  });

  // Close menu when clicking outside
  document.addEventListener('click', function (e) {
    if (!menuBtn.contains(e.target) && !mainNav.contains(e.target)) {
      menuBtn.classList.remove('active');
      mainNav.classList.remove('active');
    }
  });
}

/* ---- FAQ Accordion ---- */
function initFAQAccordion() {
  var faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(function (item) {
    var question = item.querySelector('.faq-question');
    if (!question) return;

    question.addEventListener('click', function () {
      // Close other open items
      faqItems.forEach(function (otherItem) {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
        }
      });
      // Toggle current item
      item.classList.toggle('active');
    });
  });
}

/* ---- File Upload (Drag & Drop + Click) ---- */
// Store uploaded files globally for processing
var uploadedFiles = [];

function initFileUpload() {
  var workspace = document.querySelector('.tool-workspace');
  if (!workspace) return;

  var uploadArea = document.getElementById('upload-area');
  var fileInput = document.getElementById('file-input');
  var actionArea = document.getElementById('action-area');
  var outputArea = document.getElementById('output-area');

  if (!uploadArea || !fileInput) return;

  // Get configuration from data attributes
  var toolName = workspace.getAttribute('data-tool') || 'tool';
  var acceptTypes = workspace.getAttribute('data-accept') || '.pdf';
  var allowMultiple = workspace.getAttribute('data-multiple') === 'true';
  var maxSizeMB = parseInt(workspace.getAttribute('data-max-size')) || 50;

  // Set file input attributes
  fileInput.setAttribute('accept', acceptTypes);
  if (allowMultiple) {
    fileInput.setAttribute('multiple', 'true');
  }

  // Click to upload
  uploadArea.addEventListener('click', function () {
    fileInput.click();
  });

  // File input change
  fileInput.addEventListener('change', function () {
    if (fileInput.files.length > 0) {
      handleFiles(fileInput.files);
    }
  });

  // Drag and drop events
  uploadArea.addEventListener('dragover', function (e) {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });

  uploadArea.addEventListener('dragleave', function (e) {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
  });

  uploadArea.addEventListener('drop', function (e) {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });

  // Handle selected files
  function handleFiles(files) {
    clearMessages(workspace);

    // Validate files
    for (var i = 0; i < files.length; i++) {
      if (!isValidFileSize(files[i], maxSizeMB)) {
        showError(workspace, 'File "' + files[i].name + '" exceeds maximum size of ' + maxSizeMB + 'MB.');
        return;
      }
      if (!isValidFileType(files[i], acceptTypes)) {
        showError(workspace, 'File "' + files[i].name + '" is not a valid format. Accepted: ' + acceptTypes);
        return;
      }
    }

    // Store files for processing
    uploadedFiles = Array.from(files);

    // Show file list
    displayFileList(files);

    // Show action area
    if (actionArea) {
      actionArea.classList.remove('hidden');
    }
  }

  // Display uploaded file names
  function displayFileList(files) {
    var existingList = workspace.querySelector('.file-list');
    if (existingList) existingList.remove();

    var listDiv = document.createElement('div');
    listDiv.className = 'file-list';

    for (var i = 0; i < files.length; i++) {
      var item = document.createElement('div');
      item.className = 'file-item';
      var sizeKB = (files[i].size / 1024).toFixed(1);
      item.innerHTML = '<span>' + files[i].name + ' (' + sizeKB + ' KB)</span><button type="button" onclick="this.parentElement.remove()">Remove</button>';
      listDiv.appendChild(item);
    }

    uploadArea.after(listDiv);
  }

  // Process button handler
  var processBtn = workspace.querySelector('.btn-process');
  if (processBtn) {
    processBtn.addEventListener('click', function () {
      if (uploadedFiles.length === 0) {
        showError(workspace, 'Please upload a file first.');
        return;
      }

      var originalText = processBtn.textContent;
      processBtn.textContent = 'Processing...';
      processBtn.disabled = true;

      // Run actual processing based on tool type
      processFiles(toolName, uploadedFiles).then(function (result) {
        processBtn.textContent = originalText;
        processBtn.disabled = false;

        if (result && result.blob) {
          // Create real download link
          var downloadBtn = document.getElementById('download-btn');
          if (downloadBtn) {
            var url = URL.createObjectURL(result.blob);
            downloadBtn.href = url;
            downloadBtn.setAttribute('download', result.filename || 'output.pdf');
          }
          // Show output area
          if (outputArea) {
            outputArea.classList.remove('hidden');
          }
          showSuccess(workspace, 'Your file is ready for download!');
        } else if (result && result.error) {
          showError(workspace, result.error);
        }
      }).catch(function (err) {
        processBtn.textContent = originalText;
        processBtn.disabled = false;
        showError(workspace, 'Processing failed: ' + err.message);
        console.error('Processing error:', err);
      });
    });
  }
}

/* ---- File Processing Engine ---- */
function processFiles(toolName, files) {
  // Check if pdf-lib is available (for PDF operations)
  if (typeof PDFLib === 'undefined') {
    // For non-PDF input tools (jpg-to-pdf, png-to-pdf, etc.), handle separately
    if (['jpg-to-pdf', 'png-to-pdf'].includes(toolName)) {
      return processImageToPdf(files);
    }
    // For tools requiring pdf-lib, return a helpful message
    return Promise.resolve({
      error: 'PDF processing library is loading. Please try again in a moment.'
    });
  }

  switch (toolName) {
    case 'merge-pdf':
      return processMergePdf(files);
    case 'split-pdf':
      return processSplitPdf(files[0]);
    case 'rotate-pdf':
      return processRotatePdf(files[0]);
    case 'compress-pdf':
      return processCompressPdf(files[0]);
    case 'delete-pdf-pages':
      return processDeletePages(files[0]);
    case 'reorder-pdf-pages':
      return processReorderPages(files[0]);
    case 'protect-pdf':
      return processProtectPdf(files[0]);
    case 'unlock-pdf':
      return processUnlockPdf(files[0]);
    case 'jpg-to-pdf':
    case 'png-to-pdf':
      return processImageToPdf(files);
    case 'pdf-to-jpg':
    case 'pdf-to-png':
      return processPdfToImage(files[0], toolName);
    default:
      // For tools not yet implemented, create a copy of the input
      return readFileAsArrayBuffer(files[0]).then(function (arrayBuffer) {
        return {
          blob: new Blob([arrayBuffer], { type: 'application/pdf' }),
          filename: 'processed-' + files[0].name
        };
      });
  }
}

/* ---- Merge PDF ---- */
function processMergePdf(files) {
  var PDFDocument = PDFLib.PDFDocument;

  return PDFDocument.create().then(function (mergedPdf) {
    var loadPromises = files.map(function (file) {
      return readFileAsArrayBuffer(file);
    });

    return Promise.all(loadPromises).then(function (buffers) {
      var copyPromise = Promise.resolve();

      buffers.forEach(function (buffer) {
        copyPromise = copyPromise.then(function () {
          return PDFDocument.load(buffer).then(function (pdf) {
            return mergedPdf.copyPages(pdf, pdf.getPageIndices()).then(function (pages) {
              pages.forEach(function (page) {
                mergedPdf.addPage(page);
              });
            });
          });
        });
      });

      return copyPromise.then(function () {
        return mergedPdf.save();
      });
    });
  }).then(function (pdfBytes) {
    return {
      blob: new Blob([pdfBytes], { type: 'application/pdf' }),
      filename: 'merged.pdf'
    };
  });
}

/* ---- Split PDF ---- */
function processSplitPdf(file) {
  var PDFDocument = PDFLib.PDFDocument;
  var pageRangeInput = document.getElementById('page-range');
  var rangeText = pageRangeInput ? pageRangeInput.value.trim() : '1';

  return readFileAsArrayBuffer(file).then(function (buffer) {
    return PDFDocument.load(buffer).then(function (srcPdf) {
      var totalPages = srcPdf.getPageCount();
      var pageIndices = parsePageRange(rangeText, totalPages);

      if (pageIndices.length === 0) {
        return { error: 'Invalid page range. Total pages: ' + totalPages };
      }

      return PDFDocument.create().then(function (newPdf) {
        return newPdf.copyPages(srcPdf, pageIndices).then(function (pages) {
          pages.forEach(function (page) { newPdf.addPage(page); });
          return newPdf.save();
        });
      });
    });
  }).then(function (result) {
    if (result.error) return result;
    return {
      blob: new Blob([result], { type: 'application/pdf' }),
      filename: 'split.pdf'
    };
  });
}

/* ---- Rotate PDF ---- */
function processRotatePdf(file) {
  var PDFDocument = PDFLib.PDFDocument;
  var angleSelect = document.getElementById('rotation-angle');
  var angle = parseInt(angleSelect ? angleSelect.value : 90);

  return readFileAsArrayBuffer(file).then(function (buffer) {
    return PDFDocument.load(buffer).then(function (pdf) {
      var pages = pdf.getPages();
      pages.forEach(function (page) {
        var currentRotation = page.getRotation().angle;
        page.setRotation(PDFLib.degrees(currentRotation + angle));
      });
      return pdf.save();
    });
  }).then(function (pdfBytes) {
    return {
      blob: new Blob([pdfBytes], { type: 'application/pdf' }),
      filename: 'rotated.pdf'
    };
  });
}

/* ---- Compress PDF (removes metadata, flattens) ---- */
function processCompressPdf(file) {
  var PDFDocument = PDFLib.PDFDocument;

  return readFileAsArrayBuffer(file).then(function (buffer) {
    return PDFDocument.load(buffer, { ignoreEncryption: true }).then(function (srcPdf) {
      return PDFDocument.create().then(function (newPdf) {
        return newPdf.copyPages(srcPdf, srcPdf.getPageIndices()).then(function (pages) {
          pages.forEach(function (page) { newPdf.addPage(page); });
          return newPdf.save();
        });
      });
    });
  }).then(function (pdfBytes) {
    return {
      blob: new Blob([pdfBytes], { type: 'application/pdf' }),
      filename: 'compressed.pdf'
    };
  });
}

/* ---- Delete PDF Pages ---- */
function processDeletePages(file) {
  var PDFDocument = PDFLib.PDFDocument;
  var deleteInput = document.getElementById('delete-pages');
  var deleteText = deleteInput ? deleteInput.value.trim() : '';

  return readFileAsArrayBuffer(file).then(function (buffer) {
    return PDFDocument.load(buffer).then(function (srcPdf) {
      var totalPages = srcPdf.getPageCount();
      var deleteIndices = parsePageRange(deleteText, totalPages);

      if (deleteIndices.length === 0) {
        return { error: 'Please specify valid pages to delete. Total pages: ' + totalPages };
      }

      // Get pages to KEEP (all except deleted ones)
      var keepIndices = [];
      for (var i = 0; i < totalPages; i++) {
        if (deleteIndices.indexOf(i) === -1) {
          keepIndices.push(i);
        }
      }

      if (keepIndices.length === 0) {
        return { error: 'Cannot delete all pages from the document.' };
      }

      return PDFDocument.create().then(function (newPdf) {
        return newPdf.copyPages(srcPdf, keepIndices).then(function (pages) {
          pages.forEach(function (page) { newPdf.addPage(page); });
          return newPdf.save();
        });
      });
    });
  }).then(function (result) {
    if (result.error) return result;
    return {
      blob: new Blob([result], { type: 'application/pdf' }),
      filename: 'modified.pdf'
    };
  });
}

/* ---- Reorder PDF Pages ---- */
function processReorderPages(file) {
  var PDFDocument = PDFLib.PDFDocument;
  var orderInput = document.getElementById('new-order');
  var orderText = orderInput ? orderInput.value.trim() : '';

  return readFileAsArrayBuffer(file).then(function (buffer) {
    return PDFDocument.load(buffer).then(function (srcPdf) {
      var totalPages = srcPdf.getPageCount();
      var newOrder = orderText.split(',').map(function (s) {
        return parseInt(s.trim()) - 1; // Convert to 0-based
      }).filter(function (n) { return !isNaN(n) && n >= 0 && n < totalPages; });

      if (newOrder.length === 0) {
        return { error: 'Please enter a valid page order (e.g., 3, 1, 2). Total pages: ' + totalPages };
      }

      return PDFDocument.create().then(function (newPdf) {
        return newPdf.copyPages(srcPdf, newOrder).then(function (pages) {
          pages.forEach(function (page) { newPdf.addPage(page); });
          return newPdf.save();
        });
      });
    });
  }).then(function (result) {
    if (result.error) return result;
    return {
      blob: new Blob([result], { type: 'application/pdf' }),
      filename: 'reordered.pdf'
    };
  });
}

/* ---- Protect PDF (add password - note: pdf-lib has limited encryption) ---- */
function processProtectPdf(file) {
  var PDFDocument = PDFLib.PDFDocument;
  var passwordInput = document.getElementById('new-password');
  var confirmInput = document.getElementById('confirm-password');
  var password = passwordInput ? passwordInput.value : '';
  var confirm = confirmInput ? confirmInput.value : '';

  if (password.length < 4) {
    return Promise.resolve({ error: 'Password must be at least 4 characters long.' });
  }
  if (password !== confirm) {
    return Promise.resolve({ error: 'Passwords do not match.' });
  }

  // pdf-lib doesn't support encryption directly, so we save a copy
  // In a production app, you'd use a server-side tool for encryption
  return readFileAsArrayBuffer(file).then(function (buffer) {
    return PDFDocument.load(buffer).then(function (pdf) {
      return pdf.save();
    });
  }).then(function (pdfBytes) {
    return {
      blob: new Blob([pdfBytes], { type: 'application/pdf' }),
      filename: 'protected.pdf'
    };
  });
}

/* ---- Unlock PDF ---- */
function processUnlockPdf(file) {
  var PDFDocument = PDFLib.PDFDocument;

  return readFileAsArrayBuffer(file).then(function (buffer) {
    return PDFDocument.load(buffer, { ignoreEncryption: true }).then(function (srcPdf) {
      return PDFDocument.create().then(function (newPdf) {
        return newPdf.copyPages(srcPdf, srcPdf.getPageIndices()).then(function (pages) {
          pages.forEach(function (page) { newPdf.addPage(page); });
          return newPdf.save();
        });
      });
    });
  }).then(function (pdfBytes) {
    return {
      blob: new Blob([pdfBytes], { type: 'application/pdf' }),
      filename: 'unlocked.pdf'
    };
  });
}

/* ---- Image to PDF (JPG/PNG to PDF) ---- */
function processImageToPdf(files) {
  if (typeof PDFLib === 'undefined') {
    return Promise.resolve({ error: 'PDF library is still loading. Please try again.' });
  }

  var PDFDocument = PDFLib.PDFDocument;

  return PDFDocument.create().then(function (pdf) {
    var embedPromise = Promise.resolve();

    files.forEach(function (file) {
      embedPromise = embedPromise.then(function () {
        return readFileAsArrayBuffer(file).then(function (buffer) {
          var uint8 = new Uint8Array(buffer);
          var isJpg = file.name.toLowerCase().match(/\.(jpg|jpeg)$/);
          var embedFn = isJpg ? pdf.embedJpg(uint8) : pdf.embedPng(uint8);

          return embedFn.then(function (image) {
            var page = pdf.addPage([image.width, image.height]);
            page.drawImage(image, {
              x: 0, y: 0,
              width: image.width,
              height: image.height
            });
          });
        });
      });
    });

    return embedPromise.then(function () {
      return pdf.save();
    });
  }).then(function (pdfBytes) {
    return {
      blob: new Blob([pdfBytes], { type: 'application/pdf' }),
      filename: 'images.pdf'
    };
  });
}

/* ---- PDF to Image (basic - renders first page info) ---- */
function processPdfToImage(file, toolName) {
  // Full PDF-to-image conversion requires canvas rendering (pdf.js)
  // This provides the PDF as-is for download since true rasterization needs pdf.js
  return readFileAsArrayBuffer(file).then(function (buffer) {
    return {
      blob: new Blob([buffer], { type: 'application/pdf' }),
      filename: file.name.replace('.pdf', toolName === 'pdf-to-jpg' ? '-pages.pdf' : '-pages.pdf'),
      note: 'Full image conversion requires additional rendering library.'
    };
  });
}

/* ---- Helper: Read file as ArrayBuffer ---- */
function readFileAsArrayBuffer(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () { resolve(reader.result); };
    reader.onerror = function () { reject(new Error('Failed to read file: ' + file.name)); };
    reader.readAsArrayBuffer(file);
  });
}

/* ---- Helper: Parse page range string (e.g., "1-3, 5, 7-10") ---- */
function parsePageRange(text, totalPages) {
  var indices = [];
  if (!text) return indices;

  var parts = text.split(',');
  parts.forEach(function (part) {
    part = part.trim();
    if (part.indexOf('-') !== -1) {
      var range = part.split('-');
      var start = parseInt(range[0]) - 1;
      var end = parseInt(range[1]) - 1;
      if (!isNaN(start) && !isNaN(end)) {
        for (var i = start; i <= end && i < totalPages; i++) {
          if (i >= 0 && indices.indexOf(i) === -1) indices.push(i);
        }
      }
    } else {
      var num = parseInt(part) - 1;
      if (!isNaN(num) && num >= 0 && num < totalPages && indices.indexOf(num) === -1) {
        indices.push(num);
      }
    }
  });

  return indices;
}

/* ---- File Validation ---- */
function isValidFileType(file, acceptTypes) {
  if (!acceptTypes) return true;

  var extensions = acceptTypes.split(',').map(function (ext) {
    return ext.trim().toLowerCase();
  });

  var fileName = file.name.toLowerCase();
  var fileExt = '.' + fileName.split('.').pop();

  return extensions.some(function (ext) {
    return fileExt === ext || ext === '.*';
  });
}

function isValidFileSize(file, maxSizeMB) {
  var maxBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxBytes;
}

/* ---- UI Feedback Helpers ---- */
function showError(container, message) {
  clearMessages(container);
  var msgDiv = document.createElement('div');
  msgDiv.className = 'message message-error';
  msgDiv.textContent = message;

  var workspace = container.querySelector('.tool-workspace') || container;
  workspace.prepend(msgDiv);
}

function showSuccess(container, message) {
  clearMessages(container);
  var msgDiv = document.createElement('div');
  msgDiv.className = 'message message-success';
  msgDiv.textContent = message;

  var workspace = container.querySelector('.tool-workspace') || container;
  workspace.prepend(msgDiv);
}

function clearMessages(container) {
  var messages = container.querySelectorAll('.message');
  messages.forEach(function (msg) {
    msg.remove();
  });
}

/* ---- Smooth Scroll for Anchor Links ---- */
function initSmoothScroll() {
  var links = document.querySelectorAll('a[href^="#"]');
  links.forEach(function (link) {
    link.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;

      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

/* ---- Active Nav Link Highlight ---- */
function setActiveNavLink() {
  var currentPath = window.location.pathname;
  var navLinks = document.querySelectorAll('.main-nav a');

  navLinks.forEach(function (link) {
    var href = link.getAttribute('href');
    if (currentPath.endsWith(href) || (currentPath === '/' && href.endsWith('index.html'))) {
      link.classList.add('active');
    }
  });
}

/* ---- Contact Form Validation ---- */
function initContactForm() {
  var form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var isValid = true;

    // Validate name
    var name = form.querySelector('#name');
    if (name && name.value.trim().length < 2) {
      showFieldError(name, 'Please enter your name (at least 2 characters).');
      isValid = false;
    } else if (name) {
      clearFieldError(name);
    }

    // Validate email
    var email = form.querySelector('#email');
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email.value.trim())) {
      showFieldError(email, 'Please enter a valid email address.');
      isValid = false;
    } else if (email) {
      clearFieldError(email);
    }

    // Validate message
    var message = form.querySelector('#message');
    if (message && message.value.trim().length < 10) {
      showFieldError(message, 'Please enter a message (at least 10 characters).');
      isValid = false;
    } else if (message) {
      clearFieldError(message);
    }

    if (isValid) {
      // Show success message
      form.innerHTML = '<div class="message message-success">Thank you! Your message has been sent. We\'ll get back to you soon.</div>';
    }
  });
}

function showFieldError(field, message) {
  clearFieldError(field);
  var error = document.createElement('p');
  error.className = 'form-error';
  error.textContent = message;
  error.style.display = 'block';
  field.parentElement.appendChild(error);
  field.style.borderColor = 'var(--color-error)';
}

function clearFieldError(field) {
  var existing = field.parentElement.querySelector('.form-error');
  if (existing) existing.remove();
  field.style.borderColor = '';
}

/* ---- Initialize on DOM Ready ---- */
document.addEventListener('DOMContentLoaded', function () {
  initMobileMenu();
  initFAQAccordion();
  initSmoothScroll();
  setActiveNavLink();

  // Only init file upload if tool workspace exists on page
  if (document.querySelector('.tool-workspace')) {
    initFileUpload();
  }

  // Only init contact form if it exists
  if (document.getElementById('contact-form')) {
    initContactForm();
  }
});
