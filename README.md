# 🖼️ Image Format Converter API

A lightweight and secure Node.js backend that lets you upload images (`.jpg`, `.png`, `.webp`) and convert them into another format using the [`sharp`](https://github.com/lovell/sharp) image processing library. Supports batch uploads, auto-deletion, and MIME validation.

---

## 🚀 Features

- 🗂️ Upload up to **10 images** at once
- 🔄 Convert to **JPG**, **PNG**, or **WebP**
- 🧠 Uses `sharp` for high-speed conversion
- ♻️ Automatically deletes files after 1 hour
- 🔐 MIME-type validation (not just file extension!)
- ⚙️ Batch processing with concurrency control

---

## 📦 Installation

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
npm install
