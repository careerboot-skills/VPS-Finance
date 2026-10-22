/**
 * ============================================================================
 * LE_LE FINANCE CO-POWERED BY CAREERBOOT
 * Full-Stack Single-File Express + Mongoose Engine & Next-Gen UI
 * ============================================================================
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lele_finance';

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// ----------------------------------------------------------------------------
// DATABASE MODE (MongoDB + Auto-Fallback In-Memory Store)
// ----------------------------------------------------------------------------
let isMongoConnected = false;

const UserSchema = new mongoose.Schema({
  mobile: { type: String, required: true, unique: true },
  name: { type: String, default: '' },
  address: { type: String, default: '' },
  aadharDoc: { type: String, default: '' }, // Base64 PDF / File Data
  panDoc: { type: String, default: '' },    // Base64 PDF / File Data
  upiId: { type: String, default: '' },
  leleCivilScore: { type: Number, default: 750 },
  maxLoanLimit: { type: Number, default: 2000 },
  activeLoanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', default: null },
  createdAt: { type: Date, default: Date.now }
});

const LoanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mobile: { type: String, required: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  aadharDocName: { type: String, default: '' },
  panDocName: { type: String, default: '' },
  guarantorMobile: { type: String, required: true },
  requestedAmount: { type: Number, default: 2000 },
  upiId: { type: String, required: true },
  clientSignature: { type: String, required: true },
  financerSignature: { type: String, default: '' },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'PAID'], default: 'PENDING' },
  requestDate: { type: Date, default: Date.now },
  returnDueDate: { type: Date, required: true },
  totalAmountDue: { type: Number, default: 2000 }
});

const User = mongoose.model('User', UserSchema);
const Loan = mongoose.model('Loan', LoanSchema);

// In-memory fallback store if MongoDB isn't connected
const memUsers = new Map();
const memLoans = new Map();

mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    isMongoConnected = true;
    console.log('[MongoDB] Connected successfully to Database.');
  })
  .catch(err => {
    console.warn('[MongoDB] Warning: Connection failed. Switching to robust In-Memory fallback mode.', err.message);
  });

// ----------------------------------------------------------------------------
// API ENDPOINTS
// ----------------------------------------------------------------------------

// 1. Client Auth / Login & History Retrieval
app.post('/api/auth/login', async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile || mobile.length < 10) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit mobile number.' });
    }

    if (isMongoConnected) {
      let user = await User.findOne({ mobile });
      if (!user) {
        user = await User.create({ mobile });
      }
      const allLoans = await Loan.find({ userId: user._id }).sort({ requestDate: -1 });
      const activeLoan = user.activeLoanId ? await Loan.findById(user.activeLoanId) : null;
      return res.json({ success: true, user, activeLoan, loanHistory: allLoans });
    } else {
      let user = memUsers.get(mobile);
      if (!user) {
        user = {
          _id: 'user_' + Date.now(),
          mobile,
          name: '',
          address: '',
          leleCivilScore: 750,
          maxLoanLimit: 2000,
          activeLoanId: null
        };
        memUsers.set(mobile, user);
      }
      const userLoans = Array.from(memLoans.values()).filter(l => l.mobile === mobile).reverse();
      const activeLoan = user.activeLoanId ? memLoans.get(user.activeLoanId) : null;
      return res.json({ success: true, user, activeLoan, loanHistory: userLoans });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Submit Loan Request with PDF Documents
app.post('/api/loan/request', async (req, res) => {
  try {
    const { mobile, name, address, aadharDoc, aadharDocName, panDoc, panDocName, guarantorMobile, requestedAmount, returnDueDate, upiId, clientSignature } = req.body;
    
    if (mobile === guarantorMobile) {
      return res.status(400).json({ success: false, message: 'Guarantor mobile cannot be same as client mobile number.' });
    }

    if (isMongoConnected) {
      const user = await User.findOne({ mobile });
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

      if (user.activeLoanId) {
        const existingLoan = await Loan.findById(user.activeLoanId);
        if (existingLoan && (existingLoan.status === 'PENDING' || existingLoan.status === 'APPROVED')) {
          return res.status(400).json({ success: false, message: 'No loan eligibility while an active loan is ongoing.' });
        }
      }

      user.name = name;
      user.address = address;
      if (aadharDoc) user.aadharDoc = aadharDoc;
      if (panDoc) user.panDoc = panDoc;
      user.upiId = upiId;

      const loanAmount = Math.min(Number(requestedAmount) || 2000, user.maxLoanLimit);

      const newLoan = await Loan.create({
        userId: user._id,
        mobile,
        name,
        address,
        aadharDocName: aadharDocName || 'Aadhar_Document.pdf',
        panDocName: panDocName || 'PAN_Document.pdf',
        guarantorMobile,
        requestedAmount: loanAmount,
        totalAmountDue: loanAmount,
        returnDueDate: new Date(returnDueDate),
        upiId,
        clientSignature
      });

      user.activeLoanId = newLoan._id;
      await user.save();

      const allLoans = await Loan.find({ userId: user._id }).sort({ requestDate: -1 });
      return res.json({ success: true, loan: newLoan, user, loanHistory: allLoans });
    } else {
      let user = memUsers.get(mobile);
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

      if (user.activeLoanId) {
        const existingLoan = memLoans.get(user.activeLoanId);
        if (existingLoan && (existingLoan.status === 'PENDING' || existingLoan.status === 'APPROVED')) {
          return res.status(400).json({ success: false, message: 'No loan eligibility while an active loan is ongoing.' });
        }
      }

      user.name = name;
      user.address = address;
      user.upiId = upiId;

      const loanId = 'loan_' + Date.now();
      const loanAmount = Math.min(Number(requestedAmount) || 2000, user.maxLoanLimit);

      const newLoan = {
        _id: loanId,
        userId: user._id,
        mobile,
        name,
        address,
        aadharDocName: aadharDocName || 'Aadhar_Document.pdf',
        panDocName: panDocName || 'PAN_Document.pdf',
        guarantorMobile,
        requestedAmount: loanAmount,
        totalAmountDue: loanAmount,
        returnDueDate,
        upiId,
        clientSignature,
        financerSignature: '',
        status: 'PENDING',
        requestDate: new Date()
      };

      memLoans.set(loanId, newLoan);
      user.activeLoanId = loanId;
      memUsers.set(mobile, user);

      const userLoans = Array.from(memLoans.values()).filter(l => l.mobile === mobile).reverse();
      return res.json({ success: true, loan: newLoan, user, loanHistory: userLoans });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Financer Portal - Fetch All Applications
app.post('/api/financer/applications', async (req, res) => {
  try {
    const { code } = req.body;
    if (code !== 'Paisa25') {
      return res.status(401).json({ success: false, message: 'Invalid Access Code' });
    }

    if (isMongoConnected) {
      const loans = await Loan.find().sort({ requestDate: -1 });
      return res.json({ success: true, loans });
    } else {
      const loans = Array.from(memLoans.values()).reverse();
      return res.json({ success: true, loans });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Financer Portal - Approve / Reject Loan
app.post('/api/financer/action', async (req, res) => {
  try {
    const { code, loanId, action, financerSignature } = req.body;
    if (code !== 'Paisa25') {
      return res.status(401).json({ success: false, message: 'Invalid Access Code' });
    }

    if (isMongoConnected) {
      const loan = await Loan.findById(loanId);
      if (!loan) return res.status(404).json({ success: false, message: 'Loan request not found' });

      if (action === 'APPROVE') {
        if (!financerSignature) {
          return res.status(400).json({ success: false, message: 'Financer signature is required to approve.' });
        }
        loan.status = 'APPROVED';
        loan.financerSignature = financerSignature;
      } else if (action === 'REJECT') {
        loan.status = 'REJECTED';
        loan.financerSignature = financerSignature || '';
        await User.findByIdAndUpdate(loan.userId, { activeLoanId: null });
      }

      await loan.save();
      return res.json({ success: true, loan });
    } else {
      const loan = memLoans.get(loanId);
      if (!loan) return res.status(404).json({ success: false, message: 'Loan request not found' });

      if (action === 'APPROVE') {
        loan.status = 'APPROVED';
        loan.financerSignature = financerSignature;
      } else if (action === 'REJECT') {
        loan.status = 'REJECTED';
        loan.financerSignature = financerSignature || '';
        const user = memUsers.get(loan.mobile);
        if (user) { user.activeLoanId = null; memUsers.set(loan.mobile, user); }
      }
      memLoans.set(loanId, loan);
      return res.json({ success: true, loan });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Repay Loan & Trigger LeLe Civil Score Update
app.post('/api/loan/repay', async (req, res) => {
  try {
    const { loanId } = req.body;

    if (isMongoConnected) {
      const loan = await Loan.findById(loanId);
      if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

      const user = await User.findById(loan.userId);
      const today = new Date();
      const dueDate = new Date(loan.returnDueDate);
      const isPastDue = today > dueDate;

      if (!isPastDue) {
        user.leleCivilScore = Math.min(900, user.leleCivilScore + 35);
        user.maxLoanLimit = Math.round(user.maxLoanLimit * 1.25);
      } else {
        user.leleCivilScore = Math.max(300, user.leleCivilScore - 75);
      }

      loan.status = 'PAID';
      user.activeLoanId = null;

      await loan.save();
      await user.save();

      const allLoans = await Loan.find({ userId: user._id }).sort({ requestDate: -1 });
      return res.json({ success: true, user, loan, loanHistory: allLoans });
    } else {
      const loan = memLoans.get(loanId);
      if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

      const user = memUsers.get(loan.mobile);
      user.leleCivilScore = Math.min(900, user.leleCivilScore + 35);
      user.maxLoanLimit = Math.round(user.maxLoanLimit * 1.25);
      user.activeLoanId = null;
      loan.status = 'PAID';

      memUsers.set(user.mobile, user);
      memLoans.set(loanId, loan);

      const userLoans = Array.from(memLoans.values()).filter(l => l.mobile === user.mobile).reverse();
      return res.json({ success: true, user, loan, loanHistory: userLoans });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// SERVE EMBEDDED SINGLE-PAGE WEB FRONTEND
// ----------------------------------------------------------------------------

app.get('*', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Le_Le Finance co-powered by CareerBoot</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Rajdhani', sans-serif; background: #030712; color: #f3f4f6; overflow-x: hidden; }
    .font-orbitron { font-family: 'Orbitron', sans-serif; }
    .glass-card { background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5); }
    .glass-card-gold { background: rgba(20, 16, 5, 0.9); backdrop-filter: blur(16px); border: 1px solid rgba(234, 179, 8, 0.3); box-shadow: 0 0 30px rgba(234, 179, 8, 0.15); }
    canvas#bgCanvas { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: -1; pointer-events: none; }
  </style>
</head>
<body class="min-h-screen flex flex-col justify-between">

  <canvas id="bgCanvas"></canvas>

  <!-- NAVBAR -->
  <nav class="w-full glass-card px-6 py-4 flex justify-between items-center z-50 border-b border-cyan-500/20">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
        <span class="font-orbitron font-black text-xl text-black">L</span>
      </div>
      <div>
        <h1 class="font-orbitron text-xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500">Le_Le Finance</h1>
        <p class="text-[10px] text-gray-400 tracking-widest uppercase">Co-powered by <span class="text-cyan-400 font-bold">CareerBoot</span></p>
      </div>
    </div>
    
    <div class="flex items-center gap-4">
      <button onclick="openFinancerModal()" class="px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/20 text-xs font-bold tracking-wider transition">
        🔒 FINANCER PORTAL
      </button>
      <div id="userBadge" class="hidden text-xs bg-cyan-950/60 border border-cyan-500/30 px-3 py-1.5 rounded-lg text-cyan-300"></div>
    </div>
  </nav>

  <!-- MAIN CONTAINER -->
  <main class="container mx-auto px-4 py-8 flex-1 flex flex-col items-center justify-center">

    <!-- AUTH SECTION -->
    <div id="authSection" class="w-full max-w-md glass-card rounded-2xl p-8 border-cyan-500/30 shadow-2xl">
      <h2 class="font-orbitron text-2xl font-bold text-center text-cyan-400 mb-2">CLIENT LOGIN</h2>
      <p class="text-xs text-gray-400 text-center mb-6">Enter mobile number to request interest-free micro-loans</p>
      <div class="space-y-4">
        <div>
          <label class="text-xs text-gray-300 font-semibold mb-1 block">Mobile Number</label>
          <input type="tel" id="loginMobile" placeholder="Enter 10-digit mobile no." class="w-full bg-slate-900/80 border border-cyan-500/30 rounded-xl px-4 py-3 text-cyan-200 focus:outline-none focus:border-cyan-400">
        </div>
        <button onclick="loginUser()" class="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-orbitron font-bold text-black tracking-wider hover:opacity-90 transition">
          ENTER PORTAL
        </button>
      </div>
    </div>

    <!-- DASHBOARD SECTION -->
    <div id="dashboardSection" class="hidden w-full max-w-4xl space-y-6">
      
      <!-- CIBIL SCORE DISPLAY -->
      <div class="glass-card rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-6 border-cyan-500/30">
        <div>
          <span class="text-xs font-bold tracking-widest text-gray-400 uppercase">LeLe Civil Score</span>
          <div class="flex items-baseline gap-3 mt-1">
            <span id="cibilVal" class="font-orbitron text-4xl font-black text-cyan-400">750</span>
            <span class="text-xs text-emerald-400 font-bold">▲ Excellent</span>
          </div>
          <p class="text-xs text-gray-400 mt-2">Maximum Available Limit: <span id="limitVal" class="text-yellow-400 font-bold">₹2000</span></p>
        </div>
        <div class="text-right text-xs text-gray-400 border-l border-gray-700 pl-6 space-y-1">
          <p>• ₹2000 0% Interest for 30 Days</p>
          <p>• 5% Daily Penalty post Day 30</p>
          <p>• On-time payoff increases credit limit +25%</p>
        </div>
      </div>

      <!-- LOAN APPLICATION FORM -->
      <div id="loanRequestForm" class="glass-card rounded-2xl p-8 border-cyan-500/30">
        <h3 class="font-orbitron text-xl font-bold text-cyan-400 mb-6 border-b border-cyan-500/20 pb-3">LOAN APPLICATION</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-gray-300">Full Name</label>
            <input type="text" id="reqName" class="w-full bg-slate-900/80 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-cyan-200">
          </div>
          <div>
            <label class="text-xs text-gray-300">Address</label>
            <input type="text" id="reqAddress" class="w-full bg-slate-900/80 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-cyan-200">
          </div>
          <div>
            <label class="text-xs text-gray-300">Aadhar Document (PDF)</label>
            <input type="file" id="reqAadharFile" accept="application/pdf" class="w-full bg-slate-900/80 border border-cyan-500/30 rounded-xl px-4 py-2 text-xs text-cyan-300">
          </div>
          <div>
            <label class="text-xs text-gray-300">PAN Document (PDF)</label>
            <input type="file" id="reqPanFile" accept="application/pdf" class="w-full bg-slate-900/80 border border-cyan-500/30 rounded-xl px-4 py-2 text-xs text-cyan-300">
          </div>
          <div>
            <label class="text-xs text-gray-300">Guarantor Mobile No.</label>
            <input type="tel" id="reqGuarantor" placeholder="Must be different from yours" class="w-full bg-slate-900/80 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-cyan-200">
          </div>
          <div>
            <label class="text-xs text-gray-300">Return Due Date</label>
            <input type="date" id="reqDueDate" class="w-full bg-slate-900/80 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-cyan-200">
          </div>
          <div>
            <label class="text-xs text-gray-300">UPI ID (For Disbursal)</label>
            <input type="text" id="reqUpi" placeholder="username@upi" class="w-full bg-slate-900/80 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-cyan-200">
          </div>
          <div>
            <label class="text-xs text-gray-300">Request Amount (Max ₹2000)</label>
            <input type="number" id="reqAmount" value="2000" max="2000" class="w-full bg-slate-900/80 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-cyan-200">
          </div>
        </div>

        <div class="mt-6">
          <label class="text-xs text-gray-300 mb-2 block">Client Signature (Draw Below)</label>
          <div class="bg-slate-900/90 rounded-xl border border-cyan-500/30 p-2">
            <canvas id="clientSigCanvas" width="400" height="120" class="w-full bg-slate-950 rounded-lg cursor-crosshair"></canvas>
            <button onclick="clearCanvas('clientSigCanvas')" class="mt-2 text-xs text-red-400 hover:underline">Clear Signature</button>
          </div>
        </div>

        <button onclick="submitLoanRequest()" class="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-orbitron font-bold text-black tracking-wider">
          SUBMIT LOAN REQUEST
        </button>
      </div>

      <!-- ACTIVE LOAN CARD -->
      <div id="activeLoanCard" class="hidden glass-card rounded-2xl p-8 border-cyan-500/30 space-y-6">
        <div class="flex justify-between items-center border-b border-gray-700 pb-4">
          <div>
            <span class="text-xs text-gray-400">ACTIVE LOAN STATUS</span>
            <h4 id="loanStatusBadge" class="font-orbitron text-2xl font-bold text-yellow-400">PENDING APPROVAL</h4>
          </div>
          <button id="downloadPdfBtn" onclick="generateAgreementPDF()" class="hidden px-4 py-2 bg-purple-600/30 border border-purple-500/50 text-purple-300 rounded-xl text-xs font-bold">
            📄 DOWNLOAD AGREEMENT PDF
          </button>
        </div>

        <div id="loanDetailsGrid" class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm"></div>

        <div id="repaySection" class="hidden pt-4 border-t border-gray-700">
          <button onclick="repayActiveLoan()" class="w-full py-3 bg-emerald-500 text-black font-orbitron font-bold rounded-xl">
            PAY BACK LOAN
          </button>
        </div>
      </div>

      <!-- PREVIOUS LOAN HISTORY -->
      <div class="glass-card rounded-2xl p-6 border-cyan-500/30">
        <h3 class="font-orbitron text-lg font-bold text-cyan-400 mb-4 border-b border-cyan-500/20 pb-2">PREVIOUS LOAN HISTORY</h3>
        <div id="historyList" class="space-y-3">
          <p class="text-xs text-gray-400 italic">No historical loans found.</p>
        </div>
      </div>

    </div>

  </main>

  <!-- FINANCER MODAL -->
  <div id="financerModal" class="hidden fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
    <div class="glass-card-gold max-w-3xl w-full rounded-2xl p-6 border-yellow-500/40 max-h-[90vh] overflow-y-auto">
      
      <div id="financerAuth">
        <h3 class="font-orbitron text-xl font-bold text-yellow-400 mb-4">FINANCER UNLOCK</h3>
        <input type="password" id="financerCode" placeholder="Enter Top Secret Code" class="w-full bg-slate-900 border border-yellow-500/40 rounded-xl px-4 py-3 text-yellow-300 mb-4">
        <button onclick="unlockFinancer()" class="w-full py-3 bg-yellow-500 text-black font-orbitron font-bold rounded-xl">UNLOCK PORTAL</button>
      </div>

      <div id="financerPanel" class="hidden space-y-6">
        <div class="flex justify-between items-center border-b border-yellow-500/20 pb-4">
          <h3 class="font-orbitron text-xl font-bold text-yellow-400">REQUESTED APPLICATIONS</h3>
          <button onclick="closeFinancerModal()" class="text-xs text-gray-400 hover:text-white">CLOSE</button>
        </div>

        <div class="mb-4">
          <label class="text-xs text-yellow-200 block mb-1">Financer Signature (Required for Approval)</label>
          <canvas id="financerSigCanvas" width="400" height="100" class="w-full bg-slate-950 border border-yellow-500/30 rounded-lg cursor-crosshair"></canvas>
          <button onclick="clearCanvas('financerSigCanvas')" class="text-xs text-red-400 mt-1">Clear</button>
        </div>

        <div id="applicationsList" class="space-y-4"></div>
      </div>

    </div>
  </div>

  <script>
    // Three.js Background Particle Scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('bgCanvas'), alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    const geometry = new THREE.BufferGeometry();
    const count = 1200;
    const positions = new Float32Array(count * 3);
    for(let i=0; i<count*3; i++) positions[i] = (Math.random() - 0.5) * 10;
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({ size: 0.02, color: 0x06b6d4, transparent: true, opacity: 0.6 });
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    camera.position.z = 3;

    function animate() {
      requestAnimationFrame(animate);
      particles.rotation.y += 0.001;
      particles.rotation.x += 0.0005;
      renderer.render(scene, camera);
    }
    animate();

    // Canvas Signature Pad Logic
    function setupCanvas(canvasId) {
      const canvas = document.getElementById(canvasId);
      const ctx = canvas.getContext('2d');
      let drawing = false;

      canvas.addEventListener('mousedown', (e) => { drawing = true; draw(e); });
      canvas.addEventListener('mouseup', () => { drawing = false; ctx.beginPath(); });
      canvas.addEventListener('mousemove', draw);

      canvas.addEventListener('touchstart', (e) => { drawing = true; draw(e.touches[0]); e.preventDefault(); });
      canvas.addEventListener('touchend', () => { drawing = false; ctx.beginPath(); });
      canvas.addEventListener('touchmove', (e) => { draw(e.touches[0]); e.preventDefault(); });

      function draw(e) {
        if(!drawing) return;
        const rect = canvas.getBoundingClientRect();
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#06b6d4';
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
      }
    }
    setupCanvas('clientSigCanvas');
    setupCanvas('financerSigCanvas');

    function clearCanvas(id) {
      const c = document.getElementById(id);
      c.getContext('2d').clearRect(0, 0, c.width, c.height);
    }

    // Helper: Convert File to Base64
    const fileToBase64 = file => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });

    // App State Management
    let currentUser = null;
    let currentLoan = null;
    let loanHistory = [];

    async function loginUser() {
      const mobile = document.getElementById('loginMobile').value.trim();
      if (!mobile || mobile.length < 10) {
        alert('Please enter a valid 10-digit mobile number.');
        return;
      }

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile })
        });
        const data = await res.json();

        if (data.success) {
          currentUser = data.user;
          currentLoan = data.activeLoan;
          loanHistory = data.loanHistory || [];
          renderDashboard();
        } else {
          alert(data.message || 'Login failed');
        }
      } catch (err) {
        alert('Network or server connection error: ' + err.message);
      }
    }

    function renderDashboard() {
      document.getElementById('authSection').classList.add('hidden');
      document.getElementById('dashboardSection').classList.remove('hidden');
      document.getElementById('userBadge').classList.remove('hidden');
      document.getElementById('userBadge').innerText = \`📱 \${currentUser.mobile}\`;

      document.getElementById('cibilVal').innerText = currentUser.leleCivilScore;
      document.getElementById('limitVal').innerText = \`₹\${currentUser.maxLoanLimit}\`;

      if (currentLoan && (currentLoan.status === 'PENDING' || currentLoan.status === 'APPROVED')) {
        document.getElementById('loanRequestForm').classList.add('hidden');
        document.getElementById('activeLoanCard').classList.remove('hidden');
        
        document.getElementById('loanStatusBadge').innerText = currentLoan.status;
        if (currentLoan.status === 'APPROVED') {
          document.getElementById('downloadPdfBtn').classList.remove('hidden');
          document.getElementById('repaySection').classList.remove('hidden');
        }

        document.getElementById('loanDetailsGrid').innerHTML = \`
          <div><span class="text-gray-400 block text-xs">Amount</span><b>₹\${currentLoan.requestedAmount}</b></div>
          <div><span class="text-gray-400 block text-xs">Due Date</span><b>\${new Date(currentLoan.returnDueDate).toLocaleDateString()}</b></div>
          <div><span class="text-gray-400 block text-xs">UPI ID</span><b>\${currentLoan.upiId}</b></div>
          <div><span class="text-gray-400 block text-xs">Guarantor</span><b>\${currentLoan.guarantorMobile}</b></div>
        \`;
      } else {
        document.getElementById('loanRequestForm').classList.remove('hidden');
        document.getElementById('activeLoanCard').classList.add('hidden');
      }

      // Render History List
      const historyContainer = document.getElementById('historyList');
      if (loanHistory.length === 0) {
        historyContainer.innerHTML = '<p class="text-xs text-gray-400 italic">No historical loans found.</p>';
      } else {
        historyContainer.innerHTML = loanHistory.map(h => \`
          <div class="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 flex justify-between items-center text-xs">
            <div>
              <p class="font-bold text-cyan-300">Requested Amount: ₹\${h.requestedAmount}</p>
              <p class="text-gray-400">Date: \${new Date(h.requestDate).toLocaleDateString()} | UPI: \${h.upiId}</p>
            </div>
            <span class="px-2.5 py-1 rounded-md font-bold \${
              h.status === 'APPROVED' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
              h.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              h.status === 'REJECTED' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }">\${h.status}</span>
          </div>
        \`).join('');
      }
    }

    async function submitLoanRequest() {
      const sigCanvas = document.getElementById('clientSigCanvas');
      const aadharFile = document.getElementById('reqAadharFile').files[0];
      const panFile = document.getElementById('reqPanFile').files[0];

      let aadharDoc = '', aadharDocName = '';
      let panDoc = '', panDocName = '';

      if (aadharFile) {
        aadharDoc = await fileToBase64(aadharFile);
        aadharDocName = aadharFile.name;
      }
      if (panFile) {
        panDoc = await fileToBase64(panFile);
        panDocName = panFile.name;
      }

      const payload = {
        mobile: currentUser.mobile,
        name: document.getElementById('reqName').value,
        address: document.getElementById('reqAddress').value,
        aadharDoc,
        aadharDocName,
        panDoc,
        panDocName,
        guarantorMobile: document.getElementById('reqGuarantor').value,
        returnDueDate: document.getElementById('reqDueDate').value,
        upiId: document.getElementById('reqUpi').value,
        requestedAmount: document.getElementById('reqAmount').value,
        clientSignature: sigCanvas.toDataURL()
      };

      const res = await fetch('/api/loan/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        currentLoan = data.loan;
        currentUser = data.user;
        loanHistory = data.loanHistory || [];
        renderDashboard();
      } else {
        alert(data.message);
      }
    }

    function openFinancerModal() { document.getElementById('financerModal').classList.remove('hidden'); }
    function closeFinancerModal() { document.getElementById('financerModal').classList.add('hidden'); }

    async function unlockFinancer() {
      const code = document.getElementById('financerCode').value;
      const res = await fetch('/api/financer/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('financerAuth').classList.add('hidden');
        document.getElementById('financerPanel').classList.remove('hidden');
        
        const listHtml = data.loans.map(l => \`
          <div class="bg-slate-900 border border-yellow-500/20 p-4 rounded-xl flex justify-between items-center">
            <div>
              <p class="font-bold text-yellow-300">\${l.name} (\${l.mobile})</p>
              <p class="text-xs text-gray-400">Amount: ₹\${l.requestedAmount} | UPI: \${l.upiId}</p>
              <p class="text-xs text-gray-400">Aadhar Doc: \${l.aadharDocName || 'Attached'} | PAN Doc: \${l.panDocName || 'Attached'}</p>
              <p class="text-xs text-gray-400">Status: \${l.status}</p>
            </div>
            \${l.status === 'PENDING' ? \`
              <div class="flex gap-2">
                <button onclick="handleFinancerAction('\${l._id}', 'APPROVE')" class="px-3 py-1 bg-emerald-500 text-black text-xs font-bold rounded">Approve</button>
                <button onclick="handleFinancerAction('\${l._id}', 'REJECT')" class="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded">Reject</button>
              </div>
            \` : ''}
          </div>
        \`).join('');
        document.getElementById('applicationsList').innerHTML = listHtml;
      } else {
        alert('Invalid Code');
      }
    }

    async function handleFinancerAction(loanId, action) {
      const code = document.getElementById('financerCode').value;
      const sigCanvas = document.getElementById('financerSigCanvas');
      const res = await fetch('/api/financer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, loanId, action, financerSignature: sigCanvas.toDataURL() })
      });
      const data = await res.json();
      if (data.success) {
        unlockFinancer();
      }
    }

    async function repayActiveLoan() {
      const res = await fetch('/api/loan/repay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanId: currentLoan._id })
      });
      const data = await res.json();
      if (data.success) {
        currentUser = data.user;
        currentLoan = null;
        loanHistory = data.loanHistory || [];
        renderDashboard();
      }
    }

    function generateAgreementPDF() {
      const element = document.createElement('div');
      element.innerHTML = \`
        <div style="padding: 20px; font-family: Arial; color: #000;">
          <h2>LE_LE FINANCE LOAN AGREEMENT</h2>
          <p>Co-powered by CareerBoot</p>
          <hr/>
          <p><b>Client Name:</b> \${currentLoan.name}</p>
          <p><b>Mobile:</b> \${currentLoan.mobile}</p>
          <p><b>Address:</b> \${currentLoan.address}</p>
          <p><b>Loan Amount:</b> ₹\${currentLoan.requestedAmount} (0% Interest up to 30 days)</p>
          <p><b>Due Return Date:</b> \${new Date(currentLoan.returnDueDate).toLocaleDateString()}</p>
          <br/>
          <div>
            <p><b>Client Signature:</b></p>
            <img src="\${currentLoan.clientSignature}" width="150" />
          </div>
          <div>
            <p><b>Financer Signature:</b></p>
            <img src="\${currentLoan.financerSignature}" width="150" />
          </div>
        </div>
      \`;
      html2pdf().from(element).save('LeLe_Finance_Agreement.pdf');
    }
  </script>
</body>
</html>
  `);
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`[Le_Le Finance Server] Running on port ${PORT}`);
});
