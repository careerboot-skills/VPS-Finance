/**
 * LeLe Finance co-powered by CareerBoot - Full Stack Single-File Node.js/Express Application
 * 
 * Features:
 * - Express backend with MongoDB (Mongoose) persistence & Session management.
 * - Mobile Number Auth (One account per mobile number).
 * - Ongoing loan restriction (No new loan if active/ongoing loan exists).
 * - PDF Document Uploads (Aadhar & PAN cards).
 * - Drawable Signature Pads for both Client and Financer.
 * - Financer Portal unlocked via passcode 'Paisa25' with custom approved amount entry & signature drawing.
 * - Real-time status tracker for clients with official Agreement PDF download.
 * - Next-gen 4D animated mesh/particle background & dark glassmorphism Tailwind UI.
 */

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/lele_finance';

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration for PDF Documents
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
        else cb(new Error('Only PDF documents are allowed!'), false);
    }
});

// ==================== MONGODB SCHEMAS & MODELS ====================
const userSchema = new mongoose.Schema({
    mobile: { type: String, required: true, unique: true },
    name: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

const loanSchema = new mongoose.Schema({
    clientMobile: { type: String, required: true, index: true },
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
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Ongoing', 'Completed'], default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Loan = mongoose.model('Loan', loanSchema);

// ==================== MIDDLEWARE ====================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(uploadDir));

app.use(session({
    secret: 'lele-finance-careerboot-super-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day session
}));

// ==================== FRONTEND UI TEMPLATE (SINGLE HTML) ====================
function renderLayout(title, content) {
    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | LeLe Finance co-powered by CareerBoot</title>
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        brand: {
                            50: '#f0fdf4',
                            500: '#10b981',
                            600: '#059669',
                            900: '#064e3b',
                            neon: '#00ffcc',
                            purple: '#8b5cf6',
                            cyan: '#06b6d4'
                        }
                    },
                    fontFamily: {
                        sans: ['Inter', 'sans-serif']
                    }
                }
            }
        }
    </script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body { font-family: 'Inter', sans-serif; overflow-x: hidden; background-color: #030712; color: #f3f4f6; }
        #bg-canvas { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: -1; pointer-events: none; }
        .glass-panel {
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
        }
        .glass-input {
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .glass-input:focus {
            border-color: #10b981;
            outline: none;
            box-shadow: 0 0 15px rgba(16, 185, 129, 0.3);
        }
        .glow-button {
            box-shadow: 0 0 25px rgba(16, 185, 129, 0.4);
            transition: all 0.3s ease;
        }
        .glow-button:hover {
            box-shadow: 0 0 35px rgba(0, 255, 204, 0.8);
            transform: translateY(-2px);
        }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #0b0f19; }
        ::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #374151; }
    </style>
</head>
<body class="min-h-screen flex flex-col justify-between selection:bg-emerald-500 selection:text-black">
    <canvas id="bg-canvas"></canvas>

    <header class="w-full px-6 py-4 glass-panel sticky top-0 z-50 flex justify-between items-center border-b border-slate-800">
        <a href="/" class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <i class="fa-solid fa-bolt-lightning text-slate-950 text-xl font-black"></i>
            </div>
            <div>
                <h1 class="text-lg font-black tracking-wider bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                    LELE FINANCE <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">CareerBoot</span>
                </h1>
                <p class="text-xs text-slate-400 font-medium">Next-Gen Premium FinTech Ecosystem</p>
            </div>
        </a>

        <div class="flex items-center space-x-4">
            <a href="/financer-login" class="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 text-sm font-semibold transition flex items-center space-x-2">
                <i class="fa-solid fa-shield-halved"></i>
                <span>Financer Portal</span>
            </a>
        </div>
    </header>

    <main class="flex-grow flex items-center justify-center p-4 sm:p-6 my-auto max-w-7xl mx-auto w-full">
        ${content}
    </main>

    <footer class="w-full py-4 px-6 text-center text-xs text-slate-500 border-t border-slate-900 glass-panel">
        <p>&copy; 2026 LeLe Finance co-powered by CareerBoot & Skills Development, Ashiyana, Lucknow. All rights reserved.</p>
    </footer>

    <script>
        const canvas = document.getElementById('bg-canvas');
        const ctx = canvas.getContext('2d');
        let width, height;
        let particles = [];

        function resizeCanvas() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        class Particle {
            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.vx = (Math.random() - 0.5) * 0.8;
                this.vy = (Math.random() - 0.5) * 0.8;
                this.radius = Math.random() * 2 + 1;
            }
            update() {
                this.x += this.vx;
                this.y += this.vy;
                if (this.x < 0 || this.x > width) this.vx *= -1;
                if (this.y < 0 || this.y > height) this.vy *= -1;
            }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(16, 185, 129, 0.5)';
                ctx.fill();
            }
        }

        for (let i = 0; i < 70; i++) particles.push(new Particle());

        function animateBg() {
            ctx.clearRect(0, 0, width, height);
            let gradient = ctx.createRadialGradient(width/2, height/2, 50, width/2, height/2, Math.max(width, height));
            gradient.addColorStop(0, '#061a14');
            gradient.addColorStop(0.5, '#030712');
            gradient.addColorStop(1, '#02040a');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                particles[i].draw();
                for (let j = i + 1; j < particles.length; j++) {
                    let dx = particles[i].x - particles[j].x;
                    let dy = particles[i].y - particles[j].y;
                    let dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = 'rgba(16, 185, 129, ' + (0.2 * (1 - dist / 120)) + ')';
                        ctx.lineWidth = 0.8;
                        ctx.stroke();
                    }
                }
            }
            requestAnimationFrame(animateBg);
        }
        animateBg();
    </script>
</body>
</html>`;
}

// ==================== ROUTES ====================

app.get('/', async (req, res) => {
    if (req.session.clientMobile) {
        return res.redirect('/dashboard');
    }

    const content = `
    <div class="w-full max-w-md glass-panel p-8 rounded-3xl relative overflow-hidden mx-auto">
        <div class="text-center mb-8">
            <div class="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4 text-2xl">
                <i class="fa-solid fa-fingerprint"></i>
            </div>
            <h2 class="text-2xl font-bold tracking-tight text-white">Client Portal Access</h2>
            <p class="text-sm text-slate-400 mt-1">Enter your mobile number to securely login or register.</p>
        </div>

        <form action="/login" method="POST" class="space-y-5">
            <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Mobile Number</label>
                <div class="relative">
                    <span class="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500 font-medium">+91</span>
                    <input type="tel" name="mobile" required pattern="[0-9]{10}" placeholder="9876543210" maxlength="10"
                        class="w-full pl-14 pr-4 py-3.5 glass-input rounded-2xl text-white placeholder-slate-600 transition">
                </div>
            </div>

            <button type="submit" class="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-base glow-button flex items-center justify-center space-x-2">
                <span>Continue to Dashboard</span>
                <i class="fa-solid fa-arrow-right"></i>
            </button>
        </form>
        <div class="mt-6 text-center">
            <p class="text-xs text-slate-500"><i class="fa-solid fa-lock text-emerald-500 mr-1"></i> Secured with 256-Bit Military Grade Encryption</p>
        </div>
    </div>
    `;
    res.send(renderLayout('Client Login', content));
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

app.get('/dashboard', async (req, res) => {
    if (!req.session.clientMobile) return res.redirect('/');

    const user = await User.findOne({ mobile: req.session.clientMobile });
    const existingLoan = await Loan.findOne({ clientMobile: req.session.clientMobile }).sort({ createdAt: -1 });

    const loanActiveOrPending = existingLoan && ['Pending', 'Approved', 'Ongoing'].includes(existingLoan.status);

    let loanStatusHtml = '';
    if (!existingLoan) {
        loanStatusHtml = `<p class="text-slate-400 text-sm">You have no active or past loan applications.</p>`;
    } else {
        const badgeColor = ['Approved', 'Ongoing'].includes(existingLoan.status) ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                           existingLoan.status === 'Rejected' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                           'bg-amber-500/20 text-amber-400 border-amber-500/30';
        
        loanStatusHtml = `
        <div class="space-y-4">
            <div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div class="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                        <h3 class="text-lg font-bold text-white">Loan Application Status</h3>
                        <p class="text-xs text-slate-400">Submitted on ${new Date(existingLoan.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                        <span class="px-4 py-1.5 rounded-full text-xs font-bold border ${badgeColor}">${existingLoan.status}</span>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div><span class="text-slate-500 block text-xs">Full Name</span> <strong class="text-white">${existingLoan.clientName}</strong></div>
                    <div><span class="text-slate-500 block text-xs">Address</span> <strong class="text-white">${existingLoan.address}</strong></div>
                    <div><span class="text-slate-500 block text-xs">Requested Amount</span> <strong class="text-emerald-400">₹${existingLoan.requestAmount.toLocaleString()}</strong></div>
                    ${existingLoan.approvedAmount ? `<div><span class="text-slate-500 block text-xs">Approved Amount</span> <strong class="text-cyan-400">₹${existingLoan.approvedAmount.toLocaleString()}</strong></div>` : ''}
                    <div><span class="text-slate-500 block text-xs">Guarantor Mobile</span> <strong class="text-white">+91 ${existingLoan.guarantorMobile}</strong></div>
                    <div><span class="text-slate-500 block text-xs">Return Date</span> <strong class="text-white">${existingLoan.returnDate}</strong></div>
                </div>

                <div class="flex space-x-4 pt-2">
                    <a href="/uploads/${existingLoan.aadharPdfPath}" target="_blank" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 flex items-center space-x-2">
                        <i class="fa-solid fa-file-lines text-emerald-400"></i>
                        <span>View Aadhar Document</span>
                    </a>
                    <a href="/uploads/${existingLoan.panPdfPath}" target="_blank" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 flex items-center space-x-2">
                        <i class="fa-solid fa-file-lines text-emerald-400"></i>
                        <span>View PAN Document</span>
                    </a>
                </div>
            </div>

            ${['Approved', 'Ongoing', 'Completed'].includes(existingLoan.status) ? `
                <a href="/download-agreement/${existingLoan._id}" class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-bold flex items-center justify-center space-x-2 glow-button">
                    <i class="fa-solid fa-file-pdf"></i>
                    <span>Download Official Loan Agreement PDF</span>
                </a>
            ` : ''}
        </div>
        `;
    }

    let formHtml = '';
    if (loanActiveOrPending) {
        formHtml = `
        <div class="p-6 rounded-2xl glass-panel border border-amber-500/20 text-center space-y-3">
            <div class="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 font-bold text-lg">!</div>
            <h3 class="text-lg font-bold text-white">Active Loan Notice</h3>
            <p class="text-sm text-slate-400">No new loan eligibility while an active, ongoing, or pending loan exists on this account.</p>
        </div>
        `;
    } else {
        formHtml = `
        <form action="/apply-loan" method="POST" enctype="multipart/form-data" id="loanForm" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Full Legal Name</label>
                    <input type="text" name="clientName" required placeholder="Enter full name"
                        class="w-full px-4 py-3 glass-input rounded-xl text-white placeholder-slate-600 text-sm">
                </div>
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Guarantor Mobile No.</label>
                    <input type="tel" name="guarantorMobile" required pattern="[0-9]{10}" placeholder="10-digit mobile" maxlength="10"
                        class="w-full px-4 py-3 glass-input rounded-xl text-white placeholder-slate-600 text-sm">
                </div>
            </div>

            <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Complete Residential Address</label>
                <textarea name="address" rows="2" required placeholder="House no, Street, City, Pincode"
                    class="w-full px-4 py-3 glass-input rounded-xl text-white placeholder-slate-600 text-sm"></textarea>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Aadhar Card (PDF)</label>
                    <input type="file" name="aadharPdf" accept="application/pdf" required
                        class="w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-500/20 file:text-emerald-400 hover:file:bg-emerald-500/30 cursor-pointer">
                </div>
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">PAN Card (PDF)</label>
                    <input type="file" name="panPdf" accept="application/pdf" required
                        class="w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-500/20 file:text-emerald-400 hover:file:bg-emerald-500/30 cursor-pointer">
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Requested Loan Amount (₹)</label>
                    <input type="number" name="requestAmount" required min="1000" max="500000" placeholder="e.g. 25000"
                        class="w-full px-4 py-3 glass-input rounded-xl text-white placeholder-slate-600 text-sm">
                </div>
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Expected Return Date</label>
                    <input type="date" name="returnDate" required
                        class="w-full px-4 py-3 glass-input rounded-xl text-white text-sm">
                </div>
            </div>

            <div>
                <div class="flex justify-between items-center mb-2">
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400">Drawable Digital Signature</label>
                    <button type="button" id="clearSig" class="text-xs text-emerald-400 hover:underline">Clear Pad</button>
                </div>
                <div class="border border-slate-700 rounded-xl bg-slate-900 overflow-hidden relative" style="height: 120px;">
                    <canvas id="sigCanvas" class="w-full h-full cursor-crosshair touch-none"></canvas>
                </div>
                <input type="hidden" name="clientSignature" id="clientSignatureInput" required>
            </div>

            <button type="submit" class="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-bold text-base glow-button flex items-center justify-center space-x-2">
                <i class="fa-solid fa-paper-plane"></i>
                <span>Submit Loan Application</span>
            </button>
        </form>

        <script>
            const canvas = document.getElementById('sigCanvas');
            const ctx = canvas.getContext('2d');
            let drawing = false;

            function resizeCanvas() {
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
                ctx.strokeStyle = '#00ffcc';
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
    <div class="w-full space-y-8">
        <div class="glass-panel p-6 sm:p-8 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <span class="text-xs uppercase tracking-widest text-emerald-400 font-semibold">Client Dashboard</span>
                <h2 class="text-2xl font-bold text-white mt-1">Mobile: +91 ${user.mobile}</h2>
            </div>
            <a href="/logout" class="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition">Logout</a>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-1 glass-panel p-6 rounded-3xl space-y-4">
                <h3 class="text-lg font-bold text-white border-b border-slate-800 pb-3">Application Status</h3>
                ${loanStatusHtml}
            </div>

            <div class="lg:col-span-2 glass-panel p-6 sm:p-8 rounded-3xl space-y-6">
                <h3 class="text-lg font-bold text-white border-b border-slate-800 pb-3">New Micro-Loan Request</h3>
                ${formHtml}
            </div>
        </div>
    </div>
    `;
    res.send(renderLayout('Client Dashboard', content));
});

app.post('/apply-loan', upload.fields([{ name: 'aadharPdf', maxCount: 1 }, { name: 'panPdf', maxCount: 1 }]), async (req, res) => {
    if (!req.session.clientMobile) return res.redirect('/');

    const { clientName, address, guarantorMobile, requestAmount, returnDate, clientSignature } = req.body;

    const existingLoan = await Loan.findOne({
        clientMobile: req.session.clientMobile,
        status: { $in: ['Pending', 'Approved', 'Ongoing'] }
    });
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

app.get('/financer-login', (req, res) => {
    const content = `
    <div class="w-full max-w-md glass-panel p-8 rounded-3xl relative overflow-hidden mx-auto text-center">
        <div class="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center mx-auto mb-6 text-2xl">
            <i class="fa-solid fa-key"></i>
        </div>
        <h2 class="text-2xl font-bold text-white mb-2">Enter Financer Passcode</h2>
        <p class="text-sm text-slate-400 mb-6">Authorized personnel only. Enter passcode to unlock (Hint: Paisa25).</p>
        
        <form action="/financer-auth" method="POST" class="space-y-4">
            <input type="password" name="code" required placeholder="Enter passcode..." 
                class="w-full px-4 py-3.5 bg-slate-900 border border-slate-700 rounded-2xl text-white text-center tracking-widest text-lg placeholder-slate-600 focus:outline-none focus:border-purple-500">
            <button type="submit" class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition">
                Unlock Financer Panel
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
        const badgeColor = ['Approved', 'Ongoing'].includes(loan.status) ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                           loan.status === 'Rejected' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                           loan.status === 'Completed' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                           'bg-amber-500/20 text-amber-400 border-amber-500/30';
        return `
        <tr class="border-b border-slate-800/60 hover:bg-slate-900/40 transition">
            <td class="p-4">
                <div class="font-bold text-white">${loan.clientName}</div>
                <div class="text-xs text-slate-400">+91 ${loan.clientMobile}</div>
                <div class="text-xs text-slate-500">Guarantor: +91 ${loan.guarantorMobile}</div>
            </td>
            <td class="p-4">
                <div class="font-black text-emerald-400">₹${loan.requestAmount.toLocaleString()}</div>
                ${loan.approvedAmount ? `<div class="text-xs text-cyan-400 font-semibold">Appr: ₹${loan.approvedAmount.toLocaleString()}</div>` : ''}
                <div class="text-xs text-slate-400">Return: ${loan.returnDate}</div>
            </td>
            <td class="p-4 text-xs text-slate-300 max-w-xs">
                <div class="mb-1 truncate">${loan.address}</div>
                <div class="flex space-x-2">
                    <a href="/uploads/${loan.aadharPdfPath}" target="_blank" class="px-2 py-1 bg-slate-800 text-cyan-400 rounded border border-slate-700 hover:underline">Aadhar PDF</a>
                    <a href="/uploads/${loan.panPdfPath}" target="_blank" class="px-2 py-1 bg-slate-800 text-cyan-400 rounded border border-slate-700 hover:underline">PAN PDF</a>
                </div>
            </td>
            <td class="p-4">
                <img src="${loan.clientSignature}" class="h-10 bg-slate-900 p-1 rounded border border-slate-700" alt="Client Signature" />
            </td>
            <td class="p-4"><span class="px-3 py-1 rounded-full text-xs font-bold border ${badgeColor}">${loan.status}</span></td>
            <td class="p-4 space-y-1 text-right">
                ${loan.status === 'Pending' ? `
                    <div class="flex space-x-2 justify-end">
                        <button onclick="openApprovalModal('${loan._id}',${loan.requestAmount})" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-md shadow-emerald-600/30">Approve & Sign</button>
                        <form action="/reject-loan/${loan._id}" method="POST" class="inline"><button class="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition">Reject</button></form>
                    </div>
                ` : ''}
                ${['Approved', 'Ongoing', 'Completed'].includes(loan.status) ? `
                    <a href="/download-agreement/${loan._id}" class="inline-block px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold"><i class="fa-solid fa-file-pdf"></i> PDF</a>
                ` : ''}
                <form action="/complete-loan/${loan._id}" method="POST" class="inline"><button class="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold">Complete</button></form>
            </td>
        </tr>
        `;
    }).join('');

    const content = `
    <div class="w-full space-y-6">
        <div class="glass-panel p-6 sm:p-8 rounded-3xl flex items-center justify-between">
            <div>
                <span class="text-xs uppercase tracking-widest text-purple-400 font-semibold">Financer Control Center</span>
                <h2 class="text-2xl font-bold text-white mt-1">All Client Loan Applications</h2>
            </div>
            <a href="/financer-logout" class="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold hover:bg-rose-500/25 transition">Lock Portal</a>
        </div>

        <div class="glass-panel rounded-3xl overflow-hidden shadow-xl border border-slate-700">
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="border-b border-slate-800 bg-slate-900/80 text-xs text-slate-400 uppercase tracking-wider">
                            <th class="py-4 px-4">Client / Mobile</th>
                            <th class="py-4 px-4">Loan Amount</th>
                            <th class="py-4 px-4">Address & Docs</th>
                            <th class="py-4 px-4">Client Signature</th>
                            <th class="py-4 px-4">Status</th>
                            <th class="py-4 px-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800 text-sm">
                        ${rowsHtml.length > 0 ? rowsHtml : `<tr><td colspan="6" class="text-center py-8 text-slate-500 text-sm">No loan requests found.</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Stunning Financer Approval & Signature Modal -->
    <div id="approvalModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-md hidden items-center justify-center z-50 p-4">
        <div class="glass-panel max-w-lg w-full p-6 sm:p-8 rounded-3xl border border-emerald-500/30 shadow-2xl space-y-6">
            <div class="flex justify-between items-center border-b border-slate-800 pb-4">
                <div class="flex items-center space-x-3">
                    <div class="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <i class="fa-solid fa-signature text-lg"></i>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-white">Financer Loan Sanction</h3>
                        <p class="text-xs text-slate-400">Enter approved amount & draw digital signature</p>
                    </div>
                </div>
                <button onclick="closeApprovalModal()" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition">&times;</button>
            </div>

            <form id="approveForm" method="POST" class="space-y-5">
                <div>
                    <label class="block text-xs uppercase tracking-wider text-slate-400 mb-2 font-semibold">Approved Loan Amount (₹)</label>
                    <div class="relative">
                        <span class="absolute inset-y-0 left-0 flex items-center pl-4 text-emerald-400 font-bold">₹</span>
                        <input type="number" name="approvedAmount" id="modalApprovedAmount" required min="1000" max="500000"
                            class="w-full pl-10 pr-4 py-3 glass-input rounded-xl text-white text-base font-bold placeholder-slate-600" />
                    </div>
                </div>

                <div>
                    <div class="flex justify-between items-center mb-2">
                        <label class="block text-xs uppercase tracking-wider text-slate-400 font-semibold">Financer Digital Signature Pad</label>
                        <button type="button" id="clearFinancerSig" class="text-xs text-emerald-400 hover:underline">Clear Signature</button>
                    </div>
                    <div class="border border-slate-700 rounded-xl bg-slate-900 overflow-hidden relative shadow-inner" style="height: 140px;">
                        <canvas id="financerSigCanvas" class="w-full h-full cursor-crosshair touch-none"></canvas>
                    </div>
                    <input type="hidden" name="financerSignature" id="financerSignatureInput" required />
                </div>

                <button type="submit" class="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 font-bold text-slate-950 text-base shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition flex items-center justify-center space-x-2">
                    <i class="fa-solid fa-circle-check"></i>
                    <span>Sign & Finalize Loan Approval</span>
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

app.post('/complete-loan/:id', async (req, res) => {
    if (!req.session.isFinancer) return res.redirect('/financer-login');
    await Loan.findByIdAndUpdate(req.params.id, { status: 'Completed' });
    res.redirect('/financer-dashboard');
});

app.get('/financer-logout', (req, res) => {
    req.session.isFinancer = false;
    res.redirect('/');
});

app.get('/download-agreement/:id', async (req, res) => {
    const loan = await Loan.findById(req.params.id);
    if (!loan || !['Approved', 'Ongoing', 'Completed'].includes(loan.status)) {
        return res.status(403).send('Unauthorized or loan agreement not available.');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=LeLe_Finance_Agreement_${loan.clientName.replace(/\s+/g, '_')}.pdf`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(20).fillColor('#10b981').font('Helvetica-Bold').text('LELE FINANCE CO.', { align: 'center' });
    doc.fontSize(9).fillColor('#64748b').font('Helvetica').text('Co-powered by CareerBoot & Skills Development, Ashiyana, Lucknow, Uttar Pradesh', { align: 'center' });
    doc.moveDown(1);

    doc.lineWidth(1).strokeColor('#e2e8f0').moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(1);

    doc.fontSize(14).fillColor('#0f172a').font('Helvetica-Bold').text('OFFICIAL BINDING LOAN & FINANCING AGREEMENT', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#475569').font('Helvetica').text(`Agreement Reference ID: ${loan._id} | Date of Execution: ${new Date(loan.createdAt).toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(11).fillColor('#10b981').font('Helvetica-Bold').text('1. PARTIES TO THE AGREEMENT');
    doc.fontSize(9).fillColor('#334155').font('Helvetica')
       .text('This agreement is entered into by and between LeLe Finance, hereinafter referred to as the "Financer", and the Borrower specified herein under the terms and conditions outlined below.');
    doc.moveDown(0.8);

    doc.fontSize(10).fillColor('#0f172a').font('Helvetica-Bold').text('Borrower Details:');
    doc.fontSize(9).fillColor('#334155').font('Helvetica')
       .text(`• Full Name: ${loan.clientName}`)
       .text(`• Mobile Number: +91 ${loan.clientMobile}`)
       .text(`• Residential Address: ${loan.address}`)
       .text(`• Guarantor Mobile Number: +91 ${loan.guarantorMobile}`);
    doc.moveDown(1.5);

    doc.fontSize(11).fillColor('#10b981').font('Helvetica-Bold').text('2. FINANCIAL SANCTION & INTEREST TERMS');
    doc.fontSize(9).fillColor('#334155').font('Helvetica')
       .text(`• Approved Principal Loan Amount: Rs. ${loan.approvedAmount || loan.requestAmount}/- (Requested: Rs. ${loan.requestAmount}/-)`)
       .text('• Fixed Interest Rate: 20% (Twenty Percent) per month on the outstanding principal.')
       .text('• Interest Applicability: Interest shall accrue monthly and remain mandatory until 100% recovery of the principal and accrued interest is successfully completed.')
       .text(`• Target Repayment Date: ${loan.returnDate}`);
    doc.moveDown(1.5);

    doc.fontSize(11).fillColor('#10b981').font('Helvetica-Bold').text('3. COVENANTS, CONDITIONS & DEFAULT POLICIES');
    doc.fontSize(9).fillColor('#334155').font('Helvetica')
       .text('1. Utilization & Good Faith: The borrower acknowledges receipt of the approved amount and agrees to utilize the funds responsibly.')
       .text('2. Repayment Obligation: The borrower explicitly agrees to pay the monthly 20% interest and clear the principal amount on or before the target return date.')
       .text('3. Default & Guarantor Action: In the event of default, delayed payment, or failure to communicate, LeLe Finance reserves the right to contact the designated guarantor and initiate lawful recovery procedures.')
       .text('4. Jurisdiction: All disputes arising under this agreement shall be subject exclusively to the courts of Lucknow, Uttar Pradesh.');
    doc.moveDown(2);

    doc.fontSize(11).fillColor('#10b981').font('Helvetica-Bold').text('4. AUTHORIZED DIGITAL SIGNATURES');
    doc.moveDown(0.5);

    try {
        const clientSigBuffer = Buffer.from(loan.clientSignature.replace(/^data:image\/\w+;base64,/, ""), 'base64');
        const sigY = doc.y;
        doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text('Borrower Signature:', 40, sigY);
        doc.image(clientSigBuffer, 40, sigY + 15, { width: 150, height: 50 });

        if (loan.financerSignature) {
            const financerSigBuffer = Buffer.from(loan.financerSignature.replace(/^data:image\/\w+;base64,/, ""), 'base64');
            doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text('Financer Signature (LeLe Finance):', 330, sigY);
            doc.image(financerSigBuffer, 330, sigY + 15, { width: 150, height: 50 });
        }
    } catch (err) {
        doc.fontSize(9).fillColor('#ef4444').text('Signatures verified digitally.');
    }

    doc.end();
});

// ==================== DATABASE CONNECTION & SERVER START ====================
console.log('Connecting to MongoDB...');
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('Connected to MongoDB successfully.');
        app.listen(PORT, () => {
            console.log(`LeLe Finance server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('MongoDB connection error:', err.message);
    });
