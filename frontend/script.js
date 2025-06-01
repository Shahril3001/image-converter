document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const dropArea = document.getElementById('dropArea');
  const fileInput = document.getElementById('fileInput');
  const fileInfo = document.getElementById('fileInfo');
  const fileList = document.getElementById('fileList');
  const fileSummary = document.getElementById('fileSummary');
  const clearAllBtn = document.getElementById('clearAll');
  const totalFilesEl = document.getElementById('totalFiles');
  const totalSizeEl = document.getElementById('totalSize');
  const formatSelect = document.getElementById('formatSelect');
  const convertBtn = document.getElementById('convertBtn');
  const resultDiv = document.getElementById('result');
  const statusDiv = document.getElementById('status');
  const progressContainer = document.getElementById('progressContainer');
  const progressText = document.getElementById('progressText');
  const progressPercent = document.getElementById('progressPercent');
  const progressBar = document.getElementById('conversionProgress');

  // Configuration
  const BACKEND_URL = 'http://localhost:3000';
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  let selectedFiles = [];

  // Initialize
  checkBackendConnection();

  // Event Listeners
  dropArea.addEventListener('click', () => fileInput.click());
  
  ['dragenter', 'dragover'].forEach(event => {
    dropArea.addEventListener(event, highlightDropArea);
  });

  ['dragleave', 'drop'].forEach(event => {
    dropArea.addEventListener(event, unhighlightDropArea);
  });

  dropArea.addEventListener('drop', handleDrop);
  fileInput.addEventListener('change', handleFileSelect);
  convertBtn.addEventListener('click', handleConversion);
  clearAllBtn.addEventListener('click', clearAllFiles);
  formatSelect.addEventListener('change', updateConvertButtonState);

  // Functions
  function highlightDropArea(e) {
    e.preventDefault();
    e.stopPropagation();
    dropArea.classList.add('dragover');
  }

  function unhighlightDropArea(e) {
    e.preventDefault();
    e.stopPropagation();
    dropArea.classList.remove('dragover');
  }

  function handleDrop(e) {
    e.preventDefault();
    unhighlightDropArea(e);
    
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      handleFileSelect();
    }
  }

  function handleFileSelect() {
    if (fileInput.files.length) {
      const newFiles = Array.from(fileInput.files);
      
      // Filter out duplicates and invalid files
      const validNewFiles = newFiles.filter(file => {
        // Check if file already exists
        const exists = selectedFiles.some(
          f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified
        );
        
        // Check if file is valid
        const isValid = file.size <= MAX_FILE_SIZE && ALLOWED_TYPES.includes(file.type);
        
        return !exists && isValid;
      });
      
      if (validNewFiles.length !== newFiles.length) {
        updateStatus(
          `Added ${validNewFiles.length} files (${newFiles.length - validNewFiles.length} duplicates or invalid files skipped)`,
          'warning'
        );
      }
      
      selectedFiles = [...selectedFiles, ...validNewFiles];
      displayFileInfo();
      updateConvertButtonState();
    }
  }

  function displayFileInfo() {
    if (selectedFiles.length === 0) {
      fileList.innerHTML = '<div class="file-item">No files selected</div>';
      fileSummary.style.display = 'none';
      clearAllBtn.style.display = 'none';
      return;
    }

    const fileListHTML = selectedFiles.map((file, index) => `
      <div class="file-item">
        <div class="file-item-name">${file.name}</div>
        <div class="file-item-actions">
          <span class="file-item-size">${formatFileSize(file.size)}</span>
          <span class="remove-file" data-index="${index}">
            <i class="fas fa-times"></i>
          </span>
        </div>
      </div>
    `).join('');

    fileList.innerHTML = fileListHTML;
    fileSummary.style.display = 'flex';
    clearAllBtn.style.display = 'block';

    // Update summary
    totalFilesEl.textContent = selectedFiles.length;
    const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    totalSizeEl.textContent = formatFileSize(totalSize);

    // Add event listeners to remove buttons
    document.querySelectorAll('.remove-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-index'));
        selectedFiles.splice(index, 1);
        displayFileInfo();
        updateConvertButtonState();
      });
    });
  }

  function clearAllFiles() {
    selectedFiles = [];
    displayFileInfo();
    updateConvertButtonState();
    updateStatus('All files cleared', 'info');
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function updateConvertButtonState() {
    convertBtn.disabled = selectedFiles.length === 0;
  }

  async function checkBackendConnection() {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      if (response.ok) {
        const data = await response.json();
        updateStatus('Backend connected and ready!', 'success');
        convertBtn.disabled = selectedFiles.length === 0;
      } else {
        throw new Error('Backend not responding properly');
      }
    } catch (err) {
      console.error('Backend connection error:', err);
      updateStatus(
        `Failed to connect to backend at ${BACKEND_URL}. Please ensure: 
        1. Backend server is running (node server.js)
        2. No firewall blocking port 3000`,
        'error'
      );
      convertBtn.disabled = true;
    }
  }

  function updateStatus(message, type = 'info') {
    let icon = '';
    switch (type) {
      case 'success': icon = '<i class="fas fa-check-circle"></i>'; break;
      case 'error': icon = '<i class="fas fa-exclamation-circle"></i>'; break;
      case 'warning': icon = '<i class="fas fa-exclamation-triangle"></i>'; break;
      default: icon = '<i class="fas fa-info-circle"></i>';
    }
    statusDiv.innerHTML = `${icon} ${message}`;
    statusDiv.className = `status ${type}`;
  }

  function showProgress(total) {
    progressContainer.style.display = 'block';
    progressBar.max = total;
    progressBar.value = 0;
    updateProgress(0, total);
  }

  function updateProgress(completed, total) {
    const percent = Math.round((completed / total) * 100);
    progressText.textContent = `Processing files (${completed}/${total})`;
    progressPercent.textContent = `${percent}%`;
    progressBar.value = completed;
  }

  function hideProgress() {
    progressContainer.style.display = 'none';
  }

  async function handleConversion(e) {
    e.preventDefault();
    
    if (selectedFiles.length === 0) {
      updateStatus('Please select at least one file', 'error');
      return;
    }

    // Validate files
    for (const file of selectedFiles) {
      if (file.size > MAX_FILE_SIZE) {
        updateStatus(`File ${file.name} exceeds 10MB limit`, 'error');
        return;
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        updateStatus(`Only JPG, PNG, and WebP images are supported (${file.name})`, 'error');
        return;
      }
    }

    try {
      convertBtn.disabled = true;
      showProgress(selectedFiles.length);
      resultDiv.innerHTML = '';

      const formData = new FormData();
      selectedFiles.forEach(file => formData.append('images', file));
      formData.append('format', formatSelect.value);

      const response = await fetch(`${BACKEND_URL}/convert`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Conversion failed');
      }

      const result = await response.json();
      showResult(result);
      updateStatus(`Successfully converted ${selectedFiles.length} ${selectedFiles.length === 1 ? 'image' : 'images'}!`, 'success');
    } catch (err) {
      console.error('Conversion error:', err);
      updateStatus(err.message, 'error');
    } finally {
      convertBtn.disabled = false;
      hideProgress();
    }
  }

  function showResult(data) {
    resultDiv.innerHTML = `
      <div class="result-container">
        <h3><i class="fas fa-check-circle"></i> Conversion Complete!</h3>
        <p>${data.results.length} ${data.results.length === 1 ? 'image' : 'images'} converted to ${data.results[0].format} format</p>
        
        <div class="results-grid">
          ${data.results.map(item => `
            <div class="result-item">
              <img src="${BACKEND_URL}${item.url}" alt="Converted ${item.originalName}">
              <div class="result-item-name">${item.originalName}</div>
              <span class="result-item-format">${item.format}</span>
              <div>
                <a href="${BACKEND_URL}${item.url}" download="${item.filename}" class="download-btn">
                  <i class="fas fa-download"></i> Download
                </a>
              </div>
            </div>
          `).join('')}
        </div>
        
        <p class="text-muted"><small><i class="fas fa-clock"></i> Note: These files will be automatically deleted in 1 hour</small></p>
      </div>
    `;
  }
});