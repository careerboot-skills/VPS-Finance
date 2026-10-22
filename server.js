/**
 * LE_LE FINANCE co-powered by CareerBoot
 * Single-file Node.js/Express + MongoDB backend & Next-Gen 4D UI Server Application
 * 
 * Instructions:
 * 1. Install dependencies: npm install express mongoose multer jsonwebtoken dotenv cors
 * 2. Set environment variables (or rely on fallbacks): MONGODB_URI, JWT_SECRET, PORT
 * 3. Run: node server.js
 * 4. Deploy to Render / GitHub.
 */

const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'le_le_finance_super_secret_jwt_key_2026';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lele_finance';

// Middleware Setup
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors());

// Configure Uploads Directory
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`)
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed!'), false);
        }
    }
});

// Serve Static Uploads Safely
app.use('/uploads', express.static(uploadDir));

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Successfully connected to MongoDB.'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// Database Schemas & Models
const UserSchema = new mongoose.Schema({
    mobile: { type: String, required: true, unique: true },
    name: { type: String, default: '' },
    address: { type: String, default: '' },
    civilScore: { type: Number, default: 750 },
    maxLimit: { type: Number, default: 2000 },
    createdAt: { type: Date, default: Date.now }
});

const LoanSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    clientMobile: { type: String, required: true },
    clientName: { type: String, required: true },
    address: { type: String, required: true },
    guarantorMobile: { type: String, required: true },
    requestedAmount: { type: Number, required: true },
    returnDate: { type: Date, required: true },
    upiId: { type: String, required: true },
    aadharPdfUrl: { type: String, required: true },
    panPdfUrl: { type: String, required: true },
    clientSignature: { type: String, required: true }, // Base64 string
    
    // Status tracking: 'PENDING', 'APPROVED', 'REJECTED', 'PAID'
    status: { type: String, default: 'PENDING' },
    financerSignature: { type: String, default: '' },
    approvalDate: { type: Date },
    rejectionReason: { type: String, default: '' },
    penaltyInterest: { type: Number, default: 0 },
    
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Loan = mongoose.model('Loan', LoanSchema);

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied. Token missing.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token.' });
        req.user = user;
        next();
    });
};

// ==================== API ENDPOINTS ====================

// Auth Endpoint: Client Login / Registration by Mobile
app.post('/api/auth/login', async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile || !/^\d{10}$/.test(mobile)) {
            return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
        }

        let user = await User.findOne({ mobile });
        if (!user) {
            user = await User.create({ mobile, civilScore: 750, maxLimit: 2000 });
        }

        const token = jwt.sign({ userId: user._id, mobile: user.mobile }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user });
    } catch (err) {
        res.status(500).json({ error: 'Server Auth Error: ' + err.message });
    }
});

// Fetch Current Client Profile
app.get('/api/client/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        const activeLoan = await Loan.findOne({ userId: req.user.userId, status: { $in: ['PENDING', 'APPROVED'] } });
        res.json({ user, activeLoan });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Client Submit Loan Application
app.post('/api/loans/apply', authenticateToken, upload.fields([
    { name: 'aadharPdf', maxCount: 1 },
    { name: 'panPdf', maxCount: 1 }
]), async (req, res) => {
    try {
        const { name, address, guarantorMobile, requestedAmount, returnDate, upiId, clientSignature } = req.body;
        const userId = req.user.userId;
        const clientMobile = req.user.mobile;

        // Validation Checks
        if (guarantorMobile === clientMobile) {
            return res.status(400).json({ error: "Guarantor mobile number cannot be the same as client's number." });
        }

        const activeLoan = await Loan.findOne({ userId, status: { $in: ['PENDING', 'APPROVED'] } });
        if (activeLoan) {
            return res.status(400).json({ error: "You already have an active or pending loan. New applications are locked until completion." });
        }

        const user = await User.findById(userId);
        const amount = parseFloat(requestedAmount);
        if (amount > user.maxLimit) {
            return res.status(400).json({ error: `Requested amount exceeds your maximum allowed limit of ₹${user.maxLimit}` });
        }

        if (!req.files || !req.files.aadharPdf || !req.files.panPdf) {
            return res.status(400).json({ error: "Both Aadhar and PAN PDF documents are strictly required." });
        }

        // Update basic profile details
        user.name = name;
        user.address = address;
        await user.save();

        const loan = new Loan({
            userId,
            clientMobile,
            clientName: name,
            address,
            guarantorMobile,
            requestedAmount: amount,
            returnDate: new Date(returnDate),
            upiId,
            aadharPdfUrl: `/uploads/${req.files.aadharPdf[0].filename}`,
            panPdfUrl: `/uploads/${req.files.panPdf[0].filename}`,
            clientSignature
        });

        await loan.save();
        res.json({ message: "Loan application submitted successfully!", loan });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Financer: Verify Passcode Access
app.post('/api/financer/verify', (req, res) => {
    const { code } = req.body;
    if (code === 'Paisa25') {
        res.json({ success: true, message: 'Financer portal unlocked successfully.' });
    } else {
        res.status(401).json({ error: 'Incorrect Passcode! Access Denied.' });
    }
});

// Financer: Fetch All Applications
app.post('/api/financer/loans', async (req, res) => {
    const { code } = req.body;
    if (code !== 'Paisa25') return res.status(403).json({ error: 'Unauthorized.' });

    try {
        const loans = await Loan.find().populate('userId').sort({ createdAt: -1 });
        res.json(loans);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Financer: Approve or Reject Loan
app.post('/api/financer/decision', async (req, res) => {
    const { code, loanId, decision, financerSignature, customLimit } = req.body;
    if (code !== 'Paisa25') return res.status(403).json({ error: 'Unauthorized.' });

    try {
        const loan = await Loan.findById(loanId);
        if (!loan) return res.status(404).json({ error: 'Loan request not found.' });

        if (decision === 'APPROVE') {
            if (!financerSignature) return res.status(400).json({ error: 'Financer signature is mandatory for loan approval.' });
            loan.status = 'APPROVED';
            loan.financerSignature = financerSignature;
            loan.approvalDate = new Date();
        } else if (decision === 'REJECT') {
            loan.status = 'REJECTED';
            
            // Defaulter / Rejection penalty impact on LeLe Civil Score
            const user = await User.findById(loan.userId);
            if (user) {
                user.civilScore = Math.max(300, user.civilScore - 50);
                if (customLimit !== undefined) {
                    user.maxLimit = parseFloat(customLimit);
                }
                await user.save();
            }
        }

        await loan.save();
        res.json({ message: `Loan successfully ${decision.toLowerCase()}d.`, loan });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Client/Financer: Repay Loan Endpoint (Calculates Interest & Upgrades Score)
app.post('/api/loans/repay', authenticateToken, async (req, res) => {
    try {
        const { loanId } = req.body;
        const loan = await Loan.findById(loanId);
        if (!loan || loan.status !== 'APPROVED') return res.status(400).json({ error: 'Invalid active loan.' });

        const user = await User.findById(loan.userId);
        const today = new Date();
        const createdDate = new Date(loan.createdAt);
        const diffTime = Math.abs(today - createdDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let latePenaltyInterest = 0;
        let isLate = false;

        // Check 30-Day Rule
        if (diffDays > 30) {
            isLate = true;
            const overdueDays = diffDays - 30;
            // 5% interest per day overdue
            latePenaltyInterest = loan.requestedAmount * (0.05 * overdueDays);
        }

        loan.status = 'PAID';
        loan.penaltyInterest = latePenaltyInterest;
        await loan.save();

        if (!isLate) {
            // Paid on time: Increase civil score and auto-increase limit by 25%
            user.civilScore = Math.min(900, user.civilScore + 35);
            user.maxLimit = Math.round(user.maxLimit * 1.25);
        } else {
            // Defaulter: Drop civil score
            user.civilScore = Math.max(300, user.civilScore - 75);
        }
        await user.save();

        res.json({ 
            message: isLate ? `Loan Repaid with 5%/day overdue penalty.` : `Loan Repaid on time! Your credit limit increased by 25%!`,
            civilScore: user.civilScore,
            newLimit: user.maxLimit
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== SERVE CLIENT FRONTEND ====================
app.get('*', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Le_Le Finance | co-powered by CareerBoot</title>
        <!-- Tailwind CSS & Lucide Icons -->
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/lucide@latest"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;800&display=swap');
            body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #030712; color: #f3f4f6; overflow-x: hidden; }
            canvas#canvas4d { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 0; pointer-events: none; }
            .glass { background: rgba(17, 24, 39, 0.65); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.08); }
            .glass-gold { background: rgba(245, 158, 11, 0.05); backdrop-filter: blur(16px); border: 1px solid rgba(245, 158, 11, 0.2); }
            .glow-text { text-shadow: 0 0 20px rgba(59, 130, 246, 0.6); }
            .glow-gold { text-shadow: 0 0 20px rgba(245, 158, 11, 0.6); }
            .btn-glow { box-shadow: 0 0 25px rgba(59, 130, 246, 0.4); }
            .btn-glow:hover { box-shadow: 0 0 35px rgba(59, 130, 246, 0.7); }
        </style>
    </head>
    <body class="relative min-h-screen">

        <!-- 4D Interactive Three.js Background -->
        <canvas id="canvas4d"></canvas>

        <div class="relative z-10 flex flex-col min-h-screen">
            <!-- Header Nav -->
            <header class="glass sticky top-0 z-50 px-6 py-4 flex justify-between items-center border-b border-gray-800">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-yellow-500 via-amber-400 to-amber-600 flex items-center justify-center font-black text-2xl text-black shadow-lg shadow-amber-500/20 tracking-tighter">
                        L₹
                    </div>
                    <div>
                        <h1 class="text-xl font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500">
                            Le_Le Finance
                        </h1>
                        <p class="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">co-powered by CareerBoot</p>
                    </div>
                </div>

                <div class="flex items-center gap-4">
                    <button id="financerBtn" onclick="openFinancerModal()" class="px-4 py-2 rounded-xl bg-gray-900/80 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-black font-semibold text-xs transition-all flex items-center gap-2">
                        <i data-lucide="shield-check" class="w-4 h-4"></i> Financer Portal
                    </button>
                    <button id="logoutBtn" onclick="logout()" class="hidden px-3 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs">
                        <i data-lucide="log-out" class="w-4 h-4"></i>
                    </button>
                </div>
            </header>

            <!-- Main Content Container -->
            <main class="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">

                <!-- Auth Screen -->
                <div id="authScreen" class="glass p-8 rounded-3xl max-w-md mx-auto w-full shadow-2xl border border-gray-800 my-auto">
                    <div class="text-center mb-8">
                        <h2 class="text-3xl font-extrabold text-white mb-2">Welcome Back</h2>
                        <p class="text-gray-400 text-sm">Enter your 10-digit mobile number to access Instant 0% Interest Loans.</p>
                    </div>
                    <form onsubmit="handleLogin(event)" class="space-y-6">
                        <div>
                            <label class="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Mobile Number</label>
                            <div class="relative">
                                <span class="absolute left-4 top-3.5 text-gray-400 text-sm font-bold">+91</span>
                                <input type="tel" id="loginMobile" maxlength="10" required placeholder="9005041462" class="w-full bg-gray-950 border border-gray-800 rounded-xl py-3.5 pl-14 pr-4 text-white font-medium focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none transition">
                            </div>
                        </div>
                        <button type="submit" class="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold text-sm uppercase tracking-wider btn-glow hover:opacity-95 transition">
                            Continue / Express Register
                        </button>
                    </form>
                </div>

                <!-- Dashboard Screen -->
                <div id="dashboardScreen" class="hidden space-y-6">
                    <!-- Civil Score Banner -->
                    <div class="glass-gold p-6 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
                        <div class="space-y-2 text-center md:text-left">
                            <span class="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
                                LeLe Credit Health Profile
                            </span>
                            <h3 class="text-2xl font-black text-white">Credit Score & Allowed Limit</h3>
                            <p class="text-xs text-gray-400 max-w-md">Every timely payback automatically boosts your credit standing and unlocks a 25% higher borrowing limit!</p>
                        </div>
                        <div class="flex items-center gap-6">
                            <div class="text-center">
                                <p class="text-xs uppercase text-gray-400 font-bold tracking-wider">LeLe Civil Score</p>
                                <p id="civilScoreVal" class="text-4xl font-black text-amber-400 glow-gold">750</p>
                            </div>
                            <div class="h-10 w-[1px] bg-gray-800"></div>
                            <div class="text-center">
                                <p class="text-xs uppercase text-gray-400 font-bold tracking-wider">Max Limit</p>
                                <p id="maxLimitVal" class="text-4xl font-black text-green-400 glow-text">₹2,000</p>
                            </div>
                        </div>
                    </div>

                    <!-- Ongoing Active Loan Card -->
                    <div id="activeLoanContainer" class="hidden glass p-6 rounded-3xl space-y-6 border border-amber-500/30">
                        <div class="flex justify-between items-start">
                            <div>
                                <span id="loanStatusBadge" class="px-3 py-1 rounded-full text-xs font-bold uppercase"></span>
                                <h4 class="text-xl font-extrabold text-white mt-2">Active Loan Agreement</h4>
                            </div>
                            <button id="downloadAgreementBtn" onclick="downloadAgreementPDF()" class="hidden px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold hover:bg-amber-500 hover:text-black transition flex items-center gap-2">
                                <i data-lucide="download" class="w-4 h-4"></i> Download Agreement PDF
                            </button>
                        </div>

                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-950/60 p-4 rounded-2xl border border-gray-800/60">
                            <div>
                                <p class="text-xs text-gray-400">Principal Amount</p>
                                <p id="loanAmount" class="text-lg font-bold text-white">₹0</p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-400">Interest Terms</p>
                                <p class="text-lg font-bold text-green-400">0% (30 Days Free)</p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-400">Due Date</p>
                                <p id="loanReturnDate" class="text-lg font-bold text-amber-400">-</p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-400">UPI Receival Address</p>
                                <p id="loanUpi" class="text-lg font-bold text-gray-200">-</p>
                            </div>
                        </div>

                        <div id="repaySection" class="hidden pt-2 flex justify-end">
                            <button onclick="repayLoan()" class="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-400 text-black font-extrabold text-xs uppercase tracking-wider hover:opacity-95 shadow-lg shadow-green-500/20">
                                Repay Full Amount Now
                            </button>
                        </div>
                    </div>

                    <!-- Application Locked Alert -->
                    <div id="lockedNotice" class="hidden glass p-6 rounded-3xl text-center space-y-2 border border-blue-500/30">
                        <i data-lucide="lock" class="w-8 h-8 text-blue-400 mx-auto"></i>
                        <h4 class="text-lg font-bold text-white">New Loan Applications Locked</h4>
                        <p class="text-xs text-gray-400">You currently have an active or pending loan request. Complete or clear your existing loan to unlock a new application.</p>
                    </div>

                    <!-- Loan Request Form -->
                    <div id="applicationFormContainer" class="glass p-8 rounded-3xl space-y-6">
                        <h3 class="text-2xl font-black text-white flex items-center gap-2">
                            <i data-lucide="file-plus" class="w-6 h-6 text-amber-400"></i> Request Micro-Loan
                        </h3>

                        <form id="loanForm" onsubmit="submitLoanApplication(event)" class="space-y-6">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label class="block text-xs font-semibold uppercase text-gray-400 mb-2">Full Client Name</label>
                                    <input type="text" id="clientName" required placeholder="Vaibhav Joshi" class="w-full bg-gray-950 border border-gray-800 rounded-xl p-3.5 text-white font-medium focus:border-amber-400 outline-none">
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold uppercase text-gray-400 mb-2">Guarantor Mobile Number</label>
                                    <input type="tel" id="guarantorMobile" maxlength="10" required placeholder="Must be different from client" class="w-full bg-gray-950 border border-gray-800 rounded-xl p-3.5 text-white font-medium focus:border-amber-400 outline-none">
                                </div>
                            </div>

                            <div>
                                <label class="block text-xs font-semibold uppercase text-gray-400 mb-2">Complete Address</label>
                                <textarea id="clientAddress" required rows="2" placeholder="Ashiyana, Lucknow, Uttar Pradesh" class="w-full bg-gray-950 border border-gray-800 rounded-xl p-3.5 text-white font-medium focus:border-amber-400 outline-none"></textarea>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label class="block text-xs font-semibold uppercase text-gray-400 mb-2">Loan Amount (Max ₹2,000)</label>
                                    <input type="number" id="requestedAmount" max="2000" min="100" required value="2000" class="w-full bg-gray-950 border border-gray-800 rounded-xl p-3.5 text-white font-medium focus:border-amber-400 outline-none">
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold uppercase text-gray-400 mb-2">Return Date</label>
                                    <input type="date" id="returnDate" required class="w-full bg-gray-950 border border-gray-800 rounded-xl p-3.5 text-white font-medium focus:border-amber-400 outline-none">
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold uppercase text-gray-400 mb-2">UPI ID (For Funds Transfer)</label>
                                    <input type="text" id="upiId" required placeholder="user@upi" class="w-full bg-gray-950 border border-gray-800 rounded-xl p-3.5 text-white font-medium focus:border-amber-400 outline-none">
                                </div>
                            </div>

                            <!-- PDF Uploads -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div class="p-4 border border-dashed border-gray-700 rounded-2xl bg-gray-950/40">
                                    <label class="block text-xs font-semibold uppercase text-gray-300 mb-2">Upload Aadhar PDF</label>
                                    <input type="file" id="aadharPdf" accept="application/pdf" required class="text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-500/20 file:text-amber-300 hover:file:bg-amber-500/30">
                                </div>
                                <div class="p-4 border border-dashed border-gray-700 rounded-2xl bg-gray-950/40">
                                    <label class="block text-xs font-semibold uppercase text-gray-300 mb-2">Upload PAN PDF</label>
                                    <input type="file" id="panPdf" accept="application/pdf" required class="text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-500/20 file:text-amber-300 hover:file:bg-amber-500/30">
                                </div>
                            </div>

                            <!-- Signature Pad -->
                            <div>
                                <div class="flex justify-between items-center mb-2">
                                    <label class="text-xs font-semibold uppercase text-gray-400">Client Digital Signature (Draw Below)</label>
                                    <button type="button" onclick="clearSignature('clientSigCanvas')" class="text-xs text-amber-400 hover:underline">Clear Canvas</button>
                                </div>
                                <canvas id="clientSigCanvas" width="500" height="150" class="w-full bg-gray-950 border border-gray-800 rounded-xl touch-none"></canvas>
                            </div>

                            <button type="submit" class="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold text-sm uppercase tracking-wider btn-glow hover:opacity-95 transition">
                                Submit Formal Loan Request
                            </button>
                        </form>
                    </div>
                </div>

            </main>

            <!-- Footer -->
            <footer class="glass px-6 py-4 text-center text-xs text-gray-500 border-t border-gray-800 mt-auto">
                Le_Le Finance co-powered by <span class="text-amber-400 font-bold">CareerBoot</span> &copy; 2026. All rights reserved. 0% Interest subject to 30-day repayment.
            </footer>
        </div>

        <!-- Financer Unlocking Modal -->
        <div id="financerCodeModal" class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div class="glass p-8 rounded-3xl max-w-sm w-full space-y-6 border border-amber-500/30">
                <div class="text-center">
                    <i data-lucide="shield-alert" class="w-10 h-10 text-amber-400 mx-auto mb-2"></i>
                    <h3 class="text-xl font-bold text-white">Financer Gateway</h3>
                    <p class="text-xs text-gray-400">Enter Top Secret Access Code to unlock dashboard.</p>
                </div>
                <input type="password" id="financerPasscode" placeholder="Enter Secret Code" class="w-full bg-gray-950 border border-gray-800 rounded-xl p-3.5 text-center text-white tracking-widest outline-none focus:border-amber-400">
                <div class="flex gap-3">
                    <button onclick="closeFinancerModal()" class="w-1/2 py-3 rounded-xl bg-gray-800 text-gray-300 font-bold text-xs uppercase">Cancel</button>
                    <button onclick="unlockFinancerPortal()" class="w-1/2 py-3 rounded-xl bg-amber-500 text-black font-extrabold text-xs uppercase shadow-lg shadow-amber-500/20">Unlock</button>
                </div>
            </div>
        </div>

        <!-- Financer Admin Portal View Screen -->
        <div id="financerPortalModal" class="hidden fixed inset-0 z-50 bg-black/90 backdrop-blur-lg overflow-y-auto p-4 sm:p-8">
            <div class="max-w-6xl mx-auto space-y-6">
                <div class="flex justify-between items-center glass p-6 rounded-3xl border border-amber-500/40">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center font-black text-black">
                            L₹
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-white">Financer Control Center</h2>
                            <p class="text-xs text-amber-400">Secret Access Granted • Live Loan Demands</p>
                        </div>
                    </div>
                    <button onclick="closeFinancerPortal()" class="px-4 py-2 rounded-xl bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-bold">
                        Exit Portal
                    </button>
                </div>

                <!-- Loan Requests Grid -->
                <div id="financerLoanList" class="space-y-4"></div>
            </div>
        </div>

        <!-- Financer Approval Signature Modal -->
        <div id="approvalModal" class="hidden fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div class="glass p-8 rounded-3xl max-w-lg w-full space-y-6 border border-amber-500/40">
                <h3 class="text-xl font-bold text-white">Authorize & Approve Loan Application</h3>
                <p class="text-xs text-gray-400">Draw your signature below as the authorized financer to complete agreement execution.</p>
                
                <canvas id="financerSigCanvas" width="450" height="150" class="w-full bg-gray-950 border border-gray-800 rounded-xl touch-none"></canvas>
                
                <div class="flex justify-between items-center">
                    <button type="button" onclick="clearSignature('financerSigCanvas')" class="text-xs text-amber-400">Clear</button>
                    <div class="flex gap-3">
                        <button onclick="closeApprovalModal()" class="px-4 py-2 rounded-xl bg-gray-800 text-gray-300 text-xs font-bold">Cancel</button>
                        <button onclick="confirmApproval()" class="px-5 py-2 rounded-xl bg-green-500 text-black font-extrabold text-xs uppercase">Sign & Approve</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Hidden PDF Printable Agreement Container -->
        <div id="pdfTemplate" class="hidden bg-white text-black p-10 space-y-6 text-sm font-serif">
            <div class="text-center border-b-2 border-black pb-4">
                <h1 class="text-2xl font-bold uppercase">Le_Le Finance Loan Agreement</h1>
                <p class="text-xs italic">Co-Powered by CareerBoot Center of Excellence</p>
            </div>
            
            <div class="grid grid-cols-2 gap-4 text-xs">
                <div><strong>Agreement Date:</strong> <span id="pdfDate"></span></div>
                <div><strong>Status:</strong> <span id="pdfStatus">APPROVED</span></div>
                <div><strong>Client Name:</strong> <span id="pdfClientName"></span></div>
                <div><strong>Client Mobile:</strong> <span id="pdfClientMobile"></span></div>
                <div><strong>Guarantor Mobile:</strong> <span id="pdfGuarantor"></span></div>
                <div><strong>Client Address:</strong> <span id="pdfAddress"></span></div>
            </div>

            <div class="border p-4 bg-gray-50 rounded">
                <h3 class="font-bold border-b pb-1 mb-2">Loan Financial Terms</h3>
                <p><strong>Approved Principal Amount:</strong> ₹<span id="pdfAmount"></span></p>
                <p><strong>Interest Rate:</strong> 0% Interest for first 30 Days.</p>
                <p><strong>Scheduled Return Date:</strong> <span id="pdfReturnDate"></span></p>
                <p><strong>Default Terms:</strong> Beyond 30 days, an interest penalty of 5% per day will apply until full loan liquidation.</p>
            </div>

            <div class="grid grid-cols-2 gap-8 pt-8">
                <div class="text-center">
                    <img id="pdfClientSig" class="h-16 mx-auto border-b border-black mb-1" alt="Client Signature">
                    <p class="font-bold text-xs">Client Signature</p>
                </div>
                <div class="text-center">
                    <img id="pdfFinancerSig" class="h-16 mx-auto border-b border-black mb-1" alt="Financer Signature">
                    <p class="font-bold text-xs">Authorized Financer Signature</p>
                </div>
            </div>
        </div>

        <!-- JavaScript Logic -->
        <script>
            let authToken = localStorage.getItem('lele_token') || '';
            let currentActiveLoan = null;
            let financerCode = '';
            let pendingApprovalLoanId = null;

            // Signature Pads
            function initSignaturePad(canvasId) {
                const canvas = document.getElementById(canvasId);
                const ctx = canvas.getContext('2d');
                let drawing = false;

                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 2.5;
                ctx.lineCap = 'round';

                function getPos(e) {
                    const rect = canvas.getBoundingClientRect();
                    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                    return { x: clientX - rect.left, y: clientY - rect.top };
                }

                function startDraw(e) { drawing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); }
                function draw(e) { if (!drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }
                function endDraw() { drawing = false; }

                canvas.addEventListener('mousedown', startDraw);
                canvas.addEventListener('mousemove', draw);
                canvas.addEventListener('mouseup', endDraw);
                canvas.addEventListener('touchstart', startDraw);
                canvas.addEventListener('touchmove', draw);
                canvas.addEventListener('touchend', endDraw);
            }

            function clearSignature(canvasId) {
                const canvas = document.getElementById(canvasId);
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }

            // Init Three.js 4D Animated Background
            function init4DBackground() {
                const canvas = document.getElementById('canvas4d');
                const scene = new THREE.Scene();
                const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
                const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });

                renderer.setSize(window.innerWidth, window.innerHeight);
                renderer.setPixelRatio(window.devicePixelRatio);

                // Create geometric hyper-mesh particles
                const geometry = new THREE.IcosahedronGeometry(10, 2);
                const material = new THREE.MeshBasicMaterial({ color: 0xd97706, wireframe: true, transparent: true, opacity: 0.15 });
                const sphere = new THREE.Mesh(geometry, material);
                scene.add(sphere);

                camera.position.z = 25;

                function animate() {
                    requestAnimationFrame(animate);
                    sphere.rotation.x += 0.002;
                    sphere.rotation.y += 0.003;
                    renderer.render(scene, camera);
                }
                animate();

                window.addEventListener('resize', () => {
                    camera.aspect = window.innerWidth / window.innerHeight;
                    camera.updateProjectionMatrix();
                    renderer.setSize(window.innerWidth, window.innerHeight);
                });
            }

            // Auth Logic
            async function handleLogin(e) {
                e.preventDefault();
                const mobile = document.getElementById('loginMobile').value;
                try {
                    const res = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mobile })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        authToken = data.token;
                        localStorage.setItem('lele_token', authToken);
                        loadDashboard();
                    } else {
                        alert(data.error);
                    }
                } catch (err) {
                    alert('Login failed: ' + err.message);
                }
            }

            function logout() {
                localStorage.removeItem('lele_token');
                authToken = '';
                document.getElementById('authScreen').classList.remove('hidden');
                document.getElementById('dashboardScreen').classList.add('hidden');
                document.getElementById('logoutBtn').classList.add('hidden');
            }

            async function loadDashboard() {
                if (!authToken) return;
                try {
                    const res = await fetch('/api/client/profile', {
                        headers: { 'Authorization': \`Bearer \${authToken}\` }
                    });
                    const data = await res.json();

                    if (res.ok) {
                        document.getElementById('authScreen').classList.add('hidden');
                        document.getElementById('dashboardScreen').classList.remove('hidden');
                        document.getElementById('logoutBtn').classList.remove('hidden');

                        document.getElementById('civilScoreVal').innerText = data.user.civilScore;
                        document.getElementById('maxLimitVal').innerText = \`₹\${data.user.maxLimit.toLocaleString()}\`;

                        if (data.user.name) document.getElementById('clientName').value = data.user.name;
                        if (data.user.address) document.getElementById('clientAddress').value = data.user.address;

                        currentActiveLoan = data.activeLoan;
                        renderActiveLoanUI();
                    } else {
                        logout();
                    }
                } catch (err) {
                    console.error(err);
                }
            }

            function renderActiveLoanUI() {
                const activeContainer = document.getElementById('activeLoanContainer');
                const lockedNotice = document.getElementById('lockedNotice');
                const formContainer = document.getElementById('applicationFormContainer');
                const agreementBtn = document.getElementById('downloadAgreementBtn');
                const repaySec = document.getElementById('repaySection');

                if (currentActiveLoan) {
                    activeContainer.classList.remove('hidden');
                    lockedNotice.classList.remove('hidden');
                    formContainer.classList.add('hidden');

                    document.getElementById('loanAmount').innerText = \`₹\${currentActiveLoan.requestedAmount}\`;
                    document.getElementById('loanReturnDate').innerText = new Date(currentActiveLoan.returnDate).toLocaleDateString();
                    document.getElementById('loanUpi').innerText = currentActiveLoan.upiId;

                    const badge = document.getElementById('loanStatusBadge');
                    if (currentActiveLoan.status === 'PENDING') {
                        badge.className = "px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-xs font-bold uppercase";
                        badge.innerText = "Application Under Review";
                        agreementBtn.classList.add('hidden');
                        repaySec.classList.add('hidden');
                    } else if (currentActiveLoan.status === 'APPROVED') {
                        badge.className = "px-3 py-1 rounded-full bg-green-500/20 text-green-300 border border-green-500/40 text-xs font-bold uppercase";
                        badge.innerText = "Loan Approved & Disbursed";
                        agreementBtn.classList.remove('hidden');
                        repaySec.classList.remove('hidden');
                    }
                } else {
                    activeContainer.classList.add('hidden');
                    lockedNotice.classList.add('hidden');
                    formContainer.classList.remove('hidden');
                }
            }

            async function submitLoanApplication(e) {
                e.preventDefault();
                const canvas = document.getElementById('clientSigCanvas');
                const sigData = canvas.toDataURL();

                const formData = new FormData();
                formData.append('name', document.getElementById('clientName').value);
                formData.append('guarantorMobile', document.getElementById('guarantorMobile').value);
                formData.append('address', document.getElementById('clientAddress').value);
                formData.append('requestedAmount', document.getElementById('requestedAmount').value);
                formData.append('returnDate', document.getElementById('returnDate').value);
                formData.append('upiId', document.getElementById('upiId').value);
                formData.append('aadharPdf', document.getElementById('aadharPdf').files[0]);
                formData.append('panPdf', document.getElementById('panPdf').files[0]);
                formData.append('clientSignature', sigData);

                try {
                    const res = await fetch('/api/loans/apply', {
                        method: 'POST',
                        headers: { 'Authorization': \`Bearer \${authToken}\` },
                        body: formData
                    });
                    const data = await res.json();
                    if (res.ok) {
                        alert(data.message);
                        loadDashboard();
                    } else {
                        alert(data.error);
                    }
                } catch (err) {
                    alert("Submission failed: " + err.message);
                }
            }

            async function repayLoan() {
                if (!currentActiveLoan) return;
                if (!confirm("Confirm repayment of loan amount back to Le_Le Finance?")) return;

                try {
                    const res = await fetch('/api/loans/repay', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': \`Bearer \${authToken}\`
                        },
                        body: JSON.stringify({ loanId: currentActiveLoan._id })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        alert(data.message);
                        loadDashboard();
                    } else {
                        alert(data.error);
                    }
                } catch (err) {
                    alert("Repayment processing error.");
                }
            }

            // Financer Admin Modal Logic
            function openFinancerModal() {
                document.getElementById('financerCodeModal').classList.remove('hidden');
            }
            function closeFinancerModal() {
                document.getElementById('financerCodeModal').classList.add('hidden');
            }

            async function unlockFinancerPortal() {
                const code = document.getElementById('financerPasscode').value;
                try {
                    const res = await fetch('/api/financer/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        financerCode = code;
                        closeFinancerModal();
                        document.getElementById('financerPortalModal').classList.remove('hidden');
                        loadFinancerLoans();
                    } else {
                        alert(data.error);
                    }
                } catch (err) {
                    alert("Verification error.");
                }
            }

            function closeFinancerPortal() {
                document.getElementById('financerPortalModal').classList.add('hidden');
            }

            async function loadFinancerLoans() {
                try {
                    const res = await fetch('/api/financer/loans', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code: financerCode })
                    });
                    const loans = await res.json();

                    const container = document.getElementById('financerLoanList');
                    container.innerHTML = '';

                    loans.forEach(loan => {
                        const card = document.createElement('div');
                        card.className = "glass p-6 rounded-2xl border border-gray-800 space-y-4";
                        card.innerHTML = \`
                            <div class="flex justify-between items-start">
                                <div>
                                    <h4 class="text-lg font-bold text-white">\${loan.clientName} (\${loan.clientMobile})</h4>
                                    <p class="text-xs text-gray-400">Address: \${loan.address}</p>
                                    <p class="text-xs text-amber-400 font-semibold">Guarantor Mobile: \${loan.guarantorMobile}</p>
                                </div>
                                <span class="px-3 py-1 rounded-full text-xs font-bold uppercase \${loan.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' : loan.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}">\${loan.status}</span>
                            </div>

                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-950 p-4 rounded-xl text-xs">
                                <div><span class="text-gray-500">Requested Amount:</span> <p class="text-white font-bold text-sm">₹\${loan.requestedAmount}</p></div>
                                <div><span class="text-gray-500">Return Date:</span> <p class="text-amber-400 font-bold text-sm">\${new Date(loan.returnDate).toLocaleDateString()}</p></div>
                                <div><span class="text-gray-500">UPI ID:</span> <p class="text-gray-200 font-bold text-sm">\${loan.upiId}</p></div>
                                <div><span class="text-gray-500">LeLe Civil Score:</span> <p class="text-green-400 font-bold text-sm">\${loan.userId ? loan.userId.civilScore : 750}</p></div>
                            </div>

                            <div class="flex gap-4">
                                <a href="\${loan.aadharPdfUrl}" target="_blank" class="px-3 py-2 rounded-lg bg-gray-800 text-xs font-bold text-gray-300 hover:bg-gray-700 flex items-center gap-1">
                                    <i data-lucide="file-text" class="w-3.5 h-3.5"></i> View Aadhar PDF
                                </a>
                                <a href="\${loan.panPdfUrl}" target="_blank" class="px-3 py-2 rounded-lg bg-gray-800 text-xs font-bold text-gray-300 hover:bg-gray-700 flex items-center gap-1">
                                    <i data-lucide="file-text" class="w-3.5 h-3.5"></i> View PAN PDF
                                </a>
                            </div>

                            \${loan.status === 'PENDING' ? \`
                                <div class="flex gap-3 pt-2">
                                    <button onclick="openApprovalModal('\${loan._id}')" class="px-5 py-2.5 rounded-xl bg-green-500 text-black font-extrabold text-xs uppercase shadow-md shadow-green-500/20">
                                        Approve Loan
                                    </button>
                                    <button onclick="rejectLoan('\${loan._id}')" class="px-5 py-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-xs uppercase">
                                        Reject Loan
                                    </button>
                                </div>
                            \` : ''}
                        \`;
                        container.appendChild(card);
                    });
                    lucide.createIcons();
                } catch (err) {
                    alert("Error loading financer requests.");
                }
            }

            function openApprovalModal(loanId) {
                pendingApprovalLoanId = loanId;
                document.getElementById('approvalModal').classList.remove('hidden');
            }
            function closeApprovalModal() {
                pendingApprovalLoanId = null;
                document.getElementById('approvalModal').classList.add('hidden');
            }

            async function confirmApproval() {
                if (!pendingApprovalLoanId) return;
                const canvas = document.getElementById('financerSigCanvas');
                const financerSig = canvas.toDataURL();

                try {
                    const res = await fetch('/api/financer/decision', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            code: financerCode,
                            loanId: pendingApprovalLoanId,
                            decision: 'APPROVE',
                            financerSignature: financerSig
                        })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        alert(data.message);
                        closeApprovalModal();
                        loadFinancerLoans();
                    } else {
                        alert(data.error);
                    }
                } catch (err) {
                    alert("Approval failed.");
                }
            }

            async function rejectLoan(loanId) {
                const customLimit = prompt("Enter new adjusted max limit for this defaulter/rejected client (or leave blank):", "1000");
                try {
                    const res = await fetch('/api/financer/decision', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            code: financerCode,
                            loanId: loanId,
                            decision: 'REJECT',
                            customLimit: customLimit ? parseFloat(customLimit) : undefined
                        })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        alert(data.message);
                        loadFinancerLoans();
                    } else {
                        alert(data.error);
                    }
                } catch (err) {
                    alert("Rejection failed.");
                }
            }

            // Generate & Download Agreement PDF
            function downloadAgreementPDF() {
                if (!currentActiveLoan) return;
                
                document.getElementById('pdfDate').innerText = new Date(currentActiveLoan.createdAt).toLocaleDateString();
                document.getElementById('pdfClientName').innerText = currentActiveLoan.clientName;
                document.getElementById('pdfClientMobile').innerText = currentActiveLoan.clientMobile;
                document.getElementById('pdfGuarantor').innerText = currentActiveLoan.guarantorMobile;
                document.getElementById('pdfAddress').innerText = currentActiveLoan.address;
                document.getElementById('pdfAmount').innerText = currentActiveLoan.requestedAmount;
                document.getElementById('pdfReturnDate').innerText = new Date(currentActiveLoan.returnDate).toLocaleDateString();

                document.getElementById('pdfClientSig').src = currentActiveLoan.clientSignature;
                document.getElementById('pdfFinancerSig').src = currentActiveLoan.financerSignature;

                const element = document.getElementById('pdfTemplate');
                element.classList.remove('hidden');

                const opt = {
                    margin:       0.5,
                    filename:     \`LeLe_Finance_Agreement_\${currentActiveLoan._id}.pdf\`,
                    image:        { type: 'jpeg', quality: 0.98 },
                    html2canvas:  { scale: 2 },
                    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
                };

                html2pdf().set(opt).from(element).save().then(() => {
                    element.classList.add('hidden');
                });
            }

            // Init canvas signature pads and dashboard load on page ready
            window.addEventListener('load', () => {
                init4DBackground();
                initSignaturePad('clientSigCanvas');
                initSignaturePad('financerSigCanvas');
                lucide.createIcons();

                if (authToken) {
                    loadDashboard();
                }
            });
        </script>
    </body>
    </html>
    `);
});

// Start Express Application Server
app.listen(PORT, () => {
    console.log(`Le_Le Finance Server is running on port ${PORT}`);
});
