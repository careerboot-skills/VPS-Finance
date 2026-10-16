/**
 * LeLe Finance - Powered by CareerBoot
 * Single-file Express Application for Loan Management & Agreement Generation
 */

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const PDFDocument = require('pdfkit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(null, false);
  }
});

// ==================== DATABASE CONNECTION ====================
mongoose.connect(MONGO_URI || 'mongodb://localhost:27017/lele-finance')
  .then(() => console.log('Connected to MongoDB successfully.'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
  });

// ==================== SCHEMAS & MODELS ====================
const userSchema = new mongoose.Schema({
  mobile: { type: String, required: true, unique: true },
  name: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const loanSchema = new mongoose.Schema({
  clientMobile: { type: String, required: true },
  clientName: { type: String, required: true },
  address: { type: String, required: true },
  aadharPdfPath: { type: String, required: true },
  panPdfPath: { type: String, required: true },
  guarantorMobile: { type: String, required: true },
  requestAmount: { type: Number, required: true },
  approvedAmount: { type: Number, default: 0 },
  returnDate: { type: String, required: true },
  clientSignature: { type: String, required: true }, // Base64 data URL
  financerSignature: { type: String, default: '' },  // Base64 data URL
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Loan = mongoose.model('Loan', loanSchema);

// ==================== MIDDLEWARE ====================
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(uploadDir));

app.use(session({
  secret: 'lele-finance-careerboot-super-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI || 'mongodb://localhost:27017/lele-finance' }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day session
}));

// ==================== UI TEMPLATE HELPER ====================
function renderLayout(title, content) {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | LeLe Finance</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            colors: {
              glassDark: 'rgba(17, 24, 39, 0.7)',
              glassBorder: 'rgba(255, 255, 255, 0.1)',
            }
          }
        }
      }
    </script>
    <style>
      .glass {
        background: rgba(30, 41, 59, 0.75);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .glass-input {
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .glass-input:focus {
        border-color: #38bdf8;
        outline: none;
        box-shadow: 0 0 15px rgba(56, 189, 248, 0.3);
      }
    </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col justify-between selection:bg-cyan-500 selection:text-white">
    <header class="glass sticky top-0 z-50 border-b border-slate-800">
        <div class="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <a href="/" class="flex items-center space-x-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-black text-xl shadow-lg shadow-cyan-500/30">LF</div>
                <div>
                    <h1 class="text-xl font-bold tracking-wider bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">LeLe Finance</h1>
                    <p class="text-xs text-slate-400 tracking-widest uppercase">Powered by CareerBoot</p>
                </div>
            </a>
            <div class="flex items-center space-x-4">
                <a href="/financer-login" class="text-xs font-medium uppercase tracking-wider px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-500 transition shadow-sm">Financer Portal</a>
            </div>
        </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 py-10 w-full flex-grow">
        ${content}
    </main>

    <footer class="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        &copy; 2026 LeLe Finance &bull; CareerBoot & Skills Development, Lucknow. All rights reserved.
    </footer>
</body>
</html>`;
}

// ==================== ROUTES ====================

// 1. Home / Login & Registration via Mobile
app.get('/', async (req, res) => {
  if (req.session.clientMobile) {
    return res.redirect('/dashboard');
  }

  const content = `
    <div class="max-w-md mx-auto glass p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div class="text-center mb-8">
            <h2 class="text-2xl font-bold text-white mb-2">Welcome Client</h2>
            <p class="text-sm text-slate-400">Enter your mobile number to sign in or register instantly.</p>
        </div>
        <form action="/login" method="POST" class="space-y-6">
            <div>
                <label class="block text-xs uppercase tracking-wider text-slate-400 mb-2 font-medium">Mobile Number</label>
                <input type="tel" name="mobile" required pattern="[0-9]{10}" placeholder="e.g. 9876543210" class="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-slate-600 transition" />
                <p class="text-[11px] text-slate-500 mt-1">One mobile number = One unique account.</p>
            </div>
            <button type="submit" class="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition">
                Continue to Portal &rarr;
            </button>
        </form>
    </div>
  `;
  res.send(renderLayout('Client Access', content));
});

app.post('/login', async (req, res) => {
  const { mobile } = req.body;
  if (!mobile || mobile.length < 10) return res.redirect('/');

  let user = await User.findOne({ mobile });
  if (!user) {
    user = await User.create({ mobile });
  }

  req.session.clientMobile = mobile;
  res.redirect('/dashboard');
});

// 2. Client Dashboard
app.get('/dashboard', async (req, res) => {
  if (!req.session.clientMobile) return res.redirect('/');

  const user = await User.findOne({ mobile: req.session.clientMobile });
  const existingLoan = await Loan.findOne({ clientMobile: req.session.clientMobile }).sort({ createdAt: -1 });

  let loanActiveOrPending = existingLoan && (existingLoan.status === 'Pending' || existingLoan.status === 'Approved');

  let loanStatusHtml = '';
  if (!existingLoan) {
    loanStatusHtml = `<p class="text-slate-400 text-sm">You have no active or past loan applications.</p>`;
  } else {
    const badgeColor = existingLoan.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                       existingLoan.status === 'Rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                       'bg-amber-500/10 text-amber-400 border-amber-500/30';
    
    loanStatusHtml = `
      <div class="space-y-4">
        <div class="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div class="flex justify-between items-center">
            <span class="text-xs text-slate-400">Requested: ₹${existingLoan.requestAmount}</span>
            <span class="px-3 py-1 rounded-full text-xs font-bold border ${badgeColor}">${existingLoan.status}</span>
          </div>
          ${existingLoan.approvedAmount ? `<p class="text-lg font-bold text-emerald-400">Approved Amount: ₹${existingLoan.approvedAmount}</p>` : ''}
          <p class="text-xs text-slate-400">Target Return Date: <span class="text-slate-200 font-semibold">${existingLoan.returnDate}</span></p>
          <p class="text-xs text-cyan-400 font-medium">Interest Rate: Fixed 20% / Month till 100% principal recovery</p>
        </div>
        ${existingLoan.status === 'Approved' ? `
          <div class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col space-y-2">
            <p class="font-semibold text-emerald-400 text-sm">Loan Approved!</p>
            <p class="text-xs text-emerald-300/80">Download your signed official loan agreement PDF below.</p>
            <a href="/download-agreement/${existingLoan._id}" class="mt-2 text-center px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md">Download Agreement PDF</a>
          </div>
        ` : ''}
      </div>
    `;
  }

  let formHtml = '';
  if (loanActiveOrPending) {
    formHtml = `
      <div class="p-6 rounded-2xl glass border border-amber-500/20 text-center space-y-3">
        <div class="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 font-bold text-lg">!</div>
        <h3 class="text-lg font-bold text-white">Active Loan Notice</h3>
        <p class="text-sm text-slate-400">No new loan eligibility while a loan is ongoing or pending review.</p>
      </div>
    `;
  } else {
    formHtml = `
      <form action="/apply-loan" method="POST" enctype="multipart/form-data" id="loanForm" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-medium">Full Name</label>
            <input type="text" name="clientName" required placeholder="Enter your full name" class="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm" />
          </div>
          <div>
            <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-medium">Guarantor Mobile Number</label>
            <input type="tel" name="guarantorMobile" required pattern="[0-9]{10}" placeholder="Guarantor mobile" class="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm" />
          </div>
        </div>
        <div>
          <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-medium">Complete Residential Address</label>
          <textarea name="address" rows="2" required placeholder="House no, Street, City, Pincode" class="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm"></textarea>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-medium">Upload Aadhar Card (PDF)</label>
            <input type="file" name="aadharPdf" accept="application/pdf" required class="w-full text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/10 file:text-cyan-400 hover:file:bg-cyan-500/20 cursor-pointer" />
          </div>
          <div>
            <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-medium">Upload PAN Card (PDF)</label>
            <input type="file" name="panPdf" accept="application/pdf" required class="w-full text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/10 file:text-cyan-400 hover:file:bg-cyan-500/20 cursor-pointer" />
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-medium">Requested Loan Amount (₹)</label>
            <input type="number" name="requestAmount" min="1000" max="500000" required placeholder="e.g. 25000" class="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm" />
          </div>
          <div>
            <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-medium">Target Return Date</label>
            <input type="date" name="returnDate" required class="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm" />
          </div>
        </div>

        <div>
          <div class="flex justify-between items-center mb-1">
            <label class="block text-xs uppercase tracking-wider text-slate-400 font-medium">Draw Digital Signature</label>
            <button type="button" id="clearSig" class="text-xs text-cyan-400 hover:underline">Clear Signature</button>
          </div>
          <div class="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
            <canvas id="sigCanvas" class="w-full h-32 cursor-crosshair touch-none"></canvas>
          </div>
          <input type="hidden" name="clientSignature" id="clientSignatureInput" required />
        </div>

        <button type="submit" class="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition">
          Submit Loan Request
        </button>
      </form>

      <script>
        const canvas = document.getElementById('sigCanvas');
        const ctx = canvas.getContext('2d');
        let drawing = false;

        function resizeCanvas() {
          canvas.width = canvas.offsetWidth;
          canvas.height = canvas.offsetHeight;
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        function getPos(e) {
          const rect = canvas.getBoundingClientRect();
          const clientX = e.touches ? e.touches[0].clientX : e.clientX;
          const clientY = e.touches ? e.touches[0].clientY : e.clientY;
          return { x: clientX - rect.left, y: clientY - rect.top };
        }

        canvas.addEventListener('mousedown', (e) => { drawing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); });
        canvas.addEventListener('mousemove', (e) => { if (drawing) { const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); } });
        canvas.addEventListener('mouseup', () => { drawing = false; });

        canvas.addEventListener('touchstart', (e) => { drawing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); e.preventDefault(); });
        canvas.addEventListener('touchmove', (e) => { if (drawing) { const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); } e.preventDefault(); });
        canvas.addEventListener('touchend', () => { drawing = false; });

        document.getElementById('clearSig').addEventListener('click', () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        });

        document.getElementById('loanForm').addEventListener('submit', (e) => {
          const sigInput = document.getElementById('clientSignatureInput');
          sigInput.value = canvas.toDataURL();
          if (!sigInput.value || sigInput.value.length < 500) {
            alert('Please draw your digital signature before submitting.');
            e.preventDefault();
          }
        });
      </script>
    `;
  }

  const content = `
    <div class="space-y-8">
      <div class="glass p-6 rounded-3xl flex items-center justify-between">
        <div>
          <span class="text-xs uppercase tracking-widest text-cyan-400 font-semibold">Client Dashboard</span>
          <h2 class="text-2xl font-bold text-white mt-1">Mobile: ${user.mobile}</h2>
        </div>
        <a href="/logout" class="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition">Logout</a>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-1 glass p-6 rounded-3xl space-y-4">
          <h3 class="text-lg font-bold text-white border-b border-slate-800 pb-3">Loan Status</h3>
          ${loanStatusHtml}
        </div>

        <div class="lg:col-span-2 glass p-6 rounded-3xl space-y-6">
          <h3 class="text-lg font-bold text-white border-b border-slate-800 pb-3">Request New Loan</h3>
          ${formHtml}
        </div>
      </div>
    </div>
  `;
  res.send(renderLayout('Dashboard', content));
});

app.post('/apply-loan', upload.fields([{ name: 'aadharPdf', maxCount: 1 }, { name: 'panPdf', maxCount: 1 }]), async (req, res) => {
  if (!req.session.clientMobile) return res.redirect('/');

  const { clientName, address, guarantorMobile, requestAmount, returnDate, clientSignature } = req.body;

  const existingLoan = await Loan.findOne({ clientMobile: req.session.clientMobile, status: { $in: ['Pending', 'Approved'] } });
  if (existingLoan) return res.redirect('/dashboard');

  const aadharPdfPath = req.files['aadharPdf'] ? req.files['aadharPdf'][0].filename : '';
  const panPdfPath = req.files['panPdf'] ? req.files['panPdf'][0].filename : '';

  await Loan.create({
    clientMobile: req.session.clientMobile,
    clientName,
    address,
    aadharPdfPath,
    panPdfPath,
    guarantorMobile,
    requestAmount,
    returnDate,
    clientSignature,
    status: 'Pending'
  });

  res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// 3. Financer Portal & Authentication
app.get('/financer-login', (req, res) => {
  const content = `
    <div class="max-w-md mx-auto glass p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div class="text-center mb-8">
            <h2 class="text-2xl font-bold text-white mb-2">Financer Access</h2>
            <p class="text-sm text-slate-400">Enter the secret passcode to unlock client loan requests.</p>
        </div>
        <form action="/financer-auth" method="POST" class="space-y-6">
            <div>
                <label class="block text-xs uppercase tracking-wider text-slate-400 mb-2 font-medium">Passcode</label>
                <input type="password" name="code" required placeholder="Enter passcode" class="w-full px-4 py-3 rounded-xl glass-input text-white placeholder-slate-600 transition" />
            </div>
            <button type="submit" class="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 font-semibold text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition">
                Unlock Dashboard &rarr;
            </button>
        </form>
    </div>
  `;
  res.send(renderLayout('Financer Login', content));
});

app.post('/financer-auth', (req, res) => {
  const { code } = req.body;
  if (code === 'Paisa25') {
    req.session.isFinancer = true;
    return res.redirect('/financer-dashboard');
  }
  res.redirect('/financer-login');
});

app.get('/financer-dashboard', async (req, res) => {
  if (!req.session.isFinancer) return res.redirect('/financer-login');

  const loans = await Loan.find({}).sort({ createdAt: -1 });

  let rowsHtml = loans.map(loan => {
    const badgeColor = loan.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                       loan.status === 'Rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                       'bg-amber-500/10 text-amber-400 border-amber-500/30';
    return `
      <tr class="border-b border-slate-800/60 hover:bg-slate-900/40 transition">
        <td class="py-4 px-4">
          <p class="font-bold text-white">${loan.clientName}</p>
          <p class="text-xs text-slate-400">Mob: ${loan.clientMobile}</p>
          <p class="text-xs text-slate-500">Guarantor: ${loan.guarantorMobile}</p>
        </td>
        <td class="py-4 px-4">
          <p class="text-emerald-400 font-bold text-base">Req: ₹${loan.requestAmount}</p>
          ${loan.approvedAmount ? `<p class="text-xs font-semibold text-cyan-400">Appr: ₹${loan.approvedAmount}</p>` : ''}
          <p class="text-xs text-slate-400">Return: ${loan.returnDate}</p>
        </td>
        <td class="py-4 px-4 text-xs text-slate-300">
          <p class="mb-1">${loan.address}</p>
          <div class="flex space-x-2">
            <a href="/uploads/${loan.aadharPdfPath}" target="_blank" class="px-2 py-1 bg-slate-800 text-cyan-400 rounded border border-slate-700 hover:underline">View Aadhar PDF</a>
            <a href="/uploads/${loan.panPdfPath}" target="_blank" class="px-2 py-1 bg-slate-800 text-cyan-400 rounded border border-slate-700 hover:underline">View PAN PDF</a>
          </div>
        </td>
        <td class="py-4 px-4">
          <img src="${loan.clientSignature}" class="h-10 bg-slate-900 p-1 rounded border border-slate-700" alt="Client Signature" />
        </td>
        <td class="py-4 px-4">
          <span class="px-3 py-1 rounded-full text-xs font-bold border ${badgeColor}">${loan.status}</span>
        </td>
        <td class="py-4 px-4 space-y-2">
          ${loan.status === 'Pending' ? `
            <div class="flex space-x-2">
              <button onclick="openApprovalModal('${loan._id}',${loan.requestAmount})" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-md">Approve</button>
              <form action="/reject-loan/${loan._id}" method="POST"><button class="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition">Reject</button></form>
            </div>
          ` : ''}
          ${loan.status === 'Approved' ? `
            <a href="/download-agreement/${loan._id}" class="inline-block px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-xs font-bold border border-slate-700">Agreement PDF</a>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');

  const content = `
    <div class="space-y-6">
      <div class="glass p-6 rounded-3xl flex items-center justify-between">
        <div>
          <span class="text-xs uppercase tracking-widest text-emerald-400 font-semibold">Financer Portal</span>
          <h2 class="text-2xl font-bold text-white mt-1">Client Loan Requests</h2>
        </div>
        <a href="/financer-logout" class="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold hover:bg-rose-500/25 transition">Lock Portal</a>
      </div>

      <div class="glass rounded-3xl overflow-hidden shadow-xl">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-800 bg-slate-900/80 text-xs text-slate-400 uppercase tracking-wider">
                <th class="py-4 px-4">Client Details</th>
                <th class="py-4 px-4">Amount & Return</th>
                <th class="py-4 px-4">Documents & Address</th>
                <th class="py-4 px-4">Client Signature</th>
                <th class="py-4 px-4">Status</th>
                <th class="py-4 px-4">Action</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml.length > 0 ? rowsHtml : `<tr><td colspan="6" class="text-center py-8 text-slate-500 text-sm">No loan requests found.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Premium Financer Approval Modal -->
    <div id="approvalModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-md hidden items-center justify-center z-50 p-4">
      <div class="glass max-w-lg w-full p-6 rounded-3xl border border-emerald-500/30 shadow-2xl relative space-y-4">
        <div class="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 class="text-lg font-bold text-white">Financer Loan Approval & Agreement Sign</h3>
          <button onclick="closeApprovalModal()" class="text-slate-400 hover:text-white">&times;</button>
        </div>

        <form id="approveForm" method="POST" class="space-y-4">
          <div>
            <label class="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-medium">Approved Loan Amount (₹)</label>
            <input type="number" name="approvedAmount" id="modalApprovedAmount" required class="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm" />
          </div>

          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="block text-xs uppercase tracking-wider text-slate-400 font-medium">Financer Digital Signature</label>
              <button type="button" id="clearFinancerSig" class="text-xs text-cyan-400 hover:underline">Clear Signature</button>
            </div>
            <div class="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
              <canvas id="financerSigCanvas" class="w-full h-32 cursor-crosshair touch-none"></canvas>
            </div>
            <input type="hidden" name="financerSignature" id="financerSignatureInput" required />
          </div>

          <button type="submit" class="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 font-semibold text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition">
            Sign & Finalize Approval
          </button>
        </form>
      </div>
    </div>

    <script>
      const modal = document.getElementById('approvalModal');
      const approveForm = document.getElementById('approveForm');
      const financerCanvas = document.getElementById('financerSigCanvas');
      const fCtx = financerCanvas.getContext('2d');
      let fDrawing = false;

      function resizeFinancerCanvas() {
        financerCanvas.width = financerCanvas.offsetWidth;
        financerCanvas.height = financerCanvas.offsetHeight;
        fCtx.strokeStyle = '#10b981';
        fCtx.lineWidth = 2.5;
        fCtx.lineCap = 'round';
      }

      function openApprovalModal(loanId, reqAmount) {
        approveForm.action = '/approve-loan/' + loanId;
        document.getElementById('modalApprovedAmount').value = reqAmount;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(resizeFinancerCanvas, 100);
      }

      function closeApprovalModal() {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
      }

      function getFPos(e) {
        const rect = financerCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
      }

      financerCanvas.addEventListener('mousedown', (e) => { fDrawing = true; fCtx.beginPath(); const p = getFPos(e); fCtx.moveTo(p.x, p.y); });
      financerCanvas.addEventListener('mousemove', (e) => { if (fDrawing) { const p = getFPos(e); fCtx.lineTo(p.x, p.y); fCtx.stroke(); } });
      financerCanvas.addEventListener('mouseup', () => { fDrawing = false; });

      financerCanvas.addEventListener('touchstart', (e) => { fDrawing = true; fCtx.beginPath(); const p = getFPos(e); fCtx.moveTo(p.x, p.y); e.preventDefault(); });
      financerCanvas.addEventListener('touchmove', (e) => { if (fDrawing) { const p = getFPos(e); fCtx.lineTo(p.x, p.y); fCtx.stroke(); } e.preventDefault(); });
      financerCanvas.addEventListener('touchend', () => { fDrawing = false; });

      document.getElementById('clearFinancerSig').addEventListener('click', () => {
        fCtx.clearRect(0, 0, financerCanvas.width, financerCanvas.height);
      });

      approveForm.addEventListener('submit', (e) => {
        const sigInput = document.getElementById('financerSignatureInput');
        sigInput.value = financerCanvas.toDataURL();
        if (!sigInput.value || sigInput.value.length < 500) {
          alert('Please draw your financer signature before approving.');
          e.preventDefault();
        }
      });
    </script>
  `;
  res.send(renderLayout('Financer Dashboard', content));
});

app.post('/approve-loan/:id', async (req, res) => {
  if (!req.session.isFinancer) return res.redirect('/financer-login');
  const { approvedAmount, financerSignature } = req.body;

  await Loan.findByIdAndUpdate(req.params.id, {
    status: 'Approved',
    approvedAmount: Number(approvedAmount),
    financerSignature
  });

  res.redirect('/financer-dashboard');
});

app.post('/reject-loan/:id', async (req, res) => {
  if (!req.session.isFinancer) return res.redirect('/financer-login');
  await Loan.findByIdAndUpdate(req.params.id, { status: 'Rejected' });
  res.redirect('/financer-dashboard');
});

app.get('/financer-logout', (req, res) => {
  req.session.isFinancer = false;
  res.redirect('/');
});

// 4. Automated Agreement PDF Generation Route
app.get('/download-agreement/:id', async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan || loan.status !== 'Approved') {
    return res.status(403).send('Unauthorized or loan not approved.');
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Loan_Agreement_${loan.clientName.replace(/\s+/g, '_')}.pdf`);

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(res);

  doc.fontSize(22).fillColor('#0284c7').text('LELE FINANCE', { align: 'center' });
  doc.fontSize(10).fillColor('#64748b').text('Powered by CareerBoot & Skills Development, Lucknow', { align: 'center' });
  doc.moveDown(1.5);

  doc.fontSize(14).fillColor('#0f172a').text('OFFICIAL BINDING LOAN AGREEMENT', { align: 'center', underline: true });
  doc.moveDown(1.5);

  doc.fontSize(10).fillColor('#334155').text(`This Loan Agreement is made and executed on ${new Date(loan.createdAt).toLocaleDateString()} between LeLe Finance (Financer) and the Borrower detailed below:`);
  doc.moveDown(1);

  doc.fontSize(11).fillColor('#0f172a').text('Borrower Details:');
  doc.fontSize(10).fillColor('#334155')
     .text(`- Full Name: ${loan.clientName}`)
     .text(`- Mobile Number: ${loan.clientMobile}`)
     .text(`- Residential Address: ${loan.address}`)
     .text(`- Guarantor Mobile: ${loan.guarantorMobile}`);
  doc.moveDown(1);

  doc.fontSize(11).fillColor('#0f172a').text('Financial Terms & Interest Policy:');
  doc.fontSize(10).fillColor('#334155')
     .text(`- Approved Principal Amount: Rs. ${loan.approvedAmount}/-`)
     .text(`- Monthly Interest Rate: Fixed 20% per month`)
     .text(`- Interest Applicability: Charged monthly until 100% principal recovery`)
     .text(`- Target Repayment Date: ${loan.returnDate}`);
  doc.moveDown(1.5);

  doc.fontSize(10).fillColor('#0f172a').text('Terms & Conditions:', { underline: true });
  doc.fontSize(9).fillColor('#475569')
     .text('1. The borrower agrees to repay the approved principal amount along with fixed 20% monthly interest until total recovery.')
     .text('2. Failure to clear installments by the target return date will trigger legal recovery actions involving the listed guarantor.')
     .text('3. All legal proceedings are subject exclusively to Lucknow court jurisdiction.');
  doc.moveDown(2);

  // Embedded Canvas Digital Signatures
  const clientSigBuffer = Buffer.from(loan.clientSignature.replace(/^data:image\/\w+;base64,/, ""), 'base64');
  const financerSigBuffer = Buffer.from(loan.financerSignature.replace(/^data:image\/\w+;base64,/, ""), 'base64');

  const sigY = doc.y;
  doc.fontSize(10).fillColor('#0f172a').text('Borrower Digital Signature:', 50, sigY);
  doc.image(clientSigBuffer, 50, sigY + 15, { width: 140, height: 50 });

  doc.fontSize(10).fillColor('#0f172a').text('Financer Digital Signature:', 330, sigY);
  doc.image(financerSigBuffer, 330, sigY + 15, { width: 140, height: 50 });

  doc.end();
});

// ==================== SERVER START ====================
app.listen(PORT, () => {
  console.log(`LeLe Finance server running on port ${PORT}`);
});
